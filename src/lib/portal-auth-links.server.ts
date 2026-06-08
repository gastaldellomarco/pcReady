import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AUDIT_ACTIONS } from "@/lib/audit-log-actions";
import { assertPortalLinkOperator, createPortalSession } from "@/lib/portal-auth.server";

/**
 *
 */
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

/**
 *
 */
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
