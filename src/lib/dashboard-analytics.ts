import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 *
 */
export interface DashboardMonthMetric {
  month: string;
  label: string;
  opened: number;
  closed: number;
  avg_days: number | null;
}

/**
 *
 */
export interface TechnicianKpi {
  technician_id: string | null;
  full_name: string;
  assigned: number;
  completed: number;
  avg_days: number | null;
  sla_total?: number;
  sla_respected?: number;
  sla_respected_pct?: number | null;
}

/**
 *
 */
export interface PriorityResolutionMetric {
  priority: "high" | "med" | "low";
  label: string;
  avg_hours: number | null;
  completed: number;
}

/**
 *
 */
export interface DashboardAnalytics {
  ticketsByMonth: DashboardMonthMetric[];
  technicianKpi: TechnicianKpi[];
  priorityResolution: PriorityResolutionMetric[];
  summary: {
    opened: number;
    closed: number;
    avgDays: number | null;
    slaRespectedPct: number | null;
    slaRespected: number;
    slaTotal: number;
  };
}

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

    // Build tickets by month server-side to ensure archived tickets count as closed
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

    const ticketsAll = (ticketsRes.data ?? []) as any[];
    const archivedHist = (archivedHistRes.data ?? []) as any[];

    // map ticket_id -> archived changed_at (first occurrence)
    const archivedDateByTicket = new Map<string, string>();
    for (const h of archivedHist) {
      if (!archivedDateByTicket.has(h.ticket_id))
        archivedDateByTicket.set(h.ticket_id, h.changed_at);
    }

    // helper to extract month key YYYY-MM-01
    function monthKey(d: Date) {
      return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    }

    const countsByMonth = new Map<string, { opened: number; closed: number; days: number[] }>();

    for (const t of ticketsAll) {
      const created = new Date(t.created_at);
      const mOpened = monthKey(created);
      const mOpenedEntry = countsByMonth.get(mOpened) ?? { opened: 0, closed: 0, days: [] };
      mOpenedEntry.opened += 1;
      countsByMonth.set(mOpened, mOpenedEntry);

      // determine closed month: prefer closed_at, otherwise archived history
      if (t.closed_at) {
        const closed = new Date(t.closed_at);
        const mClosed = monthKey(closed);
        const mClosedEntry = countsByMonth.get(mClosed) ?? { opened: 0, closed: 0, days: [] };
        mClosedEntry.closed += 1;
        // accumulate resolution days when closed_at exists
        const days = (closed.getTime() - created.getTime()) / (1000 * 3600 * 24);
        mClosedEntry.days.push(days);
        countsByMonth.set(mClosed, mClosedEntry);
      } else if (t.status === "archived") {
        const archivedAt = archivedDateByTicket.get(t.id);
        if (archivedAt) {
          const closed = new Date(archivedAt);
          const mClosed = monthKey(closed);
          const mClosedEntry = countsByMonth.get(mClosed) ?? { opened: 0, closed: 0, days: [] };
          mClosedEntry.closed += 1;
          countsByMonth.set(mClosed, mClosedEntry);
        } else {
          // no archived timestamp; count as closed in created month as fallback
          const mClosed = monthKey(created);
          const mClosedEntry = countsByMonth.get(mClosed) ?? { opened: 0, closed: 0, days: [] };
          mClosedEntry.closed += 1;
          countsByMonth.set(mClosed, mClosedEntry);
        }
      }
    }

    // Build sorted months between dateFrom and dateTo by month start
    const start = new Date(data.dateFrom);
    const end = new Date(data.dateTo);
    const months: string[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur < end) {
      months.push(monthKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }

    const ticketsByMonth = months.map((m) => {
      const entry = countsByMonth.get(m) ?? { opened: 0, closed: 0, days: [] };
      return {
        month: m,
        label: new Date(m).toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        opened: entry.opened,
        closed: entry.closed,
        avg_days: entry.days.length
          ? Number((entry.days.reduce((a, b) => a + b, 0) / entry.days.length).toFixed(2))
          : null,
      };
    });

    const slaByTechnician = new Map<string | null, { total: number; respected: number }>();
    const priorityHours = new Map<string, { totalHours: number; completed: number }>();
    for (const t of ticketsAll) {
      const closedAt = t.closed_at || archivedDateByTicket.get(t.id) || null;
      const isClosed = Boolean(closedAt) || t.status === "completed" || t.status === "archived";
      const hasSla = Boolean(t.sla_deadline);
      if (hasSla && (isClosed || t.sla_breached)) {
        const key = t.assignee_id ?? null;
        const entry = slaByTechnician.get(key) ?? { total: 0, respected: 0 };
        entry.total += 1;
        const respected =
          !t.sla_breached && (!closedAt || new Date(closedAt) <= new Date(t.sla_deadline));
        if (respected) entry.respected += 1;
        slaByTechnician.set(key, entry);
      }
      if (closedAt && t.priority) {
        const hours =
          (new Date(closedAt).getTime() - new Date(t.created_at).getTime()) / (1000 * 3600);
        if (Number.isFinite(hours) && hours >= 0) {
          const entry = priorityHours.get(t.priority) ?? { totalHours: 0, completed: 0 };
          entry.totalHours += hours;
          entry.completed += 1;
          priorityHours.set(t.priority, entry);
        }
      }
    }

    const technicianKpi = ((technicianRes.data ?? []) as any[]).map((row) => {
      const key = row.technician_id ?? null;
      const sla = slaByTechnician.get(key) ?? { total: 0, respected: 0 };
      return {
        technician_id: key,
        full_name: row.full_name || "Non assegnato",
        assigned: Number(row.assigned ?? 0),
        completed: Number(row.completed ?? 0),
        avg_days: row.avg_days == null ? null : Number(row.avg_days),
        sla_total: sla.total,
        sla_respected: sla.respected,
        sla_respected_pct: sla.total ? Math.round((sla.respected / sla.total) * 100) : null,
      };
    });

    const opened = ticketsByMonth.reduce((sum, row) => sum + row.opened, 0);
    const closed = ticketsByMonth.reduce((sum, row) => sum + row.closed, 0);
    const avgValues = ticketsByMonth
      .map((row) => row.avg_days)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    const slaTotals = Array.from(slaByTechnician.values()).reduce(
      (acc, row) => ({ total: acc.total + row.total, respected: acc.respected + row.respected }),
      { total: 0, respected: 0 },
    );
    const priorityResolution: PriorityResolutionMetric[] = (
      [
        { priority: "high", label: "Alta", avg_hours: null, completed: 0 },
        { priority: "med", label: "Media", avg_hours: null, completed: 0 },
        { priority: "low", label: "Bassa", avg_hours: null, completed: 0 },
      ] satisfies PriorityResolutionMetric[]
    ).map((row) => {
      const entry = priorityHours.get(row.priority);
      return {
        ...row,
        completed: entry?.completed ?? 0,
        avg_hours: entry?.completed
          ? Number((entry.totalHours / entry.completed).toFixed(1))
          : null,
      };
    });

    return {
      ticketsByMonth,
      technicianKpi,
      priorityResolution,
      summary: {
        opened,
        closed,
        avgDays: avgValues.length
          ? Number((avgValues.reduce((sum, value) => sum + value, 0) / avgValues.length).toFixed(2))
          : null,
        slaRespectedPct: slaTotals.total
          ? Math.round((slaTotals.respected / slaTotals.total) * 100)
          : null,
        slaRespected: slaTotals.respected,
        slaTotal: slaTotals.total,
      },
    };
  });

