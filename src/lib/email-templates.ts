import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EMAIL_EVENT_TYPES, type EmailEventType } from "@/types/email";
import {
  getTemplates,
  renderTemplate,
  type LegacyEmailTemplate,
} from "@/lib/email-templates-shared";

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

const ListTemplatesSchema = z.object({ accessToken: z.string().min(1) });
const GetTemplateSchema = z.object({ accessToken: z.string().min(1), eventType: EmailEventSchema })

export { getTemplates, renderTemplate, type LegacyEmailTemplate };

export const listEmailTemplates = createServerFn({ method: "POST" })
  .validator(ListTemplatesSchema)
  .handler(async ({ data }) => {
    const { listEmailTemplatesServer } = await import("@/lib/email-templates.server");
    return listEmailTemplatesServer(data);
  });

export const getEmailTemplate = createServerFn({ method: "POST" })
  .validator(GetTemplateSchema)
  .handler(async ({ data }) => {
    const { getEmailTemplateServer } = await import("@/lib/email-templates.server");
    return getEmailTemplateServer(data);
  });

export const updateEmailTemplate = createServerFn({ method: "POST" })
  .validator(TemplateUpdateSchema)
  .handler(async ({ data }) => {
    const { updateEmailTemplateServer } = await import("@/lib/email-templates.server");
    return updateEmailTemplateServer(data);
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .validator(TestEmailSchema)
  .handler(async ({ data }) => {
    const { sendTestEmailServer } = await import("@/lib/email-templates.server");
    return sendTestEmailServer(data);
  });

export const createDefaultEmailTemplate = createServerFn({ method: "POST" })
  .validator(CreateTemplateSchema)
  .handler(async ({ data }) => {
    const { createDefaultEmailTemplateServer } = await import("@/lib/email-templates.server");
    return createDefaultEmailTemplateServer(data);
  });

export const resetEmailTemplate = createServerFn({ method: "POST" })
  .validator(CreateTemplateSchema)
  .handler(async ({ data }) => {
    const { resetEmailTemplateServer } = await import("@/lib/email-templates.server");
    return resetEmailTemplateServer(data);
  });


