import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface DashboardMonthMetric {
  month: string;
  label: string;
  opened: number;
  closed: number;
  avg_days: number | null;
}

export interface TechnicianKpi {
  technician_id: string | null;
  full_name: string;
  assigned: number;
  completed: number;
  avg_days: number | null;
}

export interface DashboardAnalytics {
  ticketsByMonth: DashboardMonthMetric[];
  technicianKpi: TechnicianKpi[];
  summary: {
    opened: number;
    closed: number;
    avgDays: number | null;
  };
}

const AnalyticsInputSchema = z.object({
  accessToken: z.string().min(1),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: z.input<typeof AnalyticsInputSchema>) => AnalyticsInputSchema.parse(data))
  .handler(async ({ data }): Promise<DashboardAnalytics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const [monthlyRes, technicianRes] = await Promise.all([
      supabaseAdmin.rpc("get_tickets_by_month" as any, {
        date_from: data.dateFrom,
        date_to: data.dateTo,
      }),
      supabaseAdmin.rpc("get_technician_kpi" as any, {
        date_from: data.dateFrom,
        date_to: data.dateTo,
      }),
    ]);

    if (monthlyRes.error) throw monthlyRes.error;
    if (technicianRes.error) throw technicianRes.error;

    const ticketsByMonth = ((monthlyRes.data ?? []) as any[]).map((row) => {
      const month = String(row.month);
      return {
        month,
        label: new Date(month).toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        opened: Number(row.opened ?? 0),
        closed: Number(row.closed ?? 0),
        avg_days: row.avg_days == null ? null : Number(row.avg_days),
      };
    });

    const technicianKpi = ((technicianRes.data ?? []) as any[]).map((row) => ({
      technician_id: row.technician_id ?? null,
      full_name: row.full_name || "Non assegnato",
      assigned: Number(row.assigned ?? 0),
      completed: Number(row.completed ?? 0),
      avg_days: row.avg_days == null ? null : Number(row.avg_days),
    }));

    const opened = ticketsByMonth.reduce((sum, row) => sum + row.opened, 0);
    const closed = ticketsByMonth.reduce((sum, row) => sum + row.closed, 0);
    const avgValues = ticketsByMonth
      .map((row) => row.avg_days)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    return {
      ticketsByMonth,
      technicianKpi,
      summary: {
        opened,
        closed,
        avgDays: avgValues.length
          ? Number((avgValues.reduce((sum, value) => sum + value, 0) / avgValues.length).toFixed(2))
          : null,
      },
    };
  });

export const getTechnicianStats = createServerFn({ method: "GET" })
  .inputValidator((data: any) => data)
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
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data?.accessToken || "");
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const technicianRes = await supabaseAdmin.rpc("get_technician_kpi" as any, {
      date_from: from.toISOString(),
      date_to: to.toISOString(),
    });

    if (technicianRes.error) throw technicianRes.error;

    // Fetch all profiles that have role admin or tech so we can include users with 0 assigned
    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
      supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
    ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const kpiById = new Map<string | null, any>();
    ((technicianRes.data ?? []) as any[]).forEach((row) => kpiById.set(row.technician_id ?? null, row));

    const assignableIds = new Set((roles ?? []).map((r: any) => r.user_id));

    const out: any[] = [];
    for (const p of (profiles ?? [])) {
      if (!assignableIds.has(p.id)) continue;
      const row = kpiById.get(p.id) ?? null;
      const assigned = row ? Number(row.assigned ?? 0) : 0;
      const completed = row ? Number(row.completed ?? 0) : 0;
      const avg_days = row && row.avg_days != null ? Number(row.avg_days) : null;
      const avg_resolution_ms = avg_days == null ? null : Math.round(avg_days * 24 * 3600 * 1000);
      const full_name = p.full_name || "Non assegnato";
      const initials = (p.initials as string) || (full_name || "").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
      const pending = Math.max(0, assigned - completed);
      out.push({
        id: p.id,
        name: full_name,
        initials,
        assigned,
        completed,
        pending,
        avg_days,
        avg_resolution_ms,
        active: assigned > 0,
        title: null,
      });
    }

    return out;
  });

