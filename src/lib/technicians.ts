import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const TechAuthedSchema = z.object({ accessToken: z.string() })

/**
 *
 */
export interface TechnicianOption {
  id: string;
  full_name: string;
  initials: string;
}

export const listTechnicians = createServerFn({ method: "GET" })
  .validator(TechAuthedSchema)
  .handler(async ({ data: { accessToken } }) => {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
        supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
      ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const assignableIds = new Set((roles ?? []).map((role) => role.user_id));
    return (profiles ?? [])
      .filter((profile) => assignableIds.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        full_name: profile.full_name,
        initials: profile.initials || profile.full_name.slice(0, 2).toUpperCase(),
      })) satisfies TechnicianOption[];
  });