/**
 * Pure computation: merge KPI data, profiles, roles, and open-ticket counts
 * into the technician stats rows consumed by TeamActivityWidget and TechnicianStatsWidget.
 * Extracted for testability.
 */
export function computeTechnicianStats(
  kpiData: any[],
  roles: any[],
  profiles: any[],
  openTicketsData: any[],
): any[] {
  const kpiById = new Map<string | null, any>();
  for (const row of kpiData) {
    kpiById.set(row.technician_id ?? null, row);
  }

  const assignableIds = new Set((roles ?? []).map((r: any) => r.user_id));

  const openCountByTech = new Map<string, number>();
  for (const t of openTicketsData ?? []) {
    const tid = t.assignee_id as string;
    openCountByTech.set(tid, (openCountByTech.get(tid) ?? 0) + 1);
  }

  const out: any[] = [];
  for (const p of profiles ?? []) {
    if (!assignableIds.has(p.id)) continue;
    const row = kpiById.get(p.id) ?? null;
    const assigned = row ? Number(row.assigned ?? 0) : 0;
    const completed = row ? Number(row.completed ?? 0) : 0;
    const avg_days = row && row.avg_days != null ? Number(row.avg_days) : null;
    const avg_resolution_ms = avg_days == null ? null : Math.round(avg_days * 24 * 3600 * 1000);
    const openTickets = openCountByTech.get(p.id) ?? 0;
    const full_name = p.full_name || "Non assegnato";
    const initials =
      (p.initials as string) ||
      (full_name || "")
        .split(" ")
        .map((s: string) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    const pending = openTickets;
    const active = assigned > 0 || openTickets > 0;
    out.push({
      id: p.id,
      name: full_name,
      initials,
      assigned,
      completed,
      pending,
      avg_days,
      avg_resolution_ms,
      active,
      title: null,
    });
  }

  return out;
}

export const getTechnicianStats = createServerFn({ method: "GET" })
  .validator(z.any())
  .handler(async ({ data }): Promise<any[]> => {
    const period = (data?.period as string) ?? "week";
    const now = new Date();
    let from = new Date();
    if (period === "today") {
      from.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // week: start of ISO week (Monday)
      const day = now.getDay();
      const diff = (day + 6) % 7; // days since Monday
      from = new Date(now);
      from.setDate(now.getDate() - diff);
      from.setHours(0, 0, 0, 0);
    }
    const to = new Date(now);

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

    // Fetch all profiles that have role admin or tech so we can include users with 0 assigned
    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
        supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
      ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const techIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    const { data: openTicketsData } = techIds.length
      ? await supabaseAdmin
          .from("tickets")
          .select("assignee_id")
          .in("assignee_id", techIds)
          .or("status.neq.completed,status.neq.archived")
          .limit(5000)
      : { data: [] as any[] };

    return computeTechnicianStats(
      (technicianRes.data ?? []) as any[],
      roles ?? [],
      profiles ?? [],
      openTicketsData ?? [],
    );
  });

export const getTechnicianWeeklyActivity = createServerFn({ method: "GET" })
  .validator(z.any())
  .handler(async ({ data }): Promise<any> => {
    const weekOffset = Number(data?.weekOffset || 0); // 0 = current week, -1 previous, +1 next
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      data?.accessToken || "",
    );
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const now = new Date();
    // compute start of current ISO week (Monday)
    const day = now.getDay();
    const diff = (day + 6) % 7; // days since Monday
    const start = new Date(now);
    start.setDate(now.getDate() - diff + weekOffset * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    const fromIso = start.toISOString();
    const toIso = end.toISOString();

    // get KPI by day per technician
    // Use closed_at + status to count ticket closures per day (completed or archived)
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from("tickets")
      .select("assignee:assignee_id, closed_at, status")
      .gte("closed_at", fromIso)
      .lt("closed_at", toIso)
      .in("status", ["completed", "archived"] as any) // count only closed tickets
      .not("closed_at", "is", null)
      .order("assignee_id", { ascending: true });

    if (activityError) throw activityError;

    // fetch technicians (admin/tech roles)
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
      supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
    ]);

    const assignableIds = new Set((roles ?? []).map((r: any) => r.user_id));
    const technicians = (profiles ?? [])
      .filter((p: any) => assignableIds.has(p.id))
      .map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        initials: p.initials || p.full_name.slice(0, 2).toUpperCase(),
      }));

    // build map technician -> date -> count
    const map = new Map<string, Map<string, number>>();
    for (const t of technicians) map.set(t.id, new Map());

    for (const row of activityData ?? ([] as any[])) {
      const tid = row.assignee ?? null;
      if (!tid || !assignableIds.has(tid)) continue;
      // use closed_at date to count closures per day
      const d = new Date(row.closed_at);
      const dateKey = d.toISOString().slice(0, 10);
      const tm = map.get(tid)!;
      tm.set(dateKey, (tm.get(dateKey) || 0) + 1);
    }

    // prepare output: technicians with counts for each day of the week
    const out = technicians.map((t: any) => {
      const counts: number[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        counts.push(map.get(t.id)?.get(key) || 0);
      }
      return { id: t.id, name: t.full_name, initials: t.initials, counts };
    });

    return { weekStart: start.toISOString(), weekEnd: end.toISOString(), technicians: out };
  });

