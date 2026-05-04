import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function requireAdmin(accessToken: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) throw new Response("Token non valido", { status: 401 });

  const { data: roleData, error: roleError } = await supabaseAdmin.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });
  if (roleError || !roleData) throw new Response("Accesso negato", { status: 403 });

  return user.id;
}