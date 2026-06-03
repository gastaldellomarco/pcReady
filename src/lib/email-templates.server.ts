import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-users.server";
import { getAppSettings } from "@/lib/app-settings";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";

export const EMAIL_TEMPLATE_SELECT =
  "id, event_type, subject, body_html, body_text, variables, is_active, last_modified_at, last_modified_by, created_at";
import {
  DEFAULT_TEMPLATES,
  EMAIL_EVENT_TYPES,
  EMAIL_TEMPLATE_VARIABLES,
  type EmailEventType,
  type EmailTemplate,
} from "@/types/email";

const EmailEventSchema = z.enum(EMAIL_EVENT_TYPES as [EmailEventType, ...EmailEventType[]]);

const TemplateUpdateSchema = z.object({
  accessToken: z.string().min(1),
  eventType: EmailEventSchema,
  subject: z.string().trim().min(1).max(240),
  bodyHtml: z.string().trim().min(1),
  bodyText: z.string().trim().optional().nullable(),
  isActive: z.boolean(),
});

const TestEmailSchema = z.object({
  accessToken: z.string().min(1),
  eventType: EmailEventSchema,
  recipientEmail: z.string().email(),
});

const CreateTemplateSchema = z.object({
  accessToken: z.string().min(1),
  eventType: EmailEventSchema,
});

const ResetTemplateSchema = CreateTemplateSchema;

type EmailTemplateRow = {
  id: string;
  event_type: EmailEventType;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: unknown;
  is_active: boolean;
  last_modified_at: string;
  last_modified_by: string | null;
  created_at: string;
};

type LegacyEmailTemplate = {
  id: string;
  subject: string;
  body: string;
};

const LEGACY_TEMPLATES: LegacyEmailTemplate[] = [
  {
    id: "ticket-assigned",
    subject: "Ticket {{ticket_code}} assegnato",
    body: "Ciao {{assignee_name}}, il ticket {{ticket_code}} per {{client_name}} ti e' stato assegnato.",
  },
];

/**
 *
 */
export function getTemplates() {
  return LEGACY_TEMPLATES;
}

/**
 *
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<void> {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;
  const SMTP_SECURE = process.env.SMTP_SECURE === "true";

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn("SMTP non configurato: email non inviata.");
    return;
  }

  if ("WebSocketPair" in globalThis) {
    console.warn(
      "SMTP diretto non supportato in Cloudflare Workers: email non inviata. " +
        "Configurare un provider HTTP per l'invio email in produzione.",
    );
    return;
  }

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
    text,
  });

  console.log("Email inviata:", info.messageId);
}

/**
 *
 */
export async function listEmailTemplatesServer({ accessToken }: { accessToken: string }) {
  await requireAdmin(accessToken);
  await ensureDefaultTemplates();

  const { data, error } = await supabaseAdmin
    .from("email_templates" as any)
    .select(EMAIL_TEMPLATE_SELECT)
    .order("event_type");
  if (error) throw error;

  return hydrateTemplates((data ?? []) as unknown as EmailTemplateRow[]);
}

/**
 *
 */
export async function getEmailTemplateServer({
  accessToken,
  eventType,
}: {
  accessToken: string;
  eventType: EmailEventType;
}) {
  await requireAdmin(accessToken);
  const parsedEvent = EmailEventSchema.parse(eventType);
  await ensureDefaultTemplates();

  const { data, error } = await supabaseAdmin
    .from("email_templates" as any)
    .select(EMAIL_TEMPLATE_SELECT)
    .eq("event_type", parsedEvent)
    .single();
  if (error) throw error;

  return (await hydrateTemplates([data as unknown as EmailTemplateRow]))[0];
}

/**
 *
 */
