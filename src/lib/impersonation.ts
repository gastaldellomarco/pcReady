import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ALL_PERMISSIONS, type AuthProfile } from "@/lib/auth-context";
import { requireAdmin } from "./admin-users.server";

interface AuthedInput {
  accessToken: string;
}

interface ImpersonationInput extends AuthedInput {
  targetUserId: string;
}

/**
 * Loads the full profile for a target user (for impersonation).
 * Only callable by admins.
 */
export const getImpersonatedProfile = createServerFn({ method: "POST" })
  .inputValidator((data: ImpersonationInput) => data)
  .handler(async ({ data: { accessToken, targetUserId } }): Promise<AuthProfile> => {
    const actorId = await requireAdmin(accessToken);

    // Prevent self-impersonation
    if (actorId === targetUserId) {
      throw new Response("Non puoi impersonare te stesso", { status: 400 });
    }

    // Load target user's profile, user_profiles, and role in parallel
    const [profileRes, userProfileRes, roleRes, permissionsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, initials")
        .eq("id", targetUserId)
        .maybeSingle(),
      supabaseAdmin
        .from("user_profiles")
        .select("display_name, avatar_url, password_set, language")
        .eq("id", targetUserId)
        .maybeSingle(),
      supabaseAdmin.rpc("get_user_role", { _user_id: targetUserId }),
      (supabaseAdmin as any).from("role_permissions").select("role, permission"),
    ]);

    const p = profileRes.data;
    if (profileRes.error) throw profileRes.error;
    if (!p) throw new Response("Utente target non trovato", { status: 404 });

    const up = userProfileRes.data;
    const role = String(roleRes.data ?? "viewer") as AuthProfile["role"];

    // Compute permissions
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

/**
 * Logs the start of an impersonation session in the audit log.
 */
export const logImpersonationStart = createServerFn({ method: "POST" })
  .inputValidator((data: ImpersonationInput) => data)
  .handler(async ({ data: { accessToken, targetUserId } }) => {
    const actorId = await requireAdmin(accessToken);

    // Load names for audit log
    const [actorRes, targetRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", actorId).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", targetUserId).maybeSingle(),
    ]);

    const actorName = (actorRes.data as any)?.full_name || "Admin";
    const targetName = (targetRes.data as any)?.full_name || "Utente";

    await (supabaseAdmin as any).from("activity_log").insert({
      type: "user",
      message: `${actorName} ha iniziato l'impersonificazione di ${targetName}`,
      actor_id: actorId,
      actor_name: actorName,
      action_type: "impersonation_start",
      entity_type: "user",
      entity_id: targetUserId,
      severity: "warning",
      new_value: { target_user_id: targetUserId, target_name: targetName } as any,
    });

    return { ok: true };
  });

/**
 * Logs the end of an impersonation session in the audit log.
 */
export const logImpersonationEnd = createServerFn({ method: "POST" })
  .inputValidator((data: AuthedInput) => data)
  .handler(async ({ data: { accessToken } }) => {
    const actorId = await requireAdmin(accessToken);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", actorId)
      .maybeSingle();

    const actorName = (profile as any)?.full_name || "Admin";

    await (supabaseAdmin as any).from("activity_log").insert({
      type: "user",
      message: `${actorName} ha terminato l'impersonificazione`,
      actor_id: actorId,
      actor_name: actorName,
      action_type: "impersonation_end",
      entity_type: "user",
      entity_id: actorId,
      severity: "info",
    });

    return { ok: true };
  });
