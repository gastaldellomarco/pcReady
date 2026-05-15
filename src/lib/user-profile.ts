import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Theme } from "./theme";

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  timezone: string;
  language: string;
  preferred_theme: Theme;
  notify_ticket_assigned: boolean;
  notify_ticket_status_changed: boolean;
  notify_automation_failed: boolean;
  notify_device_status_changed: boolean;
  notify_checklist_completed: boolean;
  notify_mentions: boolean;
  notify_ticket_completed: boolean;
  email_notify_ticket_assigned: boolean;
  email_notify_ticket_status_changed: boolean;
  email_notify_ticket_completed: boolean;
  email_notify_automation_failed: boolean;
  email_notify_device_status_changed: boolean;
  email_notify_checklist_completed: boolean;
  email_notify_mentions: boolean;
  notification_digest: string;
  webhook_url: string | null;
  last_notification_sent_at: string | null;
  password_set: boolean;
  created_at: string | null;
  updated_at: string | null;
  email: string;
  last_sign_in_at: string | null;
  recent_activity: UserActivity[];
}

export interface UserActivity {
  id: string;
  type: string;
  message: string;
  ticket_id: string | null;
  created_at: string;
}

const ProfileUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  avatar_url: z.string().url().max(2048).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  language: z.enum(["it", "en"]).optional(),
  preferred_theme: z.enum(["light", "dark", "system"]).optional(),
  notify_ticket_assigned: z.boolean().optional(),
  notify_ticket_status_changed: z.boolean().optional(),
  notify_automation_failed: z.boolean().optional(),
  notify_device_status_changed: z.boolean().optional(),
  notify_checklist_completed: z.boolean().optional(),
  notify_mentions: z.boolean().optional(),
  notify_ticket_completed: z.boolean().optional(),
  email_notify_ticket_assigned: z.boolean().optional(),
  email_notify_ticket_status_changed: z.boolean().optional(),
  email_notify_ticket_completed: z.boolean().optional(),
  email_notify_automation_failed: z.boolean().optional(),
  email_notify_device_status_changed: z.boolean().optional(),
  email_notify_checklist_completed: z.boolean().optional(),
  email_notify_mentions: z.boolean().optional(),
  notification_digest: z.enum(["immediate", "15min", "hourly", "daily"]).optional(),
  webhook_url: z.string().trim().max(500).nullable().optional(),
});

const ChangePasswordSchema = z.object({
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

async function getAuthedUser(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Non autenticato", { status: 401 });
  return data.user;
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

export const getMyProfile = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const user = await getAuthedUser(accessToken);

    const fallbackName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente";
    const { data: profile, error } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[getMyProfile] failed to load user profile:", error);
      throw error;
    }

    let row = profile as Partial<UserProfile> | null;
    if (!row) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("user_profiles")
        .insert({ id: user.id, display_name: fallbackName })
        .select("*")
        .single();
      if (insertError) {
        console.error("[getMyProfile] failed to create user profile:", insertError);
        throw insertError;
      }
      row = inserted as Partial<UserProfile>;
    }

    const { data: activity, error: activityError } = await supabaseAdmin
      .from("activity_log")
      .select("id, type, message, ticket_id, created_at")
      .eq("actor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (activityError) throw activityError;

    return {
      id: user.id,
      display_name: row.display_name ?? fallbackName,
      avatar_url: row.avatar_url ?? null,
      phone: row.phone ?? null,
      timezone: row.timezone ?? "Europe/Rome",
      language: row.language ?? "it",
      notify_ticket_assigned: row.notify_ticket_assigned ?? true,
      notify_ticket_status_changed: row.notify_ticket_status_changed ?? true,
      notify_automation_failed: row.notify_automation_failed ?? true,
      notify_device_status_changed: row.notify_device_status_changed ?? true,
      notify_checklist_completed: row.notify_checklist_completed ?? true,
      notify_mentions: row.notify_mentions ?? true,
      notify_ticket_completed: row.notify_ticket_completed ?? true,
      email_notify_ticket_assigned: row.email_notify_ticket_assigned ?? true,
      email_notify_ticket_status_changed: row.email_notify_ticket_status_changed ?? true,
      email_notify_ticket_completed: row.email_notify_ticket_completed ?? true,
      email_notify_automation_failed: row.email_notify_automation_failed ?? true,
      email_notify_device_status_changed: row.email_notify_device_status_changed ?? true,
      email_notify_checklist_completed: row.email_notify_checklist_completed ?? true,
      email_notify_mentions: row.email_notify_mentions ?? true,
      notification_digest: row.notification_digest ?? "immediate",
      webhook_url: row.webhook_url ?? null,
      last_notification_sent_at: row.last_notification_sent_at ?? null,
      preferred_theme: (row.preferred_theme as Theme) ?? "system",
      password_set: row.password_set ?? true,
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      email: user.email ?? "",
      last_sign_in_at: user.last_sign_in_at ?? null,
      recent_activity: (activity ?? []) as UserActivity[],
    } satisfies UserProfile;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { accessToken: string; profile: z.input<typeof ProfileUpdateSchema> }) => data,
  )
  .handler(async ({ data: { accessToken, profile } }) => {
    const user = await getAuthedUser(accessToken);
    const validated = ProfileUpdateSchema.parse(profile);

    const { error } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { id: user.id, ...validated, updated_at: new Date().toISOString() } as any,
        { onConflict: "id" },
      );

    if (error) {
      console.error("[updateMyProfile] failed to upsert user profile:", {
        userId: user.id,
        payloadKeys: Object.keys(validated),
        error,
      });
      throw error;
    }

    if (validated.display_name) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: validated.display_name,
          initials: normalizeInitials(validated.display_name),
        })
        .eq("id", user.id);
      if (profileError) throw profileError;

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, full_name: validated.display_name },
      });
      if (authError) throw authError;
    }

    return { success: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; password: string }) => data)
  .handler(async ({ data: { accessToken, password } }) => {
    const user = await getAuthedUser(accessToken);
    const validated = ChangePasswordSchema.parse({ password });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: validated.password,
    });

    if (error) throw error;

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        { id: user.id, password_set: true, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (profileError) {
      console.error("[changePassword] failed to mark password_set:", profileError);
      throw profileError;
    }

    return { success: true };
  });