/**
 *
 */
export interface OverdueTicketRow {
  id: string;
  ticket_code: string;
  status: string;
  priority: string;
  client: string | null;
  model: string | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string | null;
  days_open: number;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
}

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
        `
        id,
        ticket_code,
        status,
        priority,
        client,
        model,
        created_at,
        updated_at,
        sla_deadline,
        sla_breached,
        assignee:assignee_id(full_name)
      `,
      )
      .in("status", ["in-progress", "pending", "testing", "ready"] as any)
      .or(`sla_breached.eq.true,sla_deadline.lte.${warningCutoff},updated_at.lt.${cutoff}`)
      .order("sla_deadline", { ascending: true, nullsFirst: false })
      .limit(500);

    if (error) throw error;

    return ((tickets ?? []) as any[]).map((t: any) => ({
      id: t.id,
      ticket_code: t.ticket_code,
      status: t.status,
      priority: t.priority,
      client: t.client ?? null,
      model: t.model ?? null,
      assignee_name: t.assignee?.full_name ?? null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      days_open: Math.round((Date.now() - new Date(t.created_at).getTime()) / (1000 * 3600 * 24)),
      sla_deadline: t.sla_deadline ?? null,
      sla_breached: t.sla_breached ?? null,
    }));
  });

export const getTechnicianRadarMetrics = createServerFn({ method: "GET" })
  .validator(z.any())
  .handler(async ({ data }): Promise<any> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      data?.accessToken || "",
    );
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const dateFrom = data?.dateFrom ?? null;
    const dateTo = data?.dateTo ?? null;

    // Fetch assignable technicians
    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
      await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
        supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
      ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const assignableIds = new Set((roles ?? []).map((r: any) => r.user_id));

    // Fetch tickets in range (by creation) to compute assigned/volume
    // include `status` so we can treat archived tickets as closed even when closed_at is null
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

    // Fetch first update times (ticket_notes) for these tickets
    let notes: any[] = [];
    if (ticketIds.length) {
      const notesRes = await supabaseAdmin
        .from("ticket_notes")
        .select("ticket_id, created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });
      if (notesRes.error) throw notesRes.error;
      notes = (notesRes.data ?? []) as any[];
    }

    // Fetch status history to count reopens
    let history: any[] = [];
    if (ticketIds.length) {
      const histRes = await supabaseAdmin
        .from("ticket_status_history")
        .select("ticket_id, changed_at, from_status, to_status")
        .in("ticket_id", ticketIds)
        .order("changed_at", { ascending: true });
      if (histRes.error) throw histRes.error;
      history = (histRes.data ?? []) as any[];
    }

    // Aggregate per technician
    const byTech = new Map<
      string,
      {
        assigned: number;
        completed: number;
        totalResolutionDays: number;
        resolutionCount: number;
        totalFirstRespMs: number;
        firstRespCount: number;
        reopenCount: number;
      }
    >();
    for (const p of profiles ?? []) {
      if (!assignableIds.has(p.id)) continue;
      byTech.set(p.id, {
        assigned: 0,
        completed: 0,
        totalResolutionDays: 0,
        resolutionCount: 0,
        totalFirstRespMs: 0,
        firstRespCount: 0,
        reopenCount: 0,
      });
    }

    const notesByTicket = new Map<string, string>();
    for (const n of notes) {
      if (!notesByTicket.has(n.ticket_id)) notesByTicket.set(n.ticket_id, n.created_at);
    }

    const historyByTicket = new Map<string, any[]>();
    for (const h of history) {
      const arr = historyByTicket.get(h.ticket_id) ?? [];
      arr.push(h);
      historyByTicket.set(h.ticket_id, arr);
    }

    for (const t of tickets) {
      const tid = t.assignee_id;
      if (!tid || !byTech.has(tid)) continue;
      const s = byTech.get(tid)!;
      s.assigned += 1;
      // consider a ticket closed if it has `closed_at` OR if its status is 'archived'
      const isClosed = Boolean(t.closed_at) || t.status === "archived";
      if (isClosed) {
        s.completed += 1;
        // only compute resolution days when closed_at is available
        if (t.closed_at) {
          const created = new Date(t.created_at).getTime();
          const closed = new Date(t.closed_at).getTime();
          const days = (closed - created) / (1000 * 3600 * 24);
          s.totalResolutionDays += days;
          s.resolutionCount += 1;
        }
      }
      // first response
      const firstNote = notesByTicket.get(t.id);
      if (firstNote) {
        const created = new Date(t.created_at).getTime();
        const first = new Date(firstNote).getTime();
        s.totalFirstRespMs += Math.max(0, first - created);
        s.firstRespCount += 1;
      }
      // reopens
      const hist = historyByTicket.get(t.id) ?? [];
      for (const h of hist) {
        // consider reopen when to_status becomes 'pending' or 'open' after being closed/archived
        if (h.to_status === "pending" || h.to_status === "open") {
          // optionally check time window
          if (!dateFrom || (h.changed_at >= dateFrom && (!dateTo || h.changed_at <= dateTo))) {
            s.reopenCount += 1;
          }
        }
      }
    }

    // compute team max assigned for volume normalization
    const assignedValues = Array.from(byTech.values()).map((v) => v.assigned);
    const maxAssigned = assignedValues.length ? Math.max(...assignedValues) : 1;

    const rows: any[] = [];
    // create a map for profile full names
    const profileNameById = new Map<string, string>();
    for (const p of profiles ?? []) profileNameById.set(p.id, p.full_name || "");

    for (const [id, v] of byTech.entries()) {
      const completionPct = v.assigned > 0 ? (v.completed / v.assigned) * 100 : 0;
      const avgResolutionDays = v.resolutionCount
        ? v.totalResolutionDays / v.resolutionCount
        : null;
      const avgFirstRespMs = v.firstRespCount ? v.totalFirstRespMs / v.firstRespCount : null;
      const reopenCount = v.reopenCount;
      const reliabilityPct =
        v.completed > 0 ? ((v.completed - reopenCount) / v.completed) * 100 : 0;

      rows.push({
        id,
        technician_id: id,
        full_name: profileNameById.get(id) ?? "Non assegnato",
        assigned: v.assigned,
        completed: v.completed,
        completionPct: Math.round(completionPct),
        avgResolutionDays,
        avgFirstRespMs,
        reopenCount,
        reliabilityPct: Math.round(reliabilityPct),
        volumeScore: Math.round((v.assigned / Math.max(1, maxAssigned)) * 100),
      });
    }

    // normalize to 0-100 where needed (velocità and reattività are inverted: smaller -> higher)
    // build numeric arrays excluding nulls for robust min/max
    const numericAvgRes = rows.map((r) => r.avgResolutionDays).filter((v) => v != null) as number[];
    const numericFirstResp = rows.map((r) => r.avgFirstRespMs).filter((v) => v != null) as number[];
    const resRange = numericAvgRes.length
      ? { min: Math.min(...numericAvgRes), max: Math.max(...numericAvgRes) }
      : { min: 0, max: 0 };
    const firstRange = numericFirstResp.length
      ? { min: Math.min(...numericFirstResp), max: Math.max(...numericFirstResp) }
      : { min: 0, max: 0 };

    const normalized = rows.map((r) => {
      const vol = clamp(r.volumeScore, 0, 100);
      const comp = clamp(r.completionPct, 0, 100);
      const rel = clamp(r.reliabilityPct, 0, 100);

      // Velocita: invert avgResolutionDays (smaller = better)
      let vVel = 0;
      if (resRange.max === resRange.min) {
        vVel = resRange.max > 0 ? 100 : 0;
      } else {
        const avgR = r.avgResolutionDays == null ? resRange.max : r.avgResolutionDays;
        vVel = Math.round(((resRange.max - avgR) / (resRange.max - resRange.min)) * 100);
      }

      // Reattivita: invert avgFirstRespMs (smaller = better)
      let vRea = 0;
      if (firstRange.max === firstRange.min) {
        vRea = firstRange.max > 0 ? 100 : 0;
      } else {
        const avgF = r.avgFirstRespMs == null ? firstRange.max : r.avgFirstRespMs;
        vRea = Math.round(((firstRange.max - avgF) / (firstRange.max - firstRange.min)) * 100);
      }

      return {
        ...r,
        normalized: {
          volume: vol,
          velocita: clamp(vVel, 0, 100),
          completamento: comp,
          reattivita: clamp(vRea, 0, 100),
          affidabilita: rel,
        },
      };
    });

    return { dateFrom, dateTo, rows: normalized };
  });

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
