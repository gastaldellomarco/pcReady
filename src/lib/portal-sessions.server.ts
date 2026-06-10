import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppBaseUrl } from "@/lib/server-utils";

// ─── Types ────────────────────────────────────────────────────────────

export interface PortalBranding {
  portalName: string;
  logoUrl: string | null;
  primaryColor: string;
  welcomeMessage: string | null;
}

export interface PortalSessionContext {
  token: string;
  sessionId: string;
  clientId: string;
  contactId: string;
  contactEmail: string;
  contactName: string | null;
  contactPhone?: string | null;
  contactRole?: string | null;
  contactJobTitle?: string | null;
  clientName: string;
  branding: PortalBranding;
  preferredLanguage?: string | null;
  twoFAEnabled?: boolean;
  notificationPreferences?: Record<string, boolean> | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function clientBranding(client: any): PortalBranding {
  const clientName = client?.company_name || client?.name || "Cliente";
  return {
    portalName: client?.portal_name || `Portale IT - ${clientName}`,
    logoUrl: client?.portal_logo_url || null,
    primaryColor: client?.portal_primary_color || "#1B4FD8",
    welcomeMessage: client?.portal_welcome_message || null,
  };
}

function portalBaseUrl(): string {
  return getAppBaseUrl();
}

export function portalLoginUrl(token: string): string {
  return `${portalBaseUrl().replace(/\/$/, "")}/portal?token=${encodeURIComponent(token)}`;
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Creates a new portal session for a contact.
 * Returns the session token, login URL, and expiry.
 */
export async function createPortalSession(
  contact: any,
  ttlHours = 24,
): Promise<{ token: string; loginUrl: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * ttlHours).toISOString();

  const { error: insertError } = await supabaseAdmin.from("portal_sessions" as any).insert({
    token_hash: hashToken(token),
    client_id: contact.client_id,
    contact_id: contact.id,
    expires_at: expiresAt,
  });

  if (insertError) throw insertError;

  return { token, loginUrl: portalLoginUrl(token), expiresAt };
}

/**
 * Validates a portal session token and returns the session context.
 * Throws Response with 401/403 on invalid, revoked, or expired sessions.
 */
export async function getPortalSession(token: string): Promise<PortalSessionContext> {
  const { data, error } = await supabaseAdmin
    .from("portal_sessions" as any)
    .select(
      "id, client_id, contact_id, expires_at, revoked_at, client:clients(id, name, company_name, portal_enabled, portal_logo_url, portal_primary_color, portal_welcome_message, portal_name), contact:client_contacts(id, full_name, email, phone, role, job_title, preferred_language, portal_2fa_enabled, notification_preferences)",
    )
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Response("Sessione portale non valida", { status: 401 });
  if ((data as any).revoked_at) throw new Response("Sessione portale revocata", { status: 401 });
  if (new Date((data as any).expires_at).getTime() < Date.now()) {
    throw new Response("Sessione portale scaduta", { status: 401 });
  }
  if ((data as any).client?.portal_enabled === false) {
    throw new Response("Accesso portale disabilitato", { status: 403 });
  }

  await supabaseAdmin
    .from("portal_sessions" as any)
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", (data as any).id);

  return {
    token,
    sessionId: (data as any).id,
    clientId: (data as any).client_id,
    contactId: (data as any).contact_id,
    contactEmail: (data as any).contact?.email || "",
    contactName: (data as any).contact?.full_name || null,
    contactPhone: (data as any).contact?.phone || null,
    contactRole: (data as any).contact?.role || null,
    contactJobTitle: (data as any).contact?.job_title || null,
    clientName: (data as any).client?.company_name || (data as any).client?.name || "Cliente",
    branding: clientBranding((data as any).client),
    preferredLanguage: (data as any).contact?.preferred_language || null,
    twoFAEnabled: (data as any).contact?.portal_2fa_enabled ?? false,
    notificationPreferences: (data as any).contact?.notification_preferences || null,
  };
}

/**
 * Wrapper so validatePortalSession client wrapper can pass { token } object
 * instead of a raw string.
 */
export async function validatePortalSessionServer(input: { token: string }) {
  return getPortalSession(input.token);
}

/**
 * Revokes a portal session by token.
 */
export async function logoutPortalSessionServer(input: { token: string }) {
  await supabaseAdmin
    .from("portal_sessions" as any)
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashToken(input.token));
  return { success: true };
}
