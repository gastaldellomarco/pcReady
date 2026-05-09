import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications";
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

function simulateAction(action: any, index: number): ActionResult {
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

function normalizeActionType(type: string): string {
  if (type === "update_status") return "update_ticket_status";
  if (type === "assign_technician") return "assign_ticket";
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
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function deliverAutomationEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ via: "resend" | "smtp" | "webhook" }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM || process.env.SENDGRID_FROM || "no-reply@example.com";
  const webhookUrl = process.env.EMAIL_TEST_WEBHOOK_URL || process.env.SMTP_WEBHOOK_URL;
  const textBody = params.text ?? stripHtml(params.html);

  if (RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (r.ok) return { via: "resend" };

    let errBody: unknown = null;
    try {
      errBody = await r.json();
    } catch {
      errBody = await r.text().catch(() => null);
    }
    const textErr = typeof errBody === "string" ? errBody : JSON.stringify(errBody);

    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: textBody,
          source: "automation",
        }),
      });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new Error(`Resend ${r.status} ${textErr}; webhook ${response.status} ${bodyText}`);
      }
      return { via: "webhook" };
    }

    throw new Error(`Resend API error ${r.status} ${textErr}`);
  }

  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_FROM = process.env.SMTP_FROM || RESEND_FROM;
  const SMTP_SECURE = String(process.env.SMTP_SECURE || "false") === "true";

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT ?? 587,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      await transporter.sendMail({
        from: SMTP_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: textBody,
      });
      return { via: "smtp" };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err ?? "");
      if (!webhookUrl) throw new Error(`SMTP fallito e nessun webhook: ${errMsg}`);
    }
  }

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: textBody,
        source: "automation",
      }),
    });
    const bodyText = await response.text().catch(() => "");
    if (!response.ok) throw new Error(`Webhook invio email fallito (${response.status}) ${bodyText}`);
    return { via: "webhook" };
  }

  throw new Error(
    "Nessun canale email configurato: imposta RESEND_API_KEY, variabili SMTP o EMAIL_TEST_WEBHOOK_URL",
  );
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
      error: "Destinatario email mancante: imposta config.to o includi un indirizzo nel trigger payload",
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

  const { data, error } = await supabaseAdmin
    .from("devices")
    .update({ status: parsed.data.status })
    .eq("id", deviceId)
    .select("id, status")
    .maybeSingle();

  if (error) return { action: actionLabel, status: "error", error: error.message };
  if (!data) return { action: actionLabel, status: "error", error: "Dispositivo non trovato" };

  return {
    action: actionLabel,
    status: "success",
    details: { device_id: data.id, status: data.status },
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

async function executeAction(
  action: any,
  index: number,
  triggeredBy: string,
  triggerPayload: Record<string, any>,
): Promise<ActionResult> {
  const rawType = String(action.type || action.action || action.data?.label || `action_${index + 1}`);
  const type = normalizeActionType(rawType);
  const actionLabel = rawType;
  const config = action.config ?? action.data?.config ?? {};

  if (config.force_error || action.force_error) {
    return {
      action: actionLabel,
      status: "error",
      error: "Errore simulato dalla configurazione action",
    };
  }

  switch (type) {
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
        status: "skipped",
        error: "Tipo create_ticket non ancora implementato nel runtime",
      };
    default:
      return {
        action: actionLabel,
        status: "skipped",
        error: "Tipo azione non supportato",
        details: { normalized_type: type },
      };
  }
}
