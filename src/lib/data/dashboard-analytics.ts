// ─── Pure types & computation for dashboard analytics ──────────────────
// Separated from the Supabase-bound server functions in dashboard-analytics.ts

// ─── Types ────────────────────────────────────────────────────────────

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
  sla_total?: number;
  sla_respected?: number;
  sla_respected_pct?: number | null;
}

export interface PriorityResolutionMetric {
  priority: "high" | "med" | "low";
  label: string;
  avg_hours: number | null;
  completed: number;
}

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

export interface TechRoleRow {
  user_id: string;
  role?: string;
}

export interface TechProfileRow {
  id: string;
  full_name: string;
  initials: string | null;
}

export interface OpenTicketRow {
  assignee_id: string;
}

export interface WeeklyActivityTechnician {
  id: string;
  name: string;
  initials: string;
  counts: number[];
}

export interface WeeklyActivityResponse {
  weekStart: string;
  weekEnd: string;
  technicians: WeeklyActivityTechnician[];
}

export interface NormalizedMetrics {
  volume: number;
  velocita: number;
  completamento: number;
  reattivita: number;
  affidabilita: number;
}

export interface TechnicianRadarRow {
  id: string;
  technician_id: string;
  full_name: string;
  assigned: number;
  completed: number;
  completionPct: number;
  avgResolutionDays: number | null;
  avgFirstRespMs: number | null;
  reopenCount: number;
  reliabilityPct: number;
  volumeScore: number;
  normalized: NormalizedMetrics;
}

export interface TechnicianStatRow {
  id: string;
  name: string;
  initials: string;
  assigned: number;
  completed: number;
  pending: number;
  avg_days: number | null;
  avg_resolution_ms: number | null;
  active: boolean;
  title: string | null;
}

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

// ─── Input type for computeOverdueTickets pure computation ──────────

export interface OverdueTicketsInput {
  tickets: Array<{
    id: string;
    ticket_code: string;
    status: string;
    priority: string;
    client: string | null;
    model: string | null;
    created_at: string;
    updated_at: string | null;
    sla_deadline: string | null;
    sla_breached: boolean | null;
    assignee: { full_name: string } | null;
  }>;
  now: number;
}

// ─── Pure computation ──────────────────────────────────────────────────

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

// ─── Input / Output types for getDashboardAnalytics pure computation ──

export interface DashboardAnalyticsInput {
  ticketsAll: Array<{
    id: string;
    created_at: string;
    closed_at: string | null;
    status: string;
    assignee_id: string | null;
    priority: string;
    sla_deadline: string | null;
    sla_breached: boolean | null;
  }>;
  archivedHist: Array<{
    ticket_id: string;
    changed_at: string;
  }>;
  technicianData: Array<{
    technician_id: string | null;
    full_name?: string;
    assigned?: number;
    completed?: number;
    avg_days?: number | null;
  }>;
  dateFrom: string;
  dateTo: string;
}

/**
 * Returns a UTC-based month key like "2026-06-01" for the given date.
 * Uses Date.UTC() to avoid a timezone bug: `new Date(y, m, 1).toISOString()`
 * creates midnight in the LOCAL timezone, which in UTC+X zones (e.g. Europe/Rome)
 * crosses the UTC day boundary and produces keys like "2026-05-31" instead of
 * "2026-06-01". Date.UTC() always gives midnight UTC on the first of the month.
 */
