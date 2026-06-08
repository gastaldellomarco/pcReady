import { createServerFn } from "@tanstack/react-start";
import { ALL_PERMISSIONS, type AuthProfile } from "./auth-context";

/**
 * Server function that loads the minimal auth profile in a single round-trip.
 * Runs profiles, user_profiles, role, and permissions queries in parallel via supabaseAdmin.
 * Admins always receive all permissions; other roles get only explicitly assigned permissions.
 */
export const getMyAuthProfile = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }): Promise<AuthProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate token
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData.user) throw new Response("Non autenticato", { status: 401 });
    const userId = userData.user.id;

    // Run all 4 queries in parallel on the server (no RLS, no extra round-trips)
    const [profileRes, userProfileRes, roleRes, permissionsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, initials")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_profiles")
        .select("display_name, avatar_url, password_set, language")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin.rpc("get_user_role", { _user_id: userId }),
      (supabaseAdmin as any)
        .from("role_permissions")
        .select("role, permission"), // Fetch all rows, filter by actual role below
    ]);

    const p = profileRes.data;
    const up = userProfileRes.data;
    const role = String(roleRes.data ?? "viewer") as AuthProfile["role"];

    if (profileRes.error) throw profileRes.error;
    if (userProfileRes.error) throw userProfileRes.error;
    if (roleRes.error) throw roleRes.error;
    if (!p) throw new Error("Profilo utente non trovato");

    // Admin: always all permissions
    // Tech/viewer: permissions filtered from role_permissions table by actual role
    let permissions: string[];
    if (role === "admin") {
      permissions = [...ALL_PERMISSIONS];
    } else {
      const allRows = (permissionsRes as any)?.data ?? [];
      permissions = allRows
        .filter((r: any) => r.role === role)
        .map((r: any) => r.permission);
    }

    const displayName = (up as any)?.display_name || p.full_name;
    const userLang: "it" | "en" = (up as any)?.language === "en" ? "en" : "it";

    return {
      id: p.id,
      full_name: displayName,
      initials: p.initials || displayName.slice(0, 2).toUpperCase(),
      avatar_url: (up as any)?.avatar_url ?? null,
      password_set: (up as any)?.password_set ?? true,
      role,
      language: userLang,
      permissions,
    };
  });

export default getMyAuthProfile;
