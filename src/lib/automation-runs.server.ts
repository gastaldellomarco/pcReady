import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import type { AutomationFlow } from "@/types/automation";
import type {
  ActionResult,
  AutomationRunLog,
  DryRunResult,
  DryRunStep,
  HealthStatus,
  RunLogStatus,
} from "@/lib/automation-runs";
import {
  executeAction,
  webhookAction,
  type FlowAction,
} from "./automation-actions.server";

// ─── Re-exports ──────────────────────────────────────────────────────

export { supabaseAdmin, webhookAction };

// ─── Constants ────────────────────────────────────────────────────────

export const AUTOMATION_RUN_LOG_SELECT =
  "id, automation_id, triggered_at, triggered_by, status, duration_ms, trigger_payload, actions_executed, error_message, is_dry_run";

// ─── Types ────────────────────────────────────────────────────────────

/** A dry-run / execution block from the flow graph. */
interface DryRunBlock {
  id?: string;
  type?: "trigger" | "condition" | "action" | string;
  label?: string;
  name?: string;
  action?: string;
  field?: string;
  condition?: string;
  expression?: string;
  config?: Record<string, unknown>;
  data?: {
    type?: string;
    label?: string;
    config?: Record<string, unknown>;
    actionType?: string;
  };
  result?: unknown;
  expected_result?: unknown;
  force_error?: unknown;
}

interface ExecuteAutomationInput {
  automationId: string;
  triggeredBy: string;
  isDryRun: boolean;
  triggerPayload?: Record<string, any>;
}

export interface SaveAutomationRunInput {
  automationId: string;
  triggeredBy: string;
  status: RunLogStatus;
  durationMs: number;
  triggerPayload: Record<string, any>;
  actionsExecuted: ActionResult[];
  errorMessage: string | null;
  isDryRun: boolean;
}

type GraphExecutionBlock = { kind: "condition"; node: any } | { kind: "action"; action: any };

// ─── Persistence ─────────────────────────────────────────────────────

/** Persiste una riga in `automation_run_logs` (esposta anche come vista `automation_runs`). */
export async function saveAutomationRun(input: SaveAutomationRunInput): Promise<AutomationRunLog> {
  const { data: log, error: insertError } = await supabaseAdmin
    .from("automation_run_logs" as any)
    .insert({
      automation_id: input.automationId,
      triggered_by: input.triggeredBy,
      status: input.status,
      duration_ms: input.durationMs,
      trigger_payload: input.triggerPayload,
      actions_executed: input.actionsExecuted,
      error_message: input.errorMessage,
      is_dry_run: input.isDryRun,
    })
    .select(AUTOMATION_RUN_LOG_SELECT)
    .single();
  if (insertError) throw insertError;
  return log as unknown as AutomationRunLog;
}

// ─── Auth ─────────────────────────────────────────────────────────────

/**
 *
 */
export async function requireAutomationRunnerUser(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Non autenticato", { status: 401 });

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .in("role", ["admin", "tech"])
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) throw new Response("Permessi insufficienti", { status: 403 });

  return data.user;
}

// ─── Flow Graph Traversal ─────────────────────────────────────────────

function getPath(source: Record<string, any>, path: string) {
  if (!path) return undefined;
  return path.split(".").reduce<any>((current, key) => current?.[key], source);
}

function evaluateCondition(config: Record<string, any>, payload: Record<string, any>) {
  const field = String(config.field ?? "");
  const operator = String(config.operator ?? "equals");
  const expected = config.value;
  const actual = getPath(payload, field);

  if (operator === "exists") return actual !== undefined && actual !== null && actual !== "";
  if (operator === "not_equals") return String(actual ?? "") !== String(expected ?? "");
  if (operator === "contains") return String(actual ?? "").includes(String(expected ?? ""));
  if (operator === "gt") return Number(actual) > Number(expected);
  if (operator === "lt") return Number(actual) < Number(expected);
  return String(actual ?? "") === String(expected ?? "");
}

function nextNodeForBranch(node: any, edges: any[], byId: Map<string, any>, passed: boolean) {
  const outgoing = edges.filter((edge) => String(edge.source) === String(node.id));
  const wanted = passed ? "true" : "false";
  const edge =
    outgoing.find((item) => item.data?.branch === wanted) ??
    outgoing.find((item) => !item.data?.branch);
  return edge ? byId.get(String(edge.target)) : null;
}

