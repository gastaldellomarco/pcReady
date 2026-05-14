import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email-templates.server";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications";
import {
  createNotificationForAdmins,
  notifyDeviceStatusChangedForAdmins,
} from "@/lib/notifications.server";
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
    .select("*")
    .single();
  if (insertError) throw insertError;
  return log as unknown as AutomationRunLog;
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
      id: node.id,
      type: node.data?.actionType || node.data?.label || "action",
      label: node.data?.label || node.data?.actionType || "action",
      config: node.data?.config || {},
    }));
  return Array.isArray(nodeActions) ? nodeActions : [];
}

type GraphExecutionBlock =
  | { kind: "condition"; node: any }
  | { kind: "action"; action: any };

function extractGraphExecutionBlocks(flow: any, triggerPayload: Record<string, any>) {
  const nodes = Array.isArray(flow.flow_definition?.nodes) ? flow.flow_definition.nodes : [];
  const edges = Array.isArray(flow.flow_definition?.edges) ? flow.flow_definition.edges : [];
  if (!nodes.some((node: any) => node.data?.type === "condition" || node.type === "condition")) {
    return [];
  }

  const byId = new Map<string, any>(nodes.map((node: any) => [String(node.id), node]));
  const trigger =
    nodes.find((node: any) => node.data?.type === "trigger" || node.type === "trigger") ??
    nodes[0];
  const blocks: GraphExecutionBlock[] = [];
  const visited = new Set<string>();
  let current = trigger;

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

function nextNodeForBranch(
  node: any,
  edges: any[],
  byId: Map<string, any>,
  passed: boolean,
) {
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

function getPath(source: Record<string, any>, path: string) {
  if (!path) return undefined;
  return path.split(".").reduce<any>((current, key) => current?.[key], source);
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

function normalizeBlockType(block: any): DryRunStep["type"] {
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

function simulateAction(action: any, index: number): ActionResult {
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

const TICKET_STATUSES = ["pending", "in-progress", "testing", "ready"] as const;
const DEVICE_STATUSES = ["available", "assigned", "maintenance", "retired"] as const;

const NotificationTypeSchema = z.enum(
  NOTIFICATION_TYPES as unknown as [NotificationType, ...NotificationType[]],
);

const optionalUuid = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().uuid().optional(),
);

const requiredUuid = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().uuid({ message: "UUID obbligatorio" }),
);

const SendEmailConfigSchema = z.object({
  to: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.string().email().optional(),
  ),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50_000),
  is_html: z.boolean().optional(),
});

const UpdateTicketStatusConfigSchema = z.object({
  ticket_id: optionalUuid,
  status: z.enum(TICKET_STATUSES),
});

const CreateNotificationConfigSchema = z.object({
  user_id: optionalUuid,
  type: NotificationTypeSchema.optional(),
  title: z.string().min(1).max(160),
  body: z.string().max(1000).nullable().optional(),
  link: z.string().max(500).nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
});

const UpdateDeviceStatusConfigSchema = z.object({
  device_id: optionalUuid,
  status: z.enum(DEVICE_STATUSES),
});

const AssignTicketConfigSchema = z.object({
  ticket_id: optionalUuid,
  assignee_id: requiredUuid,
});

const DelayConfigSchema = z.object({
  amount: z.number().int().positive().max(365),
  unit: z.enum(["hours", "days"]),
});

const WebhookConfigSchema = z.object({
  url: z.string().url(),
  payload: z.string().optional(),
});

function normalizeActionType(type: string): string {
  if (type === "update_status") return "update_ticket_status";
  if (type === "assign_technician") return "assign_ticket";
  if (type === "Webhook") return "send_webhook";
  if (type === "Aspetta") return "delay";
  return type;
}

function resolveId(
  key: string,
  config: Record<string, unknown>,
  triggerPayload: Record<string, any>,
): string | null {
  const direct = config[key];
  if (typeof direct === "string" && direct.length > 0) return direct;
  const fromPayload = triggerPayload[key];
  if (typeof fromPayload === "string" && fromPayload.length > 0) return fromPayload;
  return null;
}

function resolveRecipientEmail(
  config: Record<string, unknown>,
  triggerPayload: Record<string, any>,
): string | null {
  const direct = config.to;
  if (typeof direct === "string" && direct.includes("@")) return direct.trim();
  const keys = ["to_email", "customer_email", "requester_email", "recipient_email", "email"];
  for (const k of keys) {
    const v = triggerPayload[k];
    if (typeof v === "string" && v.includes("@")) return v.trim();
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function deliverAutomationEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ via: "smtp" }> {
  const textBody = params.text ?? stripHtml(params.html);

  await sendEmail(params.to, params.subject, params.html, textBody);
  return { via: "smtp" };
}

async function sendEmailAction(
  rawConfig: Record<string, any>,
  triggerPayload: Record<string, any>,
  actionLabel: string,
): Promise<ActionResult> {
  const parsed = SendEmailConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      action: actionLabel,
      status: "error",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const to = parsed.data.to ?? resolveRecipientEmail(rawConfig, triggerPayload);
  if (!to) {
    return {
      action: actionLabel,
      status: "error",
      error:
        "Destinatario email mancante: imposta config.to o includi un indirizzo nel trigger payload",
    };
  }

  const html =
    parsed.data.is_html === true
      ? parsed.data.body
      : `<div style="font-family:system-ui,sans-serif">${parsed.data.body.replace(/\n/g, "<br/>")}</div>`;

  try {
    const { via } = await deliverAutomationEmail({
      to,
      subject: parsed.data.subject,
      html,
      text: parsed.data.is_html === true ? stripHtml(parsed.data.body) : parsed.data.body,
    });
    return {
      action: actionLabel,
      status: "success",
      details: { channel: via, to },
      result: { message: "Email inviata", channel: via },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e ?? "Errore invio email");
    return { action: actionLabel, status: "error", error: msg };
  }
}

async function updateTicketStatusAction(
  rawConfig: Record<string, any>,
  triggerPayload: Record<string, any>,
  actionLabel: string,
): Promise<ActionResult> {
  const parsed = UpdateTicketStatusConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      action: actionLabel,
      status: "error",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const ticketId = resolveId("ticket_id", parsed.data as Record<string, unknown>, triggerPayload);
  if (!ticketId) {
    return {
      action: actionLabel,
      status: "error",
      error: "ticket_id mancante nella config o nel trigger payload",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .update({ status: parsed.data.status })
    .eq("id", ticketId)
    .select("id, status")
    .maybeSingle();

  if (error) return { action: actionLabel, status: "error", error: error.message };
  if (!data) return { action: actionLabel, status: "error", error: "Ticket non trovato" };

  return {
    action: actionLabel,
    status: "success",
    details: { ticket_id: data.id, status: data.status },
    result: { message: "Stato ticket aggiornato" },
  };
}

async function createNotificationAction(
  rawConfig: Record<string, any>,
  triggerPayload: Record<string, any>,
  triggeredBy: string,
  actionLabel: string,
): Promise<ActionResult> {
  const parsed = CreateNotificationConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      action: actionLabel,
      status: "error",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const userId =
    parsed.data.user_id ??
    (typeof triggerPayload.assignee_id === "string" ? triggerPayload.assignee_id : null) ??
    (typeof triggerPayload.user_id === "string" ? triggerPayload.user_id : null);
  if (!userId) {
    return {
      action: actionLabel,
      status: "error",
      error: "user_id mancante: imposta nella config o passa assignee_id nel trigger payload",
    };
  }

  const type: NotificationType = parsed.data.type ?? "ticket_status_changed";
  const payload = {
    ...(parsed.data.payload ?? {}),
    automation_triggered_by: triggeredBy,
  };

  const { data, error } = await supabaseAdmin
    .from("notifications" as any)
    .insert({
      user_id: userId,
      type,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      payload,
      link: parsed.data.link ?? null,
    })
    .select("id, user_id, type")
    .single();

  if (error) return { action: actionLabel, status: "error", error: error.message };
  const row = data as unknown as { id: string; user_id: string; type: string } | null;
  if (!row) return { action: actionLabel, status: "error", error: "Notifica non creata" };

  return {
    action: actionLabel,
    status: "success",
    details: { notification_id: row.id, user_id: row.user_id, type: row.type },
    result: { message: "Notifica creata" },
  };
}

async function updateDeviceStatusAction(
  rawConfig: Record<string, any>,
  triggerPayload: Record<string, any>,
  actionLabel: string,
): Promise<ActionResult> {
  const parsed = UpdateDeviceStatusConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      action: actionLabel,
      status: "error",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const deviceId = resolveId("device_id", parsed.data as Record<string, unknown>, triggerPayload);
  if (!deviceId) {
    return {
      action: actionLabel,
      status: "error",
      error: "device_id mancante nella config o nel trigger payload",
    };
  }

  const { data: before, error: beforeErr } = await supabaseAdmin
    .from("devices")
    .select("id, model, serial, status")
    .eq("id", deviceId)
    .maybeSingle();
  if (beforeErr) return { action: actionLabel, status: "error", error: beforeErr.message };
  if (!before) return { action: actionLabel, status: "error", error: "Dispositivo non trovato" };

  const previousStatus = String((before as { status: string }).status);

  const { data, error } = await supabaseAdmin
    .from("devices")
    .update({ status: parsed.data.status })
    .eq("id", deviceId)
    .select("id, model, serial, status")
    .maybeSingle();

  if (error) return { action: actionLabel, status: "error", error: error.message };
  if (!data) return { action: actionLabel, status: "error", error: "Dispositivo non trovato" };

  const row = data as { id: string; model: string; serial: string | null; status: string };
  const deviceLabel = [row.model, row.serial].filter(Boolean).join(" · ") || row.model;
  if (
    (parsed.data.status === "maintenance" || parsed.data.status === "retired") &&
    previousStatus !== parsed.data.status
  ) {
    await notifyDeviceStatusChangedForAdmins({
      deviceId: row.id,
      deviceName: deviceLabel,
      status: parsed.data.status,
      previousStatus,
    });
  }

  return {
    action: actionLabel,
    status: "success",
    details: { device_id: row.id, status: row.status },
    result: { message: "Stato dispositivo aggiornato" },
  };
}

async function assignTicketAction(
  rawConfig: Record<string, any>,
  triggerPayload: Record<string, any>,
  actionLabel: string,
): Promise<ActionResult> {
  const parsed = AssignTicketConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      action: actionLabel,
      status: "error",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const ticketId = resolveId("ticket_id", parsed.data as Record<string, unknown>, triggerPayload);
  if (!ticketId) {
    return {
      action: actionLabel,
      status: "error",
      error: "ticket_id mancante nella config o nel trigger payload",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("tickets")
    .update({ assignee_id: parsed.data.assignee_id })
    .eq("id", ticketId)
    .select("id, assignee_id")
    .maybeSingle();

  if (error) return { action: actionLabel, status: "error", error: error.message };
  if (!data) return { action: actionLabel, status: "error", error: "Ticket non trovato" };

  return {
    action: actionLabel,
    status: "success",
    details: { ticket_id: data.id, assignee_id: data.assignee_id },
    result: { message: "Ticket assegnato" },
  };
}

function delayAction(
  rawConfig: Record<string, any>,
  actionLabel: string,
  actionId?: string,
): ActionResult {
  const config = {
    ...rawConfig,
    amount: Number(rawConfig.amount ?? 1),
    unit: rawConfig.unit === "days" ? "days" : "hours",
  };
  const parsed = DelayConfigSchema.safeParse(config);
  if (!parsed.success) {
    return {
      action: actionLabel,
      blockId: actionId,
      blockType: "action",
      status: "error",
      input: rawConfig,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const delayMs =
    parsed.data.amount * (parsed.data.unit === "days" ? 86_400_000 : 3_600_000);
  return {
    action: actionLabel,
    blockId: actionId,
    blockType: "action",
    status: "success",
    input: rawConfig,
    details: { amount: parsed.data.amount, unit: parsed.data.unit, delay_ms: delayMs },
    result: {
      message: "Delay registrato; l'esecuzione differita richiede una coda/scheduler dedicata.",
    },
  };
}

async function webhookAction(
  rawConfig: Record<string, any>,
  triggerPayload: Record<string, any>,
  actionLabel: string,
  actionId?: string,
): Promise<ActionResult> {
  const parsed = WebhookConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    return {
      action: actionLabel,
      blockId: actionId,
      blockType: "action",
      status: "error",
      input: rawConfig,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  let payload: unknown = triggerPayload;
  if (parsed.data.payload?.trim()) {
    try {
      payload = JSON.parse(
        parsed.data.payload
          .replaceAll("{{trigger}}", String(triggerPayload._automation_trigger ?? "automation"))
          .replaceAll("{{ticket_id}}", String(triggerPayload.ticket_id ?? "")),
      );
    } catch {
      return {
        action: actionLabel,
        blockId: actionId,
        blockType: "action",
        status: "error",
        input: rawConfig,
        error: "Payload webhook non e JSON valido",
      };
    }
  }

  try {
    const response = await fetch(parsed.data.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        action: actionLabel,
        blockId: actionId,
        blockType: "action",
        status: "error",
        input: { url: parsed.data.url, payload },
        error: `Webhook HTTP ${response.status}: ${text.slice(0, 500)}`,
      };
    }
    return {
      action: actionLabel,
      blockId: actionId,
      blockType: "action",
      status: "success",
      input: { url: parsed.data.url, payload },
      details: { status: response.status },
      result: { message: "Webhook inviato", response: text.slice(0, 1000) },
    };
  } catch (error) {
    return {
      action: actionLabel,
      blockId: actionId,
      blockType: "action",
      status: "error",
      input: { url: parsed.data.url, payload },
      error: error instanceof Error ? error.message : "Errore invio webhook",
    };
  }
}

async function executeAction(
  action: any,
  index: number,
  triggeredBy: string,
  triggerPayload: Record<string, any>,
): Promise<ActionResult> {
  const rawType = String(
    action.type || action.action || action.data?.label || `action_${index + 1}`,
  );
  const type = normalizeActionType(rawType);
  const actionLabel = String(action.label || rawType);
  const actionId = action.id ? String(action.id) : undefined;
  const config = action.config ?? action.data?.config ?? {};

  if (config.force_error || action.force_error) {
    return {
      action: actionLabel,
      blockId: actionId,
      blockType: "action",
      status: "error",
      input: config,
      error: "Errore simulato dalla configurazione action",
    };
  }

  switch (type) {
    case "delay":
      return delayAction(config, actionLabel, actionId);
    case "send_webhook":
      return webhookAction(config, triggerPayload, actionLabel, actionId);
    case "send_email":
      return sendEmailAction(config, triggerPayload, actionLabel);
    case "update_ticket_status":
      return updateTicketStatusAction(config, triggerPayload, actionLabel);
    case "create_notification":
      return createNotificationAction(config, triggerPayload, triggeredBy, actionLabel);
    case "update_device_status":
      return updateDeviceStatusAction(config, triggerPayload, actionLabel);
    case "assign_ticket":
      return assignTicketAction(config, triggerPayload, actionLabel);
    case "create_ticket":
      return {
        action: actionLabel,
        blockId: actionId,
        blockType: "action",
        status: "skipped",
        input: config,
        error: "Tipo create_ticket non ancora implementato nel runtime",
      };
    default:
      return {
        action: actionLabel,
        blockId: actionId,
        blockType: "action",
        status: "skipped",
        input: config,
        error: "Tipo azione non supportato",
        details: { normalized_type: type },
      };
  }
}