export async function updateEmailTemplateServer(data: z.input<typeof TemplateUpdateSchema>) {
  const actorId = await requireAdmin(data.accessToken);
  const validated = TemplateUpdateSchema.parse(data);
  validateTemplateVariables(validated.eventType, [
    validated.subject,
    validated.bodyHtml,
    validated.bodyText ?? "",
  ]);

  const variables = EMAIL_TEMPLATE_VARIABLES[validated.eventType].map((variable) => variable.token);
  const { data: saved, error } = await supabaseAdmin
    .from("email_templates" as any)
    .upsert(
      {
        event_type: validated.eventType,
        subject: validated.subject,
        body_html: validated.bodyHtml,
        body_text: validated.bodyText || null,
        variables,
        is_active: validated.isActive,
        last_modified_at: new Date().toISOString(),
        last_modified_by: actorId,
      },
      { onConflict: "event_type" },
    )
    .select(EMAIL_TEMPLATE_SELECT)
    .single();
  if (error) throw error;

  return (await hydrateTemplates([saved as unknown as EmailTemplateRow]))[0];
}

/**
 *
 */
export async function sendTestEmailServer(data: z.input<typeof TestEmailSchema>) {
  const actorId = await requireAdmin(data.accessToken);
  throwIfRateLimited(actorId, RATE_LIMITER_KEYS.SEND_TEST_EMAIL);
  const validated = TestEmailSchema.parse(data);
  await ensureDefaultTemplates();

  const { data: template, error } = await supabaseAdmin
    .from("email_templates" as any)
    .select(EMAIL_TEMPLATE_SELECT)
    .eq("event_type", validated.eventType)
    .single();
  if (error) throw error;

  const settings = await getAppSettings({ data: { accessToken: validated.accessToken } });
  const row = template as unknown as EmailTemplateRow;
  const sample = buildSampleVariables(settings.organization_name, settings.support_email);
  const subject = renderTemplate(row.subject, sample);
  const html = renderTemplate(row.body_html, sample);
  const text = renderTemplate(row.body_text ?? "", sample);

  const delivered = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
  await sendEmail(validated.recipientEmail, subject, html, text);

  await supabaseAdmin.from("activity_log").insert({
    type: "sys",
    actor_id: actorId,
    message: delivered
      ? `Test email template "${validated.eventType}" inviato a ${validated.recipientEmail} via SMTP ${process.env.SMTP_HOST}.`
      : `Test email template "${validated.eventType}" preparato per ${validated.recipientEmail}. SMTP non configurato.`,
  });

  return { ok: true, delivered, subject };
}

/**
 *
 */
export async function createDefaultEmailTemplateServer(data: z.input<typeof CreateTemplateSchema>) {
  const actorId = await requireAdmin(data.accessToken);
  const validated = CreateTemplateSchema.parse(data);

  const defaults = defaultTemplates();
  const defaultTemplate = defaults.find((t) => t.event_type === validated.eventType);
  if (!defaultTemplate) {
    throw new Response(`Template di default non trovato per ${validated.eventType}`, {
      status: 404,
    });
  }

  // Insert or update the template
  const { data: saved, error } = await supabaseAdmin
    .from("email_templates" as any)
    .upsert(
      {
        event_type: validated.eventType,
        subject: defaultTemplate.subject,
        body_html: defaultTemplate.body_html,
        body_text: defaultTemplate.body_text,
        variables: defaultTemplate.variables,
        is_active: true,
        last_modified_at: new Date().toISOString(),
        last_modified_by: actorId,
      },
      { onConflict: "event_type" },
    )
    .select(EMAIL_TEMPLATE_SELECT)
    .single();
  if (error) throw error;

  return (await hydrateTemplates([saved as unknown as EmailTemplateRow]))[0];
}

/**
 *
 */
export async function resetEmailTemplateServer(data: z.input<typeof ResetTemplateSchema>) {
  const actorId = await requireAdmin(data.accessToken);
  const validated = ResetTemplateSchema.parse(data);
  const defaultTemplate = DEFAULT_TEMPLATES[validated.eventType];
  const variables = EMAIL_TEMPLATE_VARIABLES[validated.eventType].map((variable) => variable.token);

  const { data: saved, error } = await supabaseAdmin
    .from("email_templates" as any)
    .upsert(
      {
        event_type: validated.eventType,
        subject: defaultTemplate.subject,
        body_html: defaultTemplate.body_html,
        body_text: defaultTemplate.body_text,
        variables,
        is_active: true,
        last_modified_at: new Date().toISOString(),
        last_modified_by: actorId,
      },
      { onConflict: "event_type" },
    )
    .select(EMAIL_TEMPLATE_SELECT)
    .single();
  if (error) throw error;

  return (await hydrateTemplates([saved as unknown as EmailTemplateRow]))[0];
}

