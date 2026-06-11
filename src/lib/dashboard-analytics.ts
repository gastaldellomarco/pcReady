import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Barrel: re-export types & pure computation from data module ──────

export type {
  DashboardMonthMetric,
  TechnicianKpi,
  PriorityResolutionMetric,
  DashboardAnalytics,
  TechRoleRow,
  TechProfileRow,
  OpenTicketRow,
  WeeklyActivityTechnician,
  WeeklyActivityResponse,
  NormalizedMetrics,
  TechnicianRadarRow,
  TechnicianStatRow,
  OverdueTicketRow,
} from "@/lib/data/dashboard-analytics";

export {
  computeTechnicianStats,
  computeWeeklyActivity,
  computeRadarMetrics,
  computeDashboardAnalytics,
  computeOverdueTickets,
  computePeriodRange,
  clamp,
} from "@/lib/data/dashboard-analytics";

export type {
  DashboardAnalyticsInput,
  OverdueTicketsInput,
  PeriodRangePeriod,
  PeriodRange,
} from "@/lib/data/dashboard-analytics";

import type {
  DashboardAnalytics,
  OverdueTicketRow,
  TechProfileRow,
  TechRoleRow,
  TechnicianKpi,
  TechnicianRadarRow,
  TechnicianStatRow,
  WeeklyActivityResponse,
} from "@/lib/data/dashboard-analytics";
import { computeTechnicianStats, computeWeeklyActivity, computeRadarMetrics, computeDashboardAnalytics, computeOverdueTickets, computePeriodRange } from "@/lib/data/dashboard-analytics";
import type { DashboardAnalyticsInput, OverdueTicketsInput, PeriodRangePeriod } from "@/lib/data/dashboard-analytics";

// ─── Server Functions ─────────────────────────────────────────────────

const AnalyticsInputSchema = z.object({
  accessToken: z.string().min(1),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .validator(AnalyticsInputSchema)
  .handler(async ({ data }): Promise<DashboardAnalytics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const [technicianRes, ticketsRes, archivedHistRes] = await Promise.all([
      supabaseAdmin.rpc("get_technician_kpi" as any, {
        date_from: data.dateFrom,
        date_to: data.dateTo,
      }),
      supabaseAdmin
        .from("tickets")
        .select(
          "id, created_at, closed_at, status, assignee_id, priority, sla_deadline, sla_breached",
        )
        .gte("created_at", data.dateFrom)
        .lt("created_at", data.dateTo)
        .limit(5000),
      supabaseAdmin
        .from("ticket_status_history")
        .select("ticket_id, changed_at")
        .eq("to_status", "archived")
        .gte("changed_at", data.dateFrom)
        .lt("changed_at", data.dateTo),
    ]);

    if (technicianRes.error) throw technicianRes.error;
    if (ticketsRes.error) throw ticketsRes.error;
    if (archivedHistRes.error) throw archivedHistRes.error;

    const ticketsAll = (ticketsRes.data ?? []) as DashboardAnalyticsInput["ticketsAll"];
    const archivedHist = (archivedHistRes.data ?? []) as DashboardAnalyticsInput["archivedHist"];
    const technicianData = (technicianRes.data ?? []) as DashboardAnalyticsInput["technicianData"];

    return computeDashboardAnalytics({ ticketsAll, archivedHist, technicianData, dateFrom: data.dateFrom, dateTo: data.dateTo });
  });

export const getTechnicianStats = createServerFn({ method: "GET" })
  .validator(z.any())
  .handler(async ({ data }): Promise<TechnicianStatRow[]> => {
    const { from, to } = computePeriodRange((data?.period as PeriodRangePeriod) ?? "week", new Date());

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      data?.accessToken || "",
    );
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const technicianRes = await supabaseAdmin.rpc("get_technician_kpi" as any, {
      date_from: from.toISOString(),
      date_to: to.toISOString(),
    });

    if (technicianRes.error) throw technicianRes.error;

    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
        supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
      ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const techIds = Array.from(new Set((roles ?? []).map((r: TechRoleRow) => r.user_id)));
    const { data: openTicketsData } = techIds.length
      ? await supabaseAdmin
          .from("tickets")
          .select("assignee_id")
          .in("assignee_id", techIds)
          .or("status.neq.completed,status.neq.archived")
          .limit(5000)
      : { data: [] as any[] };

    return computeTechnicianStats(
      (technicianRes.data ?? []) as TechnicianKpi[],
      roles ?? [],
      profiles ?? [],
      openTicketsData ?? [],
    );
  });

