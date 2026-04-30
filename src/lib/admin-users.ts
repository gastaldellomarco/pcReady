import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "@/lib/auth-context";

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  initials: string;
  role: AppRole;
  status: "active" | "disabled";
  created_at: string | null;
}

interface AuthedInput {
  accessToken: string;
}

interface UpdateUserInput extends AuthedInput {
  userId: string;
  role: AppRole;
  fullName?: string;
  initials?: string;
}

interface UserStateInput extends AuthedInput {
  userId: string;
  disabled: boolean;
}

interface DeleteUserInput extends AuthedInput {
  userId: string;
}

interface InviteUserInput extends AuthedInput {
  email: string;
  fullName?: string;
  role: AppRole;
  redirectTo?: string;
}

const APP_ROLES: AppRole[] = ["admin", "tech", "viewer"];

async function requireAdmin(accessToken: string) {
  const token = accessToken?.trim();
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const userId = authData.user?.id;
  if (authError || !userId) throw new Response("Unauthorized", { status: 401 });

  const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleError || !isAdmin) throw new Response("Forbidden", { status: 403 });

  return userId;
}

function normalizeInitials(name: string, initials?: string) {
  const clean = initials?.trim().slice(0, 4).toUpperCase();
  if (clean) return clean;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || name.slice(0, 2).toUpperCase();
}

async function assertCanRemoveAdmin(targetUserId: string, nextRole?: AppRole) {
  const { data: targetRoles, error: targetError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId);
  if (targetError) throw new Error(targetError.message);

  const isTargetAdmin = targetRoles?.some(r => r.role === "admin");
  if (!isTargetAdmin || nextRole === "admin") return;

  const { count, error: countError } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) <= 1) throw new Response("Impossibile rimuovere l'ultimo amministratore", { status: 400 });
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((data: AuthedInput) => data)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);

    const [{ data: authUsers, error: usersError }, { data: profiles, error: profilesError }, { data: roles, error: rolesError }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("profiles").select("id, full_name, initials, created_at"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
      ]);

    if (usersError) throw new Error(usersError.message);
    if (profilesError) throw new Error(profilesError.message);
    if (rolesError) throw new Error(rolesError.message);

    const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]));
    const roleById = new Map((roles ?? []).map(role => [role.user_id, role.role as AppRole]));

    return authUsers.users.map(user => {
      const profile = profileById.get(user.id);
      const name = profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente";
      const bannedUntil = user.banned_until ? new Date(user.banned_until) : null;

      return {
        id: user.id,
        email: user.email ?? "",
        full_name: name,
        initials: profile?.initials || normalizeInitials(name),
        role: roleById.get(user.id) ?? "viewer",
        status: bannedUntil && bannedUntil > new Date() ? "disabled" : "active",
        created_at: user.created_at ?? profile?.created_at ?? null,
      } satisfies AdminUserRow;
    });
  });

export const updateAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateUserInput) => data)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    if (!APP_ROLES.includes(data.role)) throw new Response("Ruolo non valido", { status: 400 });

    await assertCanRemoveAdmin(data.userId, data.role);

    const fullName = data.fullName?.trim();
    if (fullName !== undefined) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: fullName, initials: normalizeInitials(fullName, data.initials) })
        .eq("id", data.userId);
      if (profileError) throw new Error(profileError.message);
    }

    const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.userId,
      role: data.role,
    });
    if (insertError) throw new Error(insertError.message);

    return { ok: true };
  });

export const inviteAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: InviteUserInput) => data)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    if (!APP_ROLES.includes(data.role)) throw new Response("Ruolo non valido", { status: 400 });

    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Response("Email non valida", { status: 400 });

    const fullName = data.fullName?.trim() || email.split("@")[0];
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: data.redirectTo,
      data: { full_name: fullName },
    });
    if (inviteError) throw new Error(inviteError.message);

    const invitedUserId = inviteData.user?.id;
    if (!invitedUserId) throw new Error("Invito creato senza utente associato");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: invitedUserId, full_name: fullName, initials: normalizeInitials(fullName) });
    if (profileError) throw new Error(profileError.message);

    const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", invitedUserId);
    if (deleteError) throw new Error(deleteError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: invitedUserId,
      role: data.role,
    });
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });

export const setAdminUserDisabled = createServerFn({ method: "POST" })
  .inputValidator((data: UserStateInput) => data)
  .handler(async ({ data }) => {
    const actorId = await requireAdmin(data.accessToken);
    if (actorId === data.userId) throw new Response("Non puoi disabilitare il tuo account", { status: 400 });
    if (data.disabled) await assertCanRemoveAdmin(data.userId, "viewer");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .inputValidator((data: DeleteUserInput) => data)
  .handler(async ({ data }) => {
    const actorId = await requireAdmin(data.accessToken);
    if (actorId === data.userId) throw new Response("Non puoi rimuovere il tuo account", { status: 400 });
    await assertCanRemoveAdmin(data.userId, "viewer");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