function nextSequentialNode(node: any, edges: any[], byId: Map<string, any>) {
  const edge = edges.find((item) => String(item.source) === String(node.id));
  return edge ? byId.get(String(edge.target)) : null;
}

function executeConditionBlock(
  block: { node: any },
  index: number,
  triggerPayload: Record<string, any>,
): ActionResult {
  const config = block.node.data?.config ?? {};
  const passed = evaluateCondition(config, triggerPayload);
  const label = block.node.data?.label || `Condizione ${index + 1}`;
  return {
    action: String(label),
    blockId: String(block.node.id),
    blockType: "condition",
    status: passed ? "success" : "skipped",
    input: triggerPayload,
    details: {
      field: config.field,
      operator: config.operator ?? "equals",
      expected: config.value,
      actual: getPath(triggerPayload, String(config.field ?? "")),
      branch: passed ? "true" : "false",
    },
    result: { passed },
  };
}

function extractActions(flow: Partial<AutomationFlow>): FlowAction[] {
  const fromColumn = Array.isArray(flow.actions_definition) ? flow.actions_definition : null;
  if (fromColumn?.length) return fromColumn;

  const wizardActions = flow.flow_definition?.meta?.wizard?.actions_definition;
  if (Array.isArray(wizardActions) && wizardActions.length) return wizardActions;

  const nodeActions = flow.flow_definition?.nodes
    ?.filter((node: any) => node.type === "action")
    .map((node: any) => ({
      id: node.id,
      type: node.data?.actionType || node.data?.label || "action",
      label: node.data?.label || node.data?.actionType || "action",
      config: node.data?.config || {},
    }));
  return Array.isArray(nodeActions) ? nodeActions : [];
}

function extractGraphExecutionBlocks(
  flow: Partial<AutomationFlow>,
  triggerPayload: Record<string, unknown>,
): GraphExecutionBlock[] {
  const nodes = Array.isArray(flow.flow_definition?.nodes) ? flow.flow_definition.nodes : [];
  const edges = Array.isArray(flow.flow_definition?.edges) ? flow.flow_definition.edges : [];
  if (!nodes.some((node: any) => node.data?.type === "condition" || node.type === "condition")) {
    return [];
  }

  const byId = new Map<string, any>(nodes.map((node: any) => [String(node.id), node]));
  const trigger =
    nodes.find((node: any) => node.data?.type === "trigger" || node.type === "trigger") ?? nodes[0];
  const blocks: GraphExecutionBlock[] = [];
  const visited = new Set<string>();
  let current: any = trigger;

  while (current && !visited.has(String(current.id))) {
    visited.add(String(current.id));
    const nodeType = current.data?.type || current.type;
    if (nodeType === "condition") {
      blocks.push({ kind: "condition", node: current });
      const passed = evaluateCondition(current.data?.config ?? {}, triggerPayload);
      current = nextNodeForBranch(current, edges, byId, passed);
      continue;
    }
    if (nodeType === "action") {
      blocks.push({
        kind: "action",
        action: {
          id: current.id,
          type: current.data?.actionType || current.data?.label || "action",
          label: current.data?.label || current.data?.actionType || "action",
          config: current.data?.config || {},
          data: current.data,
        },
      });
    }
    current = nextSequentialNode(current, edges, byId);
  }

  return blocks;
}

// ─── Simulation (Dry Run) ────────────────────────────────────────────

function extractDryRunBlocks(flow: Partial<AutomationFlow>): DryRunBlock[] {
  const blocks: DryRunBlock[] = [];
  const triggerDef =
    flow.trigger_definition || flow.flow_definition?.meta?.wizard?.trigger_definition || null;
  if (triggerDef) {
    blocks.push({
      ...triggerDef,
      type: "trigger" as const,
      label: triggerDef.type,
    });
  }

  const wizardConditions = flow.flow_definition?.meta?.wizard?.conditions_definition;
  if (Array.isArray(wizardConditions)) {
    wizardConditions.forEach((condition: any) => blocks.push({ type: "condition", ...condition }));
  }

  const nodes = Array.isArray(flow.flow_definition?.nodes) ? flow.flow_definition.nodes : [];
  if (!blocks.length) {
    nodes
      .filter((node: any) => node.type === "trigger" || node.type === "condition")
      .forEach((node: any) => blocks.push({ type: node.type, data: node.data }));
  }

  extractActions(flow).forEach((action: any) => blocks.push({ type: "action", ...action }));
  return blocks;
}