function monthKey(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * Pure computation: given ticket lists, archived history, and technician KPI rows,
 * returns the full DashboardAnalytics object without touching Supabase or auth.
 */
export function computeDashboardAnalytics(input: DashboardAnalyticsInput): DashboardAnalytics {
  const { ticketsAll, archivedHist, technicianData, dateFrom, dateTo } = input;

  // ── Build archived-date lookup ─────────────────────────────────────
  const archivedDateByTicket = new Map<string, string>();
  for (const h of archivedHist) {
    if (!archivedDateByTicket.has(h.ticket_id))
      archivedDateByTicket.set(h.ticket_id, h.changed_at);
  }

  // ── Tickets-by-month aggregation ────────────────────────────────────
  const countsByMonth = new Map<string, { opened: number; closed: number; days: number[] }>();

  for (const t of ticketsAll) {
    const created = new Date(t.created_at);
    const mOpened = monthKey(created);
    const mOpenedEntry = countsByMonth.get(mOpened) ?? { opened: 0, closed: 0, days: [] };
    mOpenedEntry.opened += 1;
    countsByMonth.set(mOpened, mOpenedEntry);

    if (t.closed_at) {
      const closed = new Date(t.closed_at);
      const mClosed = monthKey(closed);
      const mClosedEntry = countsByMonth.get(mClosed) ?? { opened: 0, closed: 0, days: [] };
      mClosedEntry.closed += 1;
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
        const mClosed = monthKey(created);
        const mClosedEntry = countsByMonth.get(mClosed) ?? { opened: 0, closed: 0, days: [] };
        mClosedEntry.closed += 1;
        countsByMonth.set(mClosed, mClosedEntry);
      }
    }
  }

  const start = new Date(dateFrom);
  const end = new Date(dateTo);
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur < end) {
    months.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const ticketsByMonth: DashboardMonthMetric[] = months.map((m) => {
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

  // ── SLA & priority aggregations ─────────────────────────────────────
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
        !t.sla_breached && (!closedAt || new Date(closedAt) <= new Date(t.sla_deadline!));
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

  // ── Technician KPI ──────────────────────────────────────────────────
  const technicianKpi: TechnicianKpi[] = technicianData.map((row) => {
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

  // ── Summary ─────────────────────────────────────────────────────────
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
      { priority: "high" as const, label: "Alta", avg_hours: null, completed: 0 },
      { priority: "med" as const, label: "Media", avg_hours: null, completed: 0 },
      { priority: "low" as const, label: "Bassa", avg_hours: null, completed: 0 },
    ]
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
}

/**
 * Pure computation: maps raw Supabase ticket rows into OverdueTicketRow[],
 * computing days_open from a given `now` timestamp (milliseconds since epoch).
 */
export function computeOverdueTickets(input: OverdueTicketsInput): OverdueTicketRow[] {
  return input.tickets.map((t) => ({
    id: t.id,
    ticket_code: t.ticket_code,
    status: t.status,
    priority: t.priority,
    client: t.client ?? null,
    model: t.model ?? null,
    assignee_name: t.assignee?.full_name ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
    days_open: Math.round((input.now - new Date(t.created_at).getTime()) / (1000 * 3600 * 24)),
    sla_deadline: t.sla_deadline ?? null,
    sla_breached: t.sla_breached ?? null,
  }));
}

/** Input for computePeriodRange. */
export type PeriodRangePeriod = "today" | "week" | "month";

export interface PeriodRange {
  from: Date;
  to: Date;
}

/**
 * Pure computation: given a period string and a `now` Date, returns the
 * { from, to } range for queries (stats, activity, etc.).
 * - "today": from = start of today, to = now
 * - "month": from = 1st of current month, to = now
 * - "week" (default): from = start of current week (Mon), to = now
 */
export function computePeriodRange(period: PeriodRangePeriod, now: Date): PeriodRange {
  let from = new Date(now);

  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // week (default): Monday of current week
    const day = now.getDay();
    const diff = (day + 6) % 7;
    from = new Date(now);
    from.setDate(now.getDate() - diff);
    from.setHours(0, 0, 0, 0);
  }

  return { from, to: new Date(now) };
}

export interface WeekRange {
  start: Date;
  end: Date;
}

/**
 * Pure computation: given a weekOffset (±N weeks from current) and a `now` Date,
 * returns the { start, end } of the target week (Mon 00:00 → Mon 00:00 +7 days).
 * - weekOffset=0 → current week
 * - weekOffset=-1 → previous week
 * - weekOffset=1 → next week
 */
export function computeWeekRange(weekOffset: number, now: Date): WeekRange {
  const day = now.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - diff + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

/**
 * Pure computation: merge KPI data, profiles, roles, and open-ticket counts
 * into the technician stats rows consumed by TeamActivityWidget and TechnicianStatsWidget.
 */
export function computeTechnicianStats(
  kpiData: TechnicianKpi[],
  roles: TechRoleRow[],
  profiles: TechProfileRow[],
  openTicketsData: OpenTicketRow[],
): TechnicianStatRow[] {
  const kpiById = new Map<string | null, TechnicianKpi>();
  for (const row of kpiData) {
    kpiById.set(row.technician_id ?? null, row);
  }

  const assignableIds = new Set((roles ?? []).map((r) => r.user_id));

  const openCountByTech = new Map<string, number>();
  for (const t of openTicketsData ?? []) {
    const tid = t.assignee_id;
    openCountByTech.set(tid, (openCountByTech.get(tid) ?? 0) + 1);
  }

  const out: TechnicianStatRow[] = [];
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

/** Input for computeWeeklyActivity. */
export interface WeeklyActivityInput {
  activityData: Array<{ assignee: string | null; closed_at: string }>;
  technicians: { id: string; full_name: string; initials: string }[];
  assignableIds: Set<string>;
  weekStart: Date;
}

/**
 * Pure computation: given closed-ticket activity rows, technician list,
 * assignable technician IDs, and a week-start date, returns daily closed-ticket
 * counts per technician for the 7-day window starting at `weekStart`.
 *
 * - Buckets each row into a `YYYY-MM-DD` key using the row's `closed_at` date.
 * - Ignores rows whose `assignee` is not in the `assignableIds` set.
 * - Returns a `WeeklyActivityResponse` with ISO week boundaries and a per-tech
 *   array of 7 daily counts (Monday through Sunday).
 */
export function computeWeeklyActivity(input: WeeklyActivityInput): WeeklyActivityResponse {
  const { activityData, technicians, assignableIds, weekStart } = input;
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  const map = new Map<string, Map<string, number>>();
  for (const t of technicians) map.set(t.id, new Map());

  for (const row of activityData ?? []) {
    const tid = row.assignee ?? null;
    if (!tid || !assignableIds.has(tid)) continue;
    const tm = map.get(tid);
    if (!tm) continue; // defensive: assignableId not in technicians list
    const d = new Date(row.closed_at);
    const dateKey = d.toISOString().slice(0, 10);
    tm.set(dateKey, (tm.get(dateKey) || 0) + 1);
  }

  const out: WeeklyActivityTechnician[] = technicians.map((t) => {
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
}

/** Input for computeRadarMetrics. */
export interface RadarMetricsInput {
  roles: TechRoleRow[];
  profiles: TechProfileRow[];
  tickets: Array<{
    id: string;
    assignee_id: string | null;
    created_at: string;
    closed_at: string | null;
    status: string;
  }>;
  notes: Array<{ ticket_id: string; created_at: string }>;
  history: Array<{
    ticket_id: string;
    changed_at: string;
    from_status: string;
    to_status: string;
  }>;
  dateFrom?: string | null;
  dateTo?: string | null;
}

/**
 * Pure computation: computes per-technician radar metrics from raw ticket,
 * note, and history rows, plus role and profile data.
 *
 * For each assignable technician, aggregates:
 * - **assigned** / **completed** ticket counts
 * - **completionPct** — percentage of assigned tickets that are completed
 * - **avgResolutionDays** — mean resolution time for closed tickets with a `closed_at`
 * - **avgFirstRespMs** — mean first-response latency (first note vs ticket creation)
 * - **reopenCount** — transitions back to "pending" or "open" within the optional
 *   `dateFrom`–`dateTo` window
 * - **reliabilityPct** — completed tickets that were never reopened
 * - **volumeScore** — relative volume (0–100) compared to the most-loaded technician
 *
 * Normalized metrics (0–100) are derived by min-max scaling across all technicians:
 * `volume`, `velocita` (resolution speed), `completamento`,
 * `reattivita` (first-response speed), `affidabilita` (reliability).
 */
export function computeRadarMetrics(input: RadarMetricsInput): TechnicianRadarRow[] {
  const { roles, profiles, tickets, notes, history, dateFrom, dateTo } = input;

  const assignableIds = new Set((roles ?? []).map((r) => r.user_id));

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

  const historyByTicket = new Map<
    string,
    Array<{ changed_at: string; from_status: string; to_status: string }>
  >();
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
    const isClosed = Boolean(t.closed_at) || t.status === "archived";
    if (isClosed) {
      s.completed += 1;
      if (t.closed_at) {
        const created = new Date(t.created_at).getTime();
        const closed = new Date(t.closed_at).getTime();
        const days = (closed - created) / (1000 * 3600 * 24);
        s.totalResolutionDays += days;
        s.resolutionCount += 1;
      }
    }
    const firstNote = notesByTicket.get(t.id);
    if (firstNote) {
      const created = new Date(t.created_at).getTime();
      const first = new Date(firstNote).getTime();
      s.totalFirstRespMs += Math.max(0, first - created);
      s.firstRespCount += 1;
    }
    const hist = historyByTicket.get(t.id) ?? [];
    for (const h of hist) {
      if (h.to_status === "pending" || h.to_status === "open") {
        if (!dateFrom || (h.changed_at >= dateFrom && (!dateTo || h.changed_at <= dateTo))) {
          s.reopenCount += 1;
        }
      }
    }
  }

  const assignedValues = Array.from(byTech.values()).map((v) => v.assigned);
  const maxAssigned = assignedValues.length ? Math.max(...assignedValues) : 1;

  const profileNameById = new Map<string, string>();
  for (const p of profiles ?? []) profileNameById.set(p.id, p.full_name || "");

  const rows: Array<Omit<TechnicianRadarRow, "normalized">> = [];
  for (const [id, v] of byTech.entries()) {
    const completionPct = v.assigned > 0 ? (v.completed / v.assigned) * 100 : 0;
    const avgResolutionDays = v.resolutionCount ? v.totalResolutionDays / v.resolutionCount : null;
    const avgFirstRespMs = v.firstRespCount ? v.totalFirstRespMs / v.firstRespCount : null;
    const reopenCount = v.reopenCount;
    const reliabilityPct = v.completed > 0 ? ((v.completed - reopenCount) / v.completed) * 100 : 0;

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

  const numericAvgRes = rows.map((r) => r.avgResolutionDays).filter((v) => v != null) as number[];
  const numericFirstResp = rows.map((r) => r.avgFirstRespMs).filter((v) => v != null) as number[];
  const resRange = numericAvgRes.length
    ? { min: Math.min(...numericAvgRes), max: Math.max(...numericAvgRes) }
    : { min: 0, max: 0 };
  const firstRange = numericFirstResp.length
    ? { min: Math.min(...numericFirstResp), max: Math.max(...numericFirstResp) }
    : { min: 0, max: 0 };

  return rows.map((r) => {
    const vol = clamp(r.volumeScore, 0, 100);
    const comp = clamp(r.completionPct, 0, 100);
    const rel = clamp(r.reliabilityPct, 0, 100);

    let vVel = 0;
    if (resRange.max === resRange.min) {
      vVel = resRange.max > 0 ? 100 : 0;
    } else {
      const avgR = r.avgResolutionDays == null ? resRange.max : r.avgResolutionDays;
      vVel = Math.round(((resRange.max - avgR) / (resRange.max - resRange.min)) * 100);
    }

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
}