export const getTechnicianWeeklyActivity = createServerFn({ method: "GET" })
  .validator(z.any())
  .handler(async ({ data }): Promise<WeeklyActivityResponse> => {
    const weekOffset = Number(data?.weekOffset || 0);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      data?.accessToken || "",
    );
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diff + weekOffset * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const fromIso = start.toISOString();
    const toIso = end.toISOString();

    const { data: activityData, error: activityError } = await supabaseAdmin
      .from("tickets")
      .select("assignee:assignee_id, closed_at, status")
      .gte("closed_at", fromIso)
      .lt("closed_at", toIso)
      .in("status", ["completed", "archived"] as any)
      .not("closed_at", "is", null)
      .order("assignee_id", { ascending: true });

    if (activityError) throw activityError;

    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
      supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
    ]);

    const assignableIds = new Set((roles ?? []).map((r: TechRoleRow) => r.user_id));
    const technicians = (profiles ?? [])
      .filter((p: TechProfileRow) => assignableIds.has(p.id))
      .map((p: TechProfileRow) => ({
        id: p.id,
        full_name: p.full_name,
        initials: p.initials || p.full_name.slice(0, 2).toUpperCase(),
      }));

    return computeWeeklyActivity({
      activityData: (activityData ?? []) as Array<{ assignee: string | null; closed_at: string }>,
      technicians,
      assignableIds,
      weekStart: start,
    });
  });

const OverdueTicketsSchema = z.object({ accessToken: z.string(), thresholdDays: z.number().optional() })

export const getOverdueTickets = createServerFn({ method: "GET" })
  .validator(OverdueTicketsSchema)
  .handler(async ({ data }): Promise<OverdueTicketRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const thresholdDays = data.thresholdDays ?? 5;
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();
    const warningCutoff = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: tickets, error } = await supabaseAdmin
      .from("tickets")
      .select(
        `id, ticket_code, status, priority, client, model, created_at, updated_at, sla_deadline, sla_breached, assignee:assignee_id(full_name)`,
      )
      .in("status", ["in-progress", "pending", "testing", "ready"] as any)
      .or(`sla_breached.eq.true,sla_deadline.lte.${warningCutoff},updated_at.lt.${cutoff}`)
      .order("sla_deadline", { ascending: true, nullsFirst: false })
      .limit(500);

    if (error) throw error;

    return computeOverdueTickets({
      tickets: (tickets ?? []) as OverdueTicketsInput["tickets"],
      now: Date.now(),
    });
  });

export const getTechnicianRadarMetrics = createServerFn({ method: "GET" })
  .validator(z.any())
  .handler(async ({ data }): Promise<{ dateFrom?: string; dateTo?: string; rows: TechnicianRadarRow[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      data?.accessToken || "",
    );
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const dateFrom = data?.dateFrom ?? null;
    const dateTo = data?.dateTo ?? null;

    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
        supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
      ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const ticketsQ = supabaseAdmin
      .from("tickets")
      .select("id, assignee_id, created_at, closed_at, status")
      .limit(5000);
    if (dateFrom) ticketsQ.gte("created_at", dateFrom);
    if (dateTo) ticketsQ.lt("created_at", dateTo);
    const ticketsRes = await ticketsQ;
    if (ticketsRes.error) throw ticketsRes.error;
    const tickets = (ticketsRes.data ?? []) as any[];

    const ticketIds = tickets.map((t) => t.id);

    let notes: Array<{ ticket_id: string; created_at: string }> = [];
    if (ticketIds.length) {
      const notesRes = await supabaseAdmin
        .from("ticket_notes")
        .select("ticket_id, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });
      if (notesRes.error) throw notesRes.error;
      notes = (notesRes.data ?? []) as Array<{ ticket_id: string; created_at: string }>;
    }

    let history: Array<{ ticket_id: string; changed_at: string; from_status: string; to_status: string }> = [];
    if (ticketIds.length) {
      const histRes = await supabaseAdmin
        .from("ticket_status_history")
        .select("ticket_id, changed_at, from_status, to_status")
        .in("ticket_id", ticketIds)
        .order("changed_at", { ascending: true });
      if (histRes.error) throw histRes.error;
      history = (histRes.data ?? []) as Array<{ ticket_id: string; changed_at: string; from_status: string; to_status: string }>;
    }

    const rows = computeRadarMetrics({
      roles: roles ?? [],
      profiles: profiles ?? [],
      tickets: tickets as Array<{
        id: string;
        assignee_id: string | null;
        created_at: string;
        closed_at: string | null;
        status: string;
      }>,
      notes,
      history,
      dateFrom,
      dateTo,
    });

    return { dateFrom, dateTo, rows };
  });
