import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verifies that the authenticated user is an admin or tech (operator).
 * Used as a guard before generating/revoking portal access links.
 * Throws Response(401) if not authenticated, Response(403) if insufficient permissions.
 */
export async function assertPortalLinkOperator(accessToken: string) {
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
