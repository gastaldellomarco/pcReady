import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AUDIT_ACTIONS } from "@/lib/audit-log-actions";
import { sendEmail } from "@/lib/email-templates.server";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";
import { throwIfRateLimited } from "@/lib/rate-limit";

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
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function portalBaseUrl() {
  return process.env.APP_URL || process.env.VITE_APP_URL || "http://localhost:3000";
}

function hashPortalPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function verifyPortalPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algo, iterationsRaw, salt, hash] = stored.split("$");
  if (algo !== "pbkdf2_sha256" || !iterationsRaw || !salt || !hash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations)) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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
  throwIfRateLimited(`email:${email}`, RATE_LIMITER_KEYS.PORTAL_MAGIC_LINK);

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

export async function loginPortalWithPasswordServer(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  throwIfRateLimited(`password:${email}`, RATE_LIMITER_KEYS.PORTAL_MAGIC_LINK);

  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select(
      "id, client_id, full_name, email, portal_password_hash, clients!inner(id, name, company_name, portal_enabled)",
    )
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  if (!contact || (contact as any).clients?.portal_enabled === false) {
    throw new Response("Credenziali non valide", { status: 401 });
  }
  if (!verifyPortalPassword(input.password, (contact as any).portal_password_hash)) {
    throw new Response("Credenziali non valide", { status: 401 });
  }

  const { token, loginUrl, expiresAt } = await createPortalSession(contact, 24 * 7);
  return { success: true, token, loginUrl, expiresAt };
}

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
      "id, client_id, contact_id, expires_at, revoked_at, client:clients(id, name, company_name, portal_enabled, portal_logo_url, portal_primary_color, portal_welcome_message, portal_name), contact:client_contacts(id, full_name, email, phone, role, job_title)",
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
  };
}

export async function logoutPortalSessionServer(input: { token: string }) {
  await supabaseAdmin
    .from("portal_sessions" as any)
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashToken(input.token));
  return { success: true };
}
