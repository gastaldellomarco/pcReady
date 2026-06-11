import { promises as dns } from "dns";
import ipaddr from "ipaddr.js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email-templates.server";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications";
import { notifyDeviceStatusChangedForAdmins } from "@/lib/notifications.server";
import type { ActionResult } from "@/lib/automation-runs";

// ─── Types ────────────────────────────────────────────────────────────

/** A single action record extracted from flow config or wizard. */
export interface FlowAction {
  id?: string;
  type?: string;
  action?: string;
  label?: string;
  config?: Record<string, unknown>;
  data?: Record<string, unknown>;
  force_error?: unknown;
}

// ─── Constants ────────────────────────────────────────────────────────

export const TICKET_STATUSES = ["pending", "in-progress", "testing", "ready"] as const;
export const DEVICE_STATUSES = ["available", "assigned", "maintenance", "retired"] as const;

// ─── Zod Schemas ──────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────

export function isPrivateIP(ip: string): boolean {
  try {
    const cleaned = ip.split("%")[0];
    const addr = ipaddr.parse(cleaned);
    const range = addr.range();
    const blocked = [
      "private",
      "loopback",
      "linkLocal",
      "uniqueLocal",
      "unspecified",
      "reserved",
      "multicast",
    ];
    return blocked.includes(range);
  } catch {
    return false;
  }
}

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

// ─── Action Executors ─────────────────────────────────────────────────

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
  const delayMs = parsed.data.amount * (parsed.data.unit === "days" ? 86_400_000 : 3_600_000);
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

/**
 * Invia un webhook HTTP POST con protezioni SSRF (DNS resolve + block IP private).
 * Esportata per test di sicurezza.
 */
export async function webhookAction(
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
    const parsedUrl = new URL(parsed.data.url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Protocollo non consentito per webhook");
    }

    const allowlist = process.env.ALLOWED_WEBHOOK_HOSTS;
    if (allowlist && allowlist.trim()) {
      const host = parsedUrl.hostname.toLowerCase();
      const allowed = allowlist
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const ok = allowed.some((a) => host === a || host.endsWith("." + a));
      if (!ok) throw new Error("Webhook destinazione non in allowlist");
    }

    const addrs = await dns.lookup(parsedUrl.hostname, { all: true });
    for (const a of addrs) {
      if (isPrivateIP(a.address)) {
        throw new Error("SSRF: destinazione non consentata");
      }
    }

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

// ─── Action Dispatcher ────────────────────────────────────────────────

/**
 * Esegue una singola action dispatciando al giusto executor in base al tipo normalizzato.
 */
export async function executeAction(
  action: FlowAction,
  index: number,
  triggeredBy: string,
  triggerPayload: Record<string, unknown>,
): Promise<ActionResult> {
  const rawType = String(
    action.type || action.action || action.data?.label || `action_${index + 1}`,
  );
  const type = normalizeActionType(rawType);
  const actionLabel = String(action.label || rawType);
  const actionId = action.id ? String(action.id) : undefined;
  const config = action.config ?? action.data?.config ?? {};

  if ((config as Record<string, unknown>).force_error || action.force_error) {
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