async function ensureDefaultTemplates() {
  const defaults = defaultTemplates();
  const { error } = await supabaseAdmin
    .from("email_templates" as any)
    .upsert(defaults, { onConflict: "event_type", ignoreDuplicates: true });
  if (error) throw error;
}

async function hydrateTemplates(rows: EmailTemplateRow[]) {
  const authorIds = rows
    .map((row) => row.last_modified_by)
    .filter((id): id is string => Boolean(id));
  const { data: profiles } = authorIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    subject: row.subject,
    body_html: row.body_html,
    body_text: row.body_text,
    variables: Array.isArray(row.variables) ? (row.variables as string[]) : [],
    is_active: row.is_active,
    last_modified_at: row.last_modified_at,
    last_modified_by: row.last_modified_by,
    last_modified_by_name: row.last_modified_by
      ? (profileById.get(row.last_modified_by) ?? null)
      : null,
    created_at: row.created_at,
  })) satisfies EmailTemplate[];
}

function validateTemplateVariables(eventType: EmailEventType, parts: string[]) {
  const allowed = new Set(EMAIL_TEMPLATE_VARIABLES[eventType].map((variable) => variable.token));
  const unknown = new Set<string>();

  for (const part of parts) {
    for (const match of part.matchAll(/\{\{[a-z0-9_]+\}\}/gi)) {
      if (!allowed.has(match[0])) unknown.add(match[0]);
    }
  }

  if (unknown.size) {
    throw new Response(`Variabili non valide: ${Array.from(unknown).join(", ")}`, { status: 400 });
  }
}

export function renderTemplate(template: string, values: Record<string, string>): string;
export function renderTemplate(
  template: LegacyEmailTemplate,
  values: Record<string, string>,
): { subject: string; body: string };
/**
 *
 */
export function renderTemplate(
  template: string | LegacyEmailTemplate,
  values: Record<string, string>,
) {
  if (typeof template === "string") {
    return replaceVariables(template, values);
  }

  return {
    subject: replaceVariables(template.subject, values),
    body: replaceVariables(template.body, values),
  };
}

function replaceVariables(template: string, values: Record<string, string>) {
  return template.replace(/\{\{[a-z0-9_]+\}\}/gi, (token) => {
    const bareToken = token.slice(2, -2);
    return values[token] ?? values[bareToken] ?? token;
  });
}

function buildSampleVariables(organizationName: string, supportEmail: string) {
  return {
    "{{organization_name}}": organizationName || "PCReady",
    "{{support_email}}": supportEmail || "support@pcready.it",
    "{{user_name}}": "Mario Rossi",
    "{{user_email}}": "mario.rossi@example.com",
    "{{invite_link}}": "https://app.pcready.it/auth/set-password#access_token=demo&type=invite",
    "{{reset_link}}": "https://app.pcready.it/auth/set-password#access_token=demo&type=recovery",
    "{{confirm_link}}": "https://app.pcready.it/auth/callback#access_token=demo&type=signup",
    "{{ticket_code}}": "PC-2026-0142",
    "{{ticket_title}}": "Preparazione notebook Lenovo ThinkPad",
    "{{ticket_link}}": "https://app.pcready.it/tickets?ticket=PC-2026-0142",
    "{{checklist_name}}": "Setup Windows 11 Pro",
    "{{client_name}}": "ACME Srl",
    "{{assignee_name}}": "Marco Gastaldello",
    "{{completed_date}}": "12 mag 2026",
    "{{pdf_link}}": "https://app.pcready.it/api/documents/verbale-PC-2026-0142.pdf?token=demo",
    "{{portal_link}}": "https://app.pcready.it/portal",
  };
}

function defaultTemplates() {
  return EMAIL_EVENT_TYPES.map((eventType) => ({
    event_type: eventType,
    ...DEFAULT_TEMPLATES[eventType],
  })).map((template) => ({
    ...template,
    variables: EMAIL_TEMPLATE_VARIABLES[template.event_type as EmailEventType].map(
      (variable) => variable.token,
    ),
    is_active: true,
  }));
}
