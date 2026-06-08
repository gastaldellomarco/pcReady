import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession, hashPortalPassword } from "@/lib/portal-auth.server";

/**
 *
 */
export async function updatePortalContactProfileServer(input: {
  token: string;
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  password?: string | null;
}) {
  const session = await getPortalSession(input.token);
  const fullName = input.fullName.trim();
  if (!fullName) throw new Response("Nome e cognome obbligatori", { status: 400 });
  const [firstName, ...lastParts] = fullName.split(/\s+/);
  const payload: Record<string, unknown> = {
    full_name: fullName,
    first_name: firstName,
    last_name: lastParts.join(" ") || null,
    phone: input.phone?.trim() || null,
    job_title: input.jobTitle?.trim() || null,
    role: input.jobTitle?.trim() || null,
  };
  if (input.password?.trim()) {
    if (input.password.length < 8)
      throw new Response("Password minimo 8 caratteri", { status: 400 });
    payload.portal_password_hash = hashPortalPassword(input.password);
    payload.portal_password_updated_at = new Date().toISOString();
  }
  const { error } = await supabaseAdmin
    .from("client_contacts" as any)
    .update(payload)
    .eq("id", session.contactId)
    .eq("client_id", session.clientId);
  if (error) throw error;
  return { success: true };
}

/**
 *
 */
export async function updatePortalContactLanguageServer(input: {
  token: string;
  language: "it" | "en";
}) {
  const session = await getPortalSession(input.token);
  const { error } = await supabaseAdmin
    .from("client_contacts" as any)
    .update({ preferred_language: input.language })
    .eq("id", session.contactId)
    .eq("client_id", session.clientId);
  if (error) throw error;
  return { success: true, language: input.language };
}

/**
 *
 */
export async function getPortalAccessHistoryServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const { data, error } = await supabaseAdmin
    .from("portal_sessions" as any)
    .select("id, created_at, last_used_at, expires_at, revoked_at")
    .eq("contact_id", session.contactId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return {
    sessions: ((data ?? []) as any[]).map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      lastUsedAt: s.last_used_at,
      expiresAt: s.expires_at,
      isRevoked: !!s.revoked_at,
      isActive: !s.revoked_at && new Date(s.expires_at).getTime() > Date.now(),
    })),
  };
}

/**
 *
 */
export async function updatePortalNotificationPreferencesServer(input: {
  token: string;
  preferences: Record<string, boolean>;
}) {
  const session = await getPortalSession(input.token);
  const allowedKeys = ["ticket_updated", "ticket_closed", "document_available", "bundle_expiring"];
  const cleaned: Record<string, boolean> = {};
  for (const key of allowedKeys) {
    cleaned[key] = input.preferences[key] ?? true;
  }
  const { error } = await supabaseAdmin
    .from("client_contacts" as any)
    .update({ notification_preferences: cleaned as any })
    .eq("id", session.contactId)
    .eq("client_id", session.clientId);
  if (error) throw error;
  return { success: true, preferences: cleaned };
}
