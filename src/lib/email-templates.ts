import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EMAIL_EVENT_TYPES, type EmailEventType } from "@/types/email";

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

export const listEmailTemplates = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const { listEmailTemplatesServer } = await import("@/lib/email-templates.server");
    return listEmailTemplatesServer(data);
  });

export const getEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; eventType: EmailEventType }) => data)
  .handler(async ({ data }) => {
    const { getEmailTemplateServer } = await import("@/lib/email-templates.server");
    return getEmailTemplateServer(data);
  });

export const updateEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TemplateUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { updateEmailTemplateServer } = await import("@/lib/email-templates.server");
    return updateEmailTemplateServer(data);
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TestEmailSchema.parse(data))
  .handler(async ({ data }) => {
    const { sendTestEmailServer } = await import("@/lib/email-templates.server");
    return sendTestEmailServer(data);
  });

export const createDefaultEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CreateTemplateSchema.parse(data))
  .handler(async ({ data }) => {
    const { createDefaultEmailTemplateServer } = await import("@/lib/email-templates.server");
    return createDefaultEmailTemplateServer(data);
  });

export const resetEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CreateTemplateSchema.parse(data))
  .handler(async ({ data }) => {
    const { resetEmailTemplateServer } = await import("@/lib/email-templates.server");
    return resetEmailTemplateServer(data);
  });

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