export const getTechnicianWeeklyActivity = createServerFn({ method: "GET" })
  .inputValidator((data: any) => data)
  .handler(async ({ data }): Promise<any> => {
    const weekOffset = Number(data?.weekOffset || 0); // 0 = current week, -1 previous, +1 next
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data?.accessToken || "");
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
    const { data: activityData, error: activityError } = await supabaseAdmin
      .from("tickets")
      .select("assignee:assignee_id, updated_at")
      .gte("updated_at", fromIso)
      .lt("updated_at", toIso)
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
      .map((p: any) => ({ id: p.id, full_name: p.full_name, initials: p.initials || p.full_name.slice(0, 2).toUpperCase() }));

    // build map technician -> date -> count
    const map = new Map<string, Map<string, number>>();
    for (const t of technicians) map.set(t.id, new Map());

    for (const row of (activityData ?? [] as any[])) {
      const tid = row.assignee ?? null;
      if (!tid || !assignableIds.has(tid)) continue;
      const d = new Date(row.updated_at);
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

export const getTechnicianRadarMetrics = createServerFn({ method: "GET" })
  .inputValidator((data: any) => {
    return data;
  })
  .handler(async ({ data }): Promise<any> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data?.accessToken || "");
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const dateFrom = data?.dateFrom ?? null;
    const dateTo = data?.dateTo ?? null;

    // Fetch assignable technicians
    const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["admin", "tech"]),
      supabaseAdmin.from("profiles").select("id, full_name, initials").order("full_name"),
    ]);

    if (rolesError) throw rolesError;
    if (profilesError) throw profilesError;

    const assignableIds = new Set((roles ?? []).map((r: any) => r.user_id));

    // Fetch tickets in range (by creation) to compute assigned/volume
    const ticketsQ = supabaseAdmin.from("tickets").select("id, assignee_id, created_at, closed_at");
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
    const byTech = new Map<string, { assigned: number; completed: number; totalResolutionDays: number; resolutionCount: number; totalFirstRespMs: number; firstRespCount: number; reopenCount: number }>();
    for (const p of (profiles ?? [])) {
      if (!assignableIds.has(p.id)) continue;
      byTech.set(p.id, { assigned: 0, completed: 0, totalResolutionDays: 0, resolutionCount: 0, totalFirstRespMs: 0, firstRespCount: 0, reopenCount: 0 });
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
      if (t.closed_at) {
        s.completed += 1;
        const created = new Date(t.created_at).getTime();
        const closed = new Date(t.closed_at).getTime();
        const days = (closed - created) / (1000 * 3600 * 24);
        s.totalResolutionDays += days;
        s.resolutionCount += 1;
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
        if ((h.to_status === "pending" || h.to_status === "open")) {
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
    for (const [id, v] of byTech.entries()) {
      const completionPct = v.assigned > 0 ? (v.completed / v.assigned) * 100 : 0;
      const avgResolutionDays = v.resolutionCount ? v.totalResolutionDays / v.resolutionCount : null;
      const avgFirstRespMs = v.firstRespCount ? v.totalFirstRespMs / v.firstRespCount : null;
      const reopenCount = v.reopenCount;
      const reliabilityPct = v.completed > 0 ? ((v.completed - reopenCount) / v.completed) * 100 : 0;

      rows.push({
        id,
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
    const allAvgRes = rows.map((r) => (r.avgResolutionDays == null ? 0 : r.avgResolutionDays));
    const allFirstResp = rows.map((r) => (r.avgFirstRespMs == null ? Number.MAX_SAFE_INTEGER : r.avgFirstRespMs));
    const minMax = (arr: number[]) => ({ min: Math.min(...arr), max: Math.max(...arr) });
    const resRange = minMax(allAvgRes);
    const firstRange = minMax(allFirstResp);

    const normalized = rows.map((r) => {
      const vol = clamp(r.volumeScore, 0, 100);
      const comp = clamp(r.completionPct, 0, 100);
      const rel = clamp(r.reliabilityPct, 0, 100);

      // Velocita: invert avgResolutionDays
      const avgR = r.avgResolutionDays == null ? resRange.max : r.avgResolutionDays;
      const vVel = Math.round(((resRange.max - avgR) / Math.max(1, resRange.max - resRange.min)) * 100);

      // Reattività: invert avgFirstRespMs (ms -> days not necessary for normalization)
      const avgF = r.avgFirstRespMs == null ? firstRange.max : r.avgFirstRespMs;
      const vRea = Math.round(((firstRange.max - avgF) / Math.max(1, firstRange.max - firstRange.min)) * 100);

      return {
        ...r,
        normalized: { volume: vol, velocita: clamp(vVel, 0, 100), completamento: comp, reattivita: clamp(vRea, 0, 100), affidabilita: rel },
      };
    });

    return { dateFrom, dateTo, rows: normalized };
  });

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
