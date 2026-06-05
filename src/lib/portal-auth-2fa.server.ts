import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession } from "@/lib/portal-auth.server";
import { sendEmail } from "@/lib/email-templates.server";

export async function setupPortal2FAServer(input: { token: string; enable: boolean }) {
  const session = await getPortalSession(input.token);
  if (input.enable) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("client_contacts" as any)
      .update({
        portal_2fa_enabled: false,
        portal_2fa_pending_code: code,
        portal_2fa_pending_expires: expiresAt,
      })
      .eq("id", session.contactId)
      .eq("client_id", session.clientId);
    if (error) throw error;
    await sendEmail(
      session.contactEmail,
      "Verifica 2FA - Portale PCReady",
      `<p>Ciao ${session.contactName || ""},</p><p>Il tuo codice di verifica per attivare l'autenticazione a due fattori è: <strong>${code}</strong></p><p>Il codice scade tra 10 minuti.</p>`,
      `Codice verifica 2FA: ${code}`,
    );
    return { success: true, pending: true, message: "Codice di verifica inviato via email" };
  } else {
    const { error } = await supabaseAdmin
      .from("client_contacts" as any)
      .update({
        portal_2fa_enabled: false,
        portal_2fa_pending_code: null,
        portal_2fa_pending_expires: null,
      })
      .eq("id", session.contactId)
      .eq("client_id", session.clientId);
    if (error) throw error;
    return { success: true, enabled: false };
  }
}

export async function verifyPortal2FAServer(input: { token: string; code: string }) {
  const session = await getPortalSession(input.token);
  const { data: contact, error } = await supabaseAdmin
    .from("client_contacts" as any)
    .select("portal_2fa_pending_code, portal_2fa_pending_expires")
    .eq("id", session.contactId)
    .maybeSingle();
  if (error) throw error;
  if (!(contact as any)?.portal_2fa_pending_code) {
    throw new Response("Nessuna richiesta 2FA in corso", { status: 400 });
  }
  if (new Date((contact as any).portal_2fa_pending_expires).getTime() < Date.now()) {
    throw new Response("Codice scaduto. Richiedi un nuovo codice.", { status: 400 });
  }
  if ((contact as any).portal_2fa_pending_code !== input.code) {
    throw new Response("Codice non valido", { status: 400 });
  }
  const { error: updateError } = await supabaseAdmin
    .from("client_contacts" as any)
    .update({
      portal_2fa_enabled: true,
      portal_2fa_pending_code: null,
      portal_2fa_pending_expires: null,
    })
    .eq("id", session.contactId)
    .eq("client_id", session.clientId);
  if (updateError) throw updateError;
  return { success: true, enabled: true };
}