function normalizeBlockType(block: DryRunBlock): DryRunStep["type"] {
  if (block.type === "trigger" || block.type === "condition" || block.type === "action") {
    return block.type;
  }
  if (
    block.data?.type === "trigger" ||
    block.data?.type === "condition" ||
    block.data?.type === "action"
  ) {
    return block.data.type;
  }
  return "action";
}

function simulateAction(action: FlowAction, index: number): ActionResult {
  const actionName = String(
    action.label || action.type || action.action || action.data?.label || `Action ${index + 1}`,
  );
  if (action.config?.force_error || action.force_error) {
    return {
      action: actionName,
      blockId: action.id ? String(action.id) : undefined,
      blockType: "action",
      status: "error",
      input: action.config ?? action.data?.config ?? {},
      error: "Errore simulato dalla configurazione action",
    };
  }

  return {
    action: actionName,
    blockId: action.id ? String(action.id) : undefined,
    blockType: "action",
    status: "success",
    input: action.config ?? action.data?.config ?? {},
    result: { mode: "dry_run", message: "Azione validata, nessun effetto applicato" },
  };
}

function simulateBlock(block: DryRunBlock, index: number): DryRunStep {
  const type = normalizeBlockType(block);
  const label = String(
    block.label || block.name || block.action || block.type || block.data?.label || type,
  );

  if (type === "condition") {
    const expression = String(
      block.expression ||
        block.field ||
        block.condition ||
        block.data?.config?.expression ||
        block.data?.label ||
        "condizione configurata",
    );
    const forced = block.expected_result ?? block.result ?? block.data?.config?.expected_result;
    const passed = forced === undefined ? true : Boolean(forced);
    return {
      stepIndex: index,
      type,
      label,
      result: passed ? "pass" : "skip",
      detail: `Condizione: ${expression} → ${passed ? "true" : "false"}`,
    };
  }

  if (type === "action" && (block.config?.force_error || block.force_error)) {
    return {
      stepIndex: index,
      type,
      label,
      result: "error",
      detail: "Azione non eseguibile: errore simulato dalla configurazione",
    };
  }

  return {
    stepIndex: index,
    type,
    label,
    result: "pass",
    detail:
      type === "trigger"
        ? `Trigger: ${label} → valido per simulazione`
        : `Azione: ${label} → validata, nessun effetto applicato`,
  };
}

/**
 *
 */
export async function simulateAutomationDryRun(flowId: string): Promise<DryRunResult> {
  const { data: flow, error } = await supabaseAdmin
    .from("automation_flows" as any)
    .select("id, name, flow_definition, actions_definition, trigger_definition")
    .eq("id", flowId)
    .single();
  if (error) throw error;

  const flowAny = flow as any;
  const blocks = extractDryRunBlocks(flowAny);
  const steps: DryRunStep[] = [];

  if (!blocks.length) {
    return {
      steps: [
        {
          stepIndex: 0,
          type: "action",
          label: "Validazione flow",
          result: "error",
          detail: "Flow senza trigger, condizioni o azioni simulabili",
        },
      ],
      summary: "error",
    };
  }

  for (const [index, block] of blocks.entries()) {
    const step = simulateBlock(block, index);
    steps.push(step);
    if (step.result === "skip" || step.result === "error") break;
  }

  const summary = steps.some((step) => step.result === "error")
    ? "error"
    : steps.some((step) => step.result === "skip")
      ? "blocked"
      : "success";

  return { steps, summary };
}

// ─── Health ───────────────────────────────────────────────────────────

/**
 *
 */
export function computeHealth(logs: Pick<AutomationRunLog, "status">[]): HealthStatus {
  if (!logs.length) return "never_run";
  const lastThree = logs.slice(0, 3);
  if (lastThree.length === 3 && lastThree.every((log) => log.status === "error")) return "failing";
  const lastFive = logs.slice(0, 5);
  if (lastFive.some((log) => log.status === "error")) return "degraded";
  if (lastFive.every((log) => log.status === "success")) return "healthy";
  return "degraded";
}

// ─── Notification ─────────────────────────────────────────────────────

/**
 *
 */
