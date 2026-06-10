import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession } from "./portal-sessions.server";

/**
 * Returns all contacts for the client associated with the portal session.
 */
export async function getPortalClientContactsServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const { data, error } = await supabaseAdmin
    .from("client_contacts")
    .select(
      "id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes",
    )
    .eq("client_id", session.clientId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  if (error) throw error;
  return {
    contacts: ((data ?? []) as any[]).map((contact) => ({
      id: contact.id,
      fullName: contact.full_name,
      email: contact.email,
      phone: contact.phone,
      jobTitle: contact.job_title,
      department: contact.department,
      isPrimary: contact.is_primary,
      isSelf: contact.id === session.contactId,
    })),
  };
}
