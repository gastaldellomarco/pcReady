import { createServerFn } from "@tanstack/react-start";

export const getMyRole = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data: { accessToken } }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Validate token and get user
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData.user) throw new Response("Non autenticato", { status: 401 });
    const userId = userData.user.id;
    const { data: roleData, error: roleErr } = await supabaseAdmin.rpc("get_user_role", {
      _user_id: userId,
    });
    if (roleErr) throw roleErr;
    return { role: String(roleData ?? "viewer") };
  });

export default getMyRole;
