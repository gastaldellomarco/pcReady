import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AUDIT_ACTIONS } from "@/lib/audit-log-actions";
import { sendEmail } from "@/lib/email-templates.server";

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

function portalLoginUrl(token: string) {
  return `${portalBaseUrl().replace(/\/$/, "")}/portal?token=${encodeURIComponent(token)}`;
}

async function assertPortalLinkOperator(accessToken: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", ["admin", "tech"])
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) throw new Response("Permessi insufficienti", { status: 403 });

  return userData.user;
}

async function createPortalSession(contact: any, ttlHours = 24) {
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

export async function requestPortalLoginServer(input: { email: string; sendMail?: boolean }) {
  const email = input.email.trim().toLowerCase();

  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select(
      "id, client_id, full_name, email, clients!inner(id, name, company_name, portal_enabled)",
    )
    .ilike("email", email)
    .maybeSingle();

  if (error) throw error;

  if (!contact || (contact as any).clients?.portal_enabled === false) {
    return { success: true };
  }

  const { loginUrl, expiresAt } = await createPortalSession(contact, 24);
  const clientName =
    (contact as any).clients?.company_name || (contact as any).clients?.name || "cliente";

  if (input.sendMail !== false) {
    await sendEmail(
      email,
      "Accesso al portale PCReady",
      `<p>Ciao ${(contact as any).full_name || ""},</p><p>Usa questo link per accedere al portale PCReady di ${clientName}:</p><p><a href="${loginUrl}">${loginUrl}</a></p><p>Il link scade tra 24 ore.</p>`,
      `Accedi al portale PCReady: ${loginUrl}`,
    );
    return { success: true, sent: true };
  }

  return { success: true, sent: false, loginUrl, expiresAt };
}

export async function generatePortalAccessLinkServer(input: {
  accessToken: string;
  contactId: string;
  ttlHours?: number;
}) {
  const user = await assertPortalLinkOperator(input.accessToken);
  const ttlHours = input.ttlHours ?? 24;

  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select(
      "id, client_id, full_name, email, clients!inner(id, name, company_name, portal_enabled)",
    )
    .eq("id", input.contactId)
    .maybeSingle();
  if (error) throw error;
  if (!contact) throw new Response("Referente non trovato", { status: 404 });
  if ((contact as any).clients?.portal_enabled === false) {
    throw new Response("Portale disabilitato per questo cliente", { status: 403 });
  }

  const { loginUrl, expiresAt } = await createPortalSession(contact, ttlHours);
  const contactName = (contact as any).full_name || (contact as any).email || "referente";
  const clientName =
    (contact as any).clients?.company_name || (contact as any).clients?.name || "cliente";

  await supabaseAdmin.from("activity_log" as any).insert({
    type: "user",
    action_type: AUDIT_ACTIONS.PORTAL_LINK_GENERATED,
    actor_id: user.id,
    entity_type: "client_contact",
    entity_id: (contact as any).id,
    severity: "info",
    message: `Link portale generato per ${contactName} (${clientName})`,
    new_value: {
      contact_id: (contact as any).id,
      client_id: (contact as any).client_id,
      expires_at: expiresAt,
      generated_by: user.id,
    },
  });

  return {
    loginUrl,
    expiresAt,
    contactName,
    clientName,
  };
}

export async function revokePortalAccessLinkServer(input: {
  accessToken: string;
  contactId: string;
}) {
  const user = await assertPortalLinkOperator(input.accessToken);
  const now = new Date().toISOString();

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("client_contacts" as any)
    .select("id, client_id, full_name, email, clients(name, company_name)")
    .eq("id", input.contactId)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact) throw new Response("Referente non trovato", { status: 404 });

  const { data: revoked, error } = await supabaseAdmin
    .from("portal_sessions" as any)
    .update({ revoked_at: now })
    .eq("contact_id", input.contactId)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .select("id");
  if (error) throw error;

  const contactName = (contact as any).full_name || (contact as any).email || "referente";
  const clientName =
    (contact as any).clients?.company_name || (contact as any).clients?.name || "cliente";
  const revokedCount = Array.isArray(revoked) ? revoked.length : 0;

  await supabaseAdmin.from("activity_log" as any).insert({
    type: "user",
    action_type: AUDIT_ACTIONS.PORTAL_LINK_REVOKED,
    actor_id: user.id,
    entity_type: "client_contact",
    entity_id: (contact as any).id,
    severity: "info",
    message: `Accesso portale revocato per ${contactName} (${clientName})`,
    new_value: {
      contact_id: (contact as any).id,
      client_id: (contact as any).client_id,
      revoked_count: revokedCount,
      revoked_by: user.id,
      revoked_at: now,
    },
  });

  return { success: true, revokedCount };
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