export async function notifyAutomationFailure({
  flowId,
  flowName,
  error,
}: {
  flowId?: string | null;
  flowName: string;
  error: string;
}) {
  await createNotificationForAdmins({
    type: "automation_failed",
    title: `Automazione fallita: ${flowName}`,
    body: error,
    payload: { flow_id: flowId ?? null, flow_name: flowName },
    link: "/automations",
  });
}

// ─── Orchestration ────────────────────────────────────────────────────

/**
 *
 */
export async function executeAutomationRun({
  automationId,
  triggeredBy,
  isDryRun,
  triggerPayload = {},
}: ExecuteAutomationInput) {
  const started = Date.now();
  const { data: flow, error } = await supabaseAdmin
    .from("automation_flows" as any)
    .select("id, name, active, flow_definition, actions_definition, trigger_definition")
    .eq("id", automationId)
    .single();
  if (error) throw error;

  const flowAny = flow as any;
  const graphBlocks = extractGraphExecutionBlocks(flowAny, triggerPayload);
  const actions = extractActions(flowAny);
  const trigger =
    flowAny.trigger_definition || flowAny.flow_definition?.meta?.wizard?.trigger_definition || null;
  let status: RunLogStatus = isDryRun ? "dry_run" : "success";
  let errorMessage: string | null = null;
  let actionsExecuted: ActionResult[] = [];

  try {
    if (!trigger && !flowAny.flow_definition?.nodes?.length) {
      throw new Error("Flow senza trigger o nodi validi");
    }

    if (graphBlocks.length) {
      actionsExecuted = [];
      for (let index = 0; index < graphBlocks.length; index++) {
        const block = graphBlocks[index];
        const result =
          block.kind === "condition"
            ? executeConditionBlock(block, index, triggerPayload)
            : isDryRun
              ? simulateAction(block.action, index)
              : await executeAction(block.action, index, triggeredBy, triggerPayload);
        actionsExecuted.push(result);
        if (result.status === "error") throw new Error(result.error || "Blocco fallito");
        if (block.kind === "condition" && result.status === "skipped") break;
      }
    } else if (!actions.length) {
      status = "skipped";
      actionsExecuted = [
        {
          action: "validate_flow",
          status: "skipped",
          result: { reason: "Nessuna action configurata" },
        },
      ];
    } else if (isDryRun) {
      actionsExecuted = actions.map((action, index) => simulateAction(action, index));
      const failed = actionsExecuted.find((action) => action.status === "error");
      if (failed) throw new Error(failed.error || "Action fallita");
    } else {
      actionsExecuted = [];
      for (let index = 0; index < actions.length; index++) {
        const result = await executeAction(actions[index], index, triggeredBy, triggerPayload);
        actionsExecuted.push(result);
        if (result.status === "error") throw new Error(result.error || "Action fallita");
      }
    }
  } catch (runError) {
    status = "error";
    errorMessage = runError instanceof Error ? runError.message : "Errore esecuzione automazione";
    if (!actionsExecuted.length) {
      actionsExecuted = [
        {
          action: "validate_flow",
          status: "error",
          error: errorMessage,
        },
      ];
    }
  }

  const durationMs = Date.now() - started;
  const log = await saveAutomationRun({
    automationId,
    triggeredBy,
    status,
    durationMs,
    triggerPayload,
    actionsExecuted,
    errorMessage,
    isDryRun,
  });

  await supabaseAdmin
    .from("automation_flows" as any)
    .update({
      last_run_at: new Date().toISOString(),
      flow_definition: {
        ...(flowAny.flow_definition || {}),
        meta: {
          ...(flowAny.flow_definition?.meta || {}),
          last_run_at: new Date().toISOString(),
          last_run_status: status,
        },
      },
    })
    .eq("id", automationId);

  if (status === "error") {
    await notifyAutomationFailure({
      flowId: automationId,
      flowName: flowAny.name,
      error: errorMessage || "Errore automazione",
    });
  }

  return log;
}

/** Entry point runtime: esegue il flow, logga esito e notifica in caso di errore. */
export async function executeAutomationFlow(opts: {
  flowId: string;
  trigger: string;
  input: Record<string, unknown>;
  triggeredBy: string;
  isDryRun?: boolean;
}) {
  const triggerPayload = {
    ...opts.input,
    _automation_trigger: opts.trigger,
  };
  return executeAutomationRun({
    automationId: opts.flowId,
    triggeredBy: opts.triggeredBy,
    isDryRun: opts.isDryRun ?? false,
    triggerPayload,
  });
}
