import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email-templates";

export interface PortalSessionContext {
  token: string;
  sessionId: string;
  clientId: string;
  contactId: string;
  contactEmail: string;
  contactName: string | null;
  clientName: string;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function portalBaseUrl() {
  return process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";
}

export async function requestPortalLoginServer(input: { email: string }) {
  const email = input.email.trim().toLowerCase();

  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select("id, client_id, full_name, email, clients!inner(id, name, company_name, portal_enabled)")
    .ilike("email", email)
    .maybeSingle();

  if (error) throw error;

  if (!contact || (contact as any).clients?.portal_enabled === false) {
    return { success: true };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

  const { error: insertError } = await supabaseAdmin.from("portal_sessions" as any).insert({
    token_hash: hashToken(token),
    client_id: (contact as any).client_id,
    contact_id: (contact as any).id,
    expires_at: expiresAt,
  });

  if (insertError) throw insertError;

  const loginUrl = `${portalBaseUrl().replace(/\/$/, "")}/portal?token=${encodeURIComponent(token)}`;
  const clientName = (contact as any).clients?.company_name || (contact as any).clients?.name || "cliente";

  await sendEmail(
    email,
    "Accesso al portale PCReady",
    `<p>Ciao ${(contact as any).full_name || ""},</p><p>Usa questo link per accedere al portale PCReady di ${clientName}:</p><p><a href="${loginUrl}">${loginUrl}</a></p><p>Il link scade tra 24 ore.</p>`,
    `Accedi al portale PCReady: ${loginUrl}`,
  );

  return { success: true };
}

export async function getPortalSession(token: string): Promise<PortalSessionContext> {
  const { data, error } = await supabaseAdmin
    .from("portal_sessions" as any)
    .select(
      "id, client_id, contact_id, expires_at, revoked_at, client:clients(id, name, company_name, portal_enabled), contact:client_contacts(id, full_name, email)",
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
    clientName: (data as any).client?.company_name || (data as any).client?.name || "Cliente",
  };
}

export async function logoutPortalSessionServer(input: { token: string }) {
  await supabaseAdmin
    .from("portal_sessions" as any)
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashToken(input.token));
  return { success: true };
}
