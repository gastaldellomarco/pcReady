import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import type {
  ActionResult,
  AutomationRunLog,
  DryRunResult,
  DryRunStep,
  HealthStatus,
  RunLogStatus,
} from "@/lib/automation-runs";

export { supabaseAdmin };

interface ExecuteAutomationInput {
  automationId: string;
  triggeredBy: string;
  isDryRun: boolean;
  triggerPayload?: Record<string, any>;
}

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

    if (!actions.length) {
      status = "skipped";
      actionsExecuted = [
        {
          action: "validate_flow",
          status: "skipped",
          result: { reason: "Nessuna action configurata" },
        },
      ];
    } else {
      actionsExecuted = actions.map((action, index) => simulateAction(action, index, isDryRun));
      const failed = actionsExecuted.find((action) => action.status === "error");
      if (failed) throw new Error(failed.error || "Action fallita");
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
  const { data: log, error: insertError } = await supabaseAdmin
    .from("automation_run_logs" as any)
    .insert({
      automation_id: automationId,
      triggered_by: triggeredBy,
      status,
      duration_ms: durationMs,
      trigger_payload: triggerPayload,
      actions_executed: actionsExecuted,
      error_message: errorMessage,
      is_dry_run: isDryRun,
    })
    .select("*")
    .single();
  if (insertError) throw insertError;

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

  return log as unknown as AutomationRunLog;
}

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

export function computeHealth(logs: Pick<AutomationRunLog, "status">[]): HealthStatus {
  if (!logs.length) return "never_run";
  const lastThree = logs.slice(0, 3);
  if (lastThree.length === 3 && lastThree.every((log) => log.status === "error")) return "failing";
  const lastFive = logs.slice(0, 5);
  if (lastFive.some((log) => log.status === "error")) return "degraded";
  if (lastFive.every((log) => log.status === "success")) return "healthy";
  return "degraded";
}

function extractActions(flow: any) {
  const fromColumn = Array.isArray(flow.actions_definition) ? flow.actions_definition : null;
  if (fromColumn?.length) return fromColumn;

  const wizardActions = flow.flow_definition?.meta?.wizard?.actions_definition;
  if (Array.isArray(wizardActions) && wizardActions.length) return wizardActions;

  const nodeActions = flow.flow_definition?.nodes
    ?.filter((node: any) => node.type === "action")
    .map((node: any) => ({
      type: node.data?.label || "action",
      config: node.data?.config || {},
    }));
  return Array.isArray(nodeActions) ? nodeActions : [];
}

function extractDryRunBlocks(flow: any) {
  const blocks: any[] = [];
  const trigger =
    flow.trigger_definition || flow.flow_definition?.meta?.wizard?.trigger_definition || null;
  if (trigger) blocks.push({ type: "trigger", ...trigger });

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

function simulateBlock(block: any, index: number): DryRunStep {
  const type = normalizeBlockType(block);
  const label = String(block.label || block.name || block.action || block.type || block.data?.label || type);

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

function normalizeBlockType(block: any): DryRunStep["type"] {
  if (block.type === "trigger" || block.type === "condition" || block.type === "action") {
    return block.type;
  }
  if (block.data?.type === "trigger" || block.data?.type === "condition" || block.data?.type === "action") {
    return block.data.type;
  }
  return "action";
}

function simulateAction(action: any, index: number, isDryRun: boolean): ActionResult {
  const actionName = String(
    action.type || action.action || action.data?.label || `Action ${index + 1}`,
  );
  if (action.config?.force_error || action.force_error) {
    return {
      action: actionName,
      status: "error",
      error: "Errore simulato dalla configurazione action",
    };
  }

  return {
    action: actionName,
    status: "success",
    result: isDryRun
      ? { mode: "dry_run", message: "Azione validata, nessun effetto applicato" }
      : { mode: "manual_run", message: "Azione registrata dal runtime controllato" },
  };
}
