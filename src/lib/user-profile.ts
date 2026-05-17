import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Theme } from "./theme";
import type { DashboardLayout } from "@/components/dashboard/widget-registry";

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

export interface TechnicianProfileOverview {
  stats: {
    closedTickets: number;
    averageResolutionHours: number | null;
    workedHours: number;
  };
  closedTickets: Array<{
    id: string;
    ticket_code: string;
    title: string;
    client_name: string;
    status: string;
    priority: string | null;
    created_at: string;
    closed_at: string | null;
    billable_hours: number;
  }>;
  recentInterventions: Array<{
    id: string;
    ticket_id: string;
    ticket_code: string;
    title: string;
    client_name: string;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number;
    description: string | null;
  }>;
  monthlyActivity: Array<{
    month: string;
    closedTickets: number;
    workedHours: number;
  }>;
  badges: Array<{
    key: string;
    label: string;
    description: string;
    achieved: boolean;
  }>;
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

export const getMyTechnicianOverview = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }): Promise<TechnicianProfileOverview> => {
    const user = await getAuthedUser(accessToken);
    const closedStatuses = ["ready", "completed", "archived"];
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [{ data: closedRows, error: closedError }, { data: timeRows, error: timeError }] =
      await Promise.all([
        (supabaseAdmin as any)
          .from("tickets")
          .select(
            "id, ticket_code, model, client, status, priority, created_at, closed_at, completed_at, updated_at, billable_hours, clients:client_id(name, company_name)",
          )
          .eq("assignee_id", user.id)
          .in("status", closedStatuses)
          .order("closed_at", { ascending: false, nullsFirst: false })
          .limit(25),
        (supabaseAdmin as any)
          .from("ticket_time_entries")
          .select(
            "id, ticket_id, started_at, ended_at, duration_minutes, description, ticket:tickets(id, ticket_code, model, client, clients:client_id(name, company_name))",
          )
          .eq("user_id", user.id)
          .order("started_at", { ascending: false })
          .limit(80),
      ]);

    if (closedError) throw closedError;
    if (timeError) throw timeError;

    const closed = ((closedRows ?? []) as any[]).map((ticket) => {
      const client = Array.isArray(ticket.clients) ? ticket.clients[0] : ticket.clients;
      return {
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        title: ticket.model || "Ticket assistenza",
        client_name: client?.company_name || client?.name || ticket.client || "Cliente",
        status: ticket.status,
        priority: ticket.priority ?? null,
        created_at: ticket.created_at,
        closed_at: ticket.closed_at || ticket.completed_at || ticket.updated_at || null,
        billable_hours: Number(ticket.billable_hours ?? 0),
      };
    });

    const interventions = ((timeRows ?? []) as any[]).map((entry) => {
      const ticket = Array.isArray(entry.ticket) ? entry.ticket[0] : entry.ticket;
      const client = Array.isArray(ticket?.clients) ? ticket.clients[0] : ticket?.clients;
      const fallbackMinutes = entry.ended_at
        ? Math.max(
            0,
            Math.round(
              (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000,
            ),
          )
        : 0;
      return {
        id: entry.id,
        ticket_id: entry.ticket_id,
        ticket_code: ticket?.ticket_code || "-",
        title: ticket?.model || "Intervento",
        client_name: client?.company_name || client?.name || ticket?.client || "Cliente",
        started_at: entry.started_at,
        ended_at: entry.ended_at ?? null,
        duration_minutes: Number(entry.duration_minutes ?? fallbackMinutes),
        description: entry.description ?? null,
      };
    });

    const averageResolutionHours = closed.length
      ? closed.reduce((sum, ticket) => {
          const start = new Date(ticket.created_at).getTime();
          const end = new Date(ticket.closed_at || ticket.created_at).getTime();
          return sum + Math.max(0, end - start) / 36e5;
        }, 0) / closed.length
      : null;
    const workedHours = interventions.reduce(
      (sum, intervention) => sum + intervention.duration_minutes / 60,
      0,
    );

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(since);
      date.setMonth(since.getMonth() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        month: date.toLocaleDateString("it-IT", { month: "short" }),
        closedTickets: 0,
        workedHours: 0,
      };
    });
    const monthByKey = new Map(months.map((month) => [month.key, month]));
    for (const ticket of closed) {
      const date = new Date(ticket.closed_at || ticket.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthByKey.get(key);
      if (bucket) bucket.closedTickets += 1;
    }
    for (const intervention of interventions) {
      const date = new Date(intervention.started_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthByKey.get(key);
      if (bucket) bucket.workedHours += Math.round((intervention.duration_minutes / 60) * 10) / 10;
    }

    const stats = {
      closedTickets: closed.length,
      averageResolutionHours:
        averageResolutionHours === null ? null : Math.round(averageResolutionHours * 10) / 10,
      workedHours: Math.round(workedHours * 10) / 10,
    };

    return {
      stats,
      closedTickets: closed,
      recentInterventions: interventions.slice(0, 10),
      monthlyActivity: months.map(({ key: _key, ...month }) => month),
      badges: [
        {
          key: "closer",
          label: "Closer affidabile",
          description: "Almeno 10 ticket chiusi assegnati a te.",
          achieved: stats.closedTickets >= 10,
        },
        {
          key: "fast-resolver",
          label: "Risoluzione rapida",
          description: "Tempo medio di risoluzione sotto 48 ore.",
          achieved: stats.averageResolutionHours !== null && stats.averageResolutionHours <= 48,
        },
        {
          key: "time-tracker",
          label: "Tracciamento accurato",
          description: "Almeno 20 ore lavorate registrate sui ticket.",
          achieved: stats.workedHours >= 20,
        },
      ],
    };
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
      .upsert({ id: user.id, ...validated, updated_at: new Date().toISOString() } as any, {
        onConflict: "id",
      });

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

export const getMyDashboardLayout = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }): Promise<DashboardLayout | null> => {
    const user = await getAuthedUser(accessToken);

    const { data: row, error } = await (supabaseAdmin as any)
      .from("user_profiles")
      .select("dashboard_layout")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[getMyDashboardLayout] failed:", error);
      throw error;
    }

    return (row?.dashboard_layout as DashboardLayout | null) ?? null;
  });

export const updateMyDashboardLayout = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; layout: DashboardLayout }) => data)
  .handler(async ({ data: { accessToken, layout } }) => {
    const user = await getAuthedUser(accessToken);

    const { error } = await (supabaseAdmin as any)
      .from("user_profiles")
      .update({ dashboard_layout: layout, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.error("[updateMyDashboardLayout] failed:", error);
      throw error;
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
