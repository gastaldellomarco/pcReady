import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import { sendEmailEvent } from "@/lib/email-helpers.server";

import { getAppBaseUrl } from "@/lib/server-utils";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";

/**
 * Core server-only implementation: checks whether self-registration is enabled.
 */
export async function getSelfRegistrationStatusServer() {
  const { data: row, error } = await (supabaseAdmin as any)
    .from("app_settings")
    .select("value")
    .eq("key", "self_registration_enabled")
    .maybeSingle();

  if (error || !row) return { enabled: false };

  let enabled = false;
  try {
    const raw = (row as any).value;
    enabled = typeof raw === "string" ? JSON.parse(raw) === true : !!raw;
  } catch {
    enabled = false;
  }
  return { enabled };
}

function normalizeInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || name.slice(0, 2).toUpperCase()
  );
}

/**
 * Send an email to all admin users about a pending self-registration.
 */
async function notifyAdminsOfPendingRegistration(
  fullName: string,
  email: string,
  userId: string,
  settings: Record<string, unknown>,
) {
  const orgName = (settings.organization_name as string) || "PCReady";
  const appUrl = getAppBaseUrl();

  // Fetch all admin user IDs
  const { data: adminRoles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (rolesError || !adminRoles?.length) return;

  const adminIds = adminRoles.map((r) => r.user_id);

  const adminLink = appUrl ? `${appUrl}/admin${userId ? `?highlight=${userId}` : ""}` : "";

  // Fetch admin emails and send templated email to each
  for (const adminId of adminIds) {
    try {
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(adminId);
      if (userError || !userData?.user?.email) continue;

      const adminEmail = userData.user.email;

      // Fetch admin profile name
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", adminId)
        .maybeSingle();

      const adminName = profile?.full_name || "Amministratore";

      await sendEmailEvent({
        eventType: "registration_pending",
        to: adminEmail,
        variables: {
          "{{organization_name}}": orgName,
          "{{support_email}}": (settings.support_email as string) || "",
          "{{user_name}}": adminName,
          "{{user_email}}": adminEmail,
          "{{admin_name}}": adminName,
          "{{registered_user_name}}": fullName,
          "{{registered_user_email}}": email,
          "{{admin_link}}": adminLink,
        },
      });
    } catch {
      // Skip failed admin email deliveries silently
    }
  }
}

/**
 * Core server-only implementation: registers a new user via self-registration.
 */
export async function registerSelfServer(data: {
  email: string;
  fullName: string;
  password: string;
}) {
  const email = data.email.trim().toLowerCase();
  throwIfRateLimited(`selfreg:${email}`, RATE_LIMITER_KEYS.SELF_REGISTRATION);

  // Check if self-registration is enabled
  const settings: Record<string, unknown> = {};
  try {
    const { data: rows } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("key, value")
      .in("key", ["self_registration_enabled", "send_registration_email", "admin_approval_required", "organization_name", "support_email"]);
    for (const row of (rows ?? []) as any[]) {
      let val: unknown = (row as any).value;
      try {
        val = typeof val === "string" ? JSON.parse(val) : val;
      } catch {
        /* keep raw */
      }
      settings[(row as any).key] = val;
    }
  } catch {
    throw new Response("Impossibile verificare le impostazioni", { status: 500 });
  }

  if (!settings.self_registration_enabled) {
    throw new Response("Registrazione autonoma non abilitata", { status: 403 });
  }

  const approvalRequired = !!settings.admin_approval_required;

  // Create the user — Supabase will reject if email already exists
  const fullName = data.fullName.trim();
  const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: fullName, registered_self: true },
  });

  if (signUpError) {
    if (
      signUpError.message?.toLowerCase().includes("already") ||
      signUpError.status === 422
    ) {
      return { ok: true, duplicate: true };
    }
    throw new Error(signUpError.message);
  }

  const userId = signUpData.user?.id;
  if (!userId) throw new Error("Creazione utente fallita");

  // Create profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .upsert({
      id: userId,
      full_name: fullName,
      initials: normalizeInitials(fullName),
    });
  if (profileError) throw new Error(profileError.message);

  // Create user_profiles (the auth trigger may have already created it)
  const { error: userProfileError } = await supabaseAdmin
    .from("user_profiles")
    .upsert(
      { id: userId, display_name: fullName, password_set: true },
      { onConflict: "id" },
    );
  if (userProfileError) throw new Error(userProfileError.message);

  // Assign viewer role (unique constraint on user_id allows onConflict)
  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
    { user_id: userId, role: "viewer" },
    { onConflict: "user_id" },
  );
  if (roleError) throw new Error(roleError.message);

  // If approval required, disable the account until admin approves
  if (approvalRequired) {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });

    await createNotificationForAdmins({
      type: "user_registered",
      title: "Nuova registrazione in attesa di approvazione",
      body: `${fullName} (${email}) ha richiesto la registrazione. Approvazione richiesta.`,
      payload: { user_id: userId, email, full_name: fullName },
      link: "/admin",
    });

    // Send email notification to all admins
    notifyAdminsOfPendingRegistration(fullName, email, userId, settings).catch((err) => {
      console.error("Failed to send admin notification email:", err);
    });
  } else if (settings.send_registration_email) {
    // Send confirmation email to the newly registered user
    const orgName = (settings.organization_name as string) || "PCReady";
    const supportEmail = (settings.support_email as string) || "";
    const appUrl = getAppBaseUrl();

    sendEmailEvent({
      eventType: "confirm_account",
      to: email,
      variables: {
        "{{organization_name}}": orgName,
        "{{support_email}}": supportEmail,
        "{{user_name}}": fullName,
        "{{user_email}}": email,
        "{{confirm_link}}": appUrl ? `${appUrl}/auth` : "",
      },
    }).catch((err) => {
      console.error("Failed to send registration confirmation email:", err);
    });
  }

  return { ok: true, approvalRequired };
}
