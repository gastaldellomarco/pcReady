import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mergeAppSettingsRows } from "@/lib/app-settings";
import { sendEmail } from "@/lib/email-templates";
import type { EmailEventType } from "@/types/email";

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

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{[a-z0-9_]+\}\}/gi, (token) => values[token] ?? values[token.slice(2, -2)] ?? "");
}

export async function getEmailTemplateByEvent(eventType: EmailEventType): Promise<EmailTemplateRow | null> {
  const { data, error } = await supabaseAdmin
    .from("email_templates" as any)
    .select("*")
    .eq("event_type", eventType)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("getEmailTemplateByEvent failed:", error);
    return null;
  }

  return (data as unknown as EmailTemplateRow | null) ?? null;
}

export async function fetchEmailForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    console.error("fetchEmailForUser failed:", error);
    return null;
  }
  return data.user?.email ?? null;
}

export async function fetchProfileName(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("fetchProfileName failed:", error);
    return "Utente";
  }

  return data?.full_name || "Utente";
}

export async function userAllowsEmail(userId: string, preference: "notify_ticket_assigned" | "notify_checklist_completed"): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles" as any)
    .select(preference)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42703") {
      console.warn(`Email preference column "${preference}" missing; using default enabled.`);
      return true;
    }
    console.error("userAllowsEmail failed:", error);
    return false;
  }

  return !data || (data as any)[preference] !== false;
}

export async function getEmailCommonVariables(userId?: string | null, userEmail?: string | null) {
  const { data, error } = await supabaseAdmin.from("app_settings" as any).select("key, value");
  if (error) console.error("getEmailCommonVariables settings failed:", error);
  const settings = mergeAppSettingsRows((data ?? []) as unknown as { key: string; value: unknown }[]);
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";

  return {
    appUrl,
    organizationName: settings.organization_name || "PCReady",
    supportEmail: settings.support_email || "",
    userName: userId ? await fetchProfileName(userId) : "Utente",
    userEmail: userEmail ?? "",
  };
}

export async function sendEmailEvent(params: {
  eventType: EmailEventType;
  to: string | null | undefined;
  variables: Record<string, string>;
}): Promise<void> {
  if (!params.to) return;

  const template = await getEmailTemplateByEvent(params.eventType);
  if (!template) return;

  const subject = renderTemplate(template.subject, params.variables);
  const html = renderTemplate(template.body_html, params.variables);
  const text = template.body_text ? renderTemplate(template.body_text, params.variables) : undefined;

  await sendEmail(params.to, subject, html, text);
}
