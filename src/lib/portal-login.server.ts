import { randomBytes, randomInt } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email-templates.server";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";
import { createPortalSession } from "./portal-sessions.server";
import { verifyPortalPassword } from "./portal-password.server";

/**
 * Sends a magic-link or 2FA code to a portal contact by email.
 */
export async function requestPortalLoginServer(input: { email: string; sendMail?: boolean }) {
  const email = input.email.trim().toLowerCase();
  throwIfRateLimited(`email:${email}`, RATE_LIMITER_KEYS.PORTAL_MAGIC_LINK);

  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select(
      "id, client_id, full_name, email, portal_2fa_enabled, clients!inner(id, name, company_name, portal_enabled)",
    )
    .ilike("email", email)
    .maybeSingle();

  if (error) throw error;

  if (!contact || (contact as any).clients?.portal_enabled === false) {
    return { success: true };
  }

  const clientName =
    (contact as any).clients?.company_name || (contact as any).clients?.name || "cliente";

  // ── 2FA check ──
  if ((contact as any).portal_2fa_enabled) {
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const pendingToken = randomBytes(32).toString("base64url");

    await supabaseAdmin
      .from("client_contacts" as any)
      .update({
        portal_2fa_pending_code: code,
        portal_2fa_pending_expires: expiresAt,
        portal_2fa_pending_login_token: pendingToken,
      })
      .eq("id", (contact as any).id);

    await sendEmail(
      email,
      "Codice di verifica - Portale PCReady",
      `<p>Ciao ${(contact as any).full_name || ""},</p><p>Il tuo codice di verifica per accedere al portale PCReady di ${clientName} è: <strong>${code}</strong></p><p>Il codice scade tra 10 minuti.</p>`,
      `Codice verifica portale: ${code}`,
    );

    return { success: true, requires2FA: true, pendingToken };
  }

  const { loginUrl, expiresAt } = await createPortalSession(contact, 24);

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

/**
 * Authenticates a portal contact with email + password.
 */
export async function loginPortalWithPasswordServer(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  throwIfRateLimited(`password:${email}`, RATE_LIMITER_KEYS.PORTAL_MAGIC_LINK);

  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select(
      "id, client_id, full_name, email, portal_password_hash, portal_2fa_enabled, clients!inner(id, name, company_name, portal_enabled)",
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

  // ── 2FA check ──
  if ((contact as any).portal_2fa_enabled) {
    const clientName =
      (contact as any).clients?.company_name || (contact as any).clients?.name || "cliente";
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const pendingToken = randomBytes(32).toString("base64url");

    await supabaseAdmin
      .from("client_contacts" as any)
      .update({
        portal_2fa_pending_code: code,
        portal_2fa_pending_expires: expiresAt,
        portal_2fa_pending_login_token: pendingToken,
      })
      .eq("id", (contact as any).id);

    await sendEmail(
      email,
      "Codice di verifica - Portale PCReady",
      `<p>Ciao ${(contact as any).full_name || ""},</p><p>Il tuo codice di verifica per accedere al portale PCReady di ${clientName} è: <strong>${code}</strong></p><p>Il codice scade tra 10 minuti.</p>`,
      `Codice verifica portale: ${code}`,
    );

    return { success: true, requires2FA: true, pendingToken };
  }

  const { token, loginUrl, expiresAt } = await createPortalSession(contact, 24 * 7);
  return { success: true, token, loginUrl, expiresAt };
}

/**
 * Verifies a 2FA code during portal login and creates the real session.
 */
export async function verifyPortalLogin2FAServer(input: { pendingToken: string; code: string }) {
  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select(
      "id, client_id, full_name, email, portal_2fa_pending_code, portal_2fa_pending_expires, clients!inner(id, name, company_name, portal_enabled)",
    )
    .eq("portal_2fa_pending_login_token", input.pendingToken)
    .maybeSingle();

  if (error) throw error;
  if (!contact) throw new Response("Token di verifica non valido o scaduto", { status: 400 });

  const c = contact as any;
  throwIfRateLimited(`verify2fa:${c.id}`, RATE_LIMITER_KEYS.PORTAL_2FA);

  if (!c.portal_2fa_pending_code) {
    throw new Response("Nessuna richiesta 2FA in corso", { status: 400 });
  }
  if (new Date(c.portal_2fa_pending_expires).getTime() < Date.now()) {
    throw new Response("Codice scaduto. Effettua nuovamente l'accesso.", { status: 400 });
  }
  if (c.portal_2fa_pending_code !== input.code) {
    throw new Response("Codice non valido", { status: 400 });
  }

  // Create the real session first, then clean up pending 2FA data
  const { token } = await createPortalSession(contact, 24 * 7);

  await supabaseAdmin
    .from("client_contacts" as any)
    .update({
      portal_2fa_pending_code: null,
      portal_2fa_pending_expires: null,
      portal_2fa_pending_login_token: null,
    })
    .eq("id", c.id);

  return { success: true, token };
}
