// ─── Pure types & computation for technician overview ────────────────
// Separated from the Supabase-bound server functions in user-profile.ts

/** Minimal closed-ticket shape needed for stats computation. */
export interface TechnicianOverviewTicket {
  created_at: string;
  closed_at: string | null;
}

/** Minimal intervention shape needed for stats computation. */
export interface TechnicianOverviewIntervention {
  started_at: string;
  duration_minutes: number;
}

export interface TechnicianOverviewInput {
  closedTickets: TechnicianOverviewTicket[];
  interventions: TechnicianOverviewIntervention[];
  /** Start of the 6-month window (1st of the month, midnight). */
  since: Date;
}

export interface TechnicianOverviewStats {
  closedTickets: number;
  averageResolutionHours: number | null;
  workedHours: number;
}

export interface TechnicianOverviewMonth {
  month: string;
  closedTickets: number;
  workedHours: number;
}

export interface TechnicianOverviewBadge {
  key: string;
  label: string;
  description: string;
  achieved: boolean;
}

export interface TechnicianOverviewComputed {
  stats: TechnicianOverviewStats;
  monthlyActivity: TechnicianOverviewMonth[];
  badges: TechnicianOverviewBadge[];
}

/**
 * Pure computation: given closed tickets, interventions, and a `since` date,
 * returns stats, monthly activity breakdown, and earned badges.
 *
 * Does NOT touch Supabase, auth, or the network.
 */
export function computeTechnicianOverview(
  input: TechnicianOverviewInput,
): TechnicianOverviewComputed {
  const { closedTickets, interventions, since } = input;

  // ── Average resolution hours ─────────────────────────────────────
  const averageResolutionHours = closedTickets.length
    ? closedTickets.reduce((sum, t) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.closed_at || t.created_at).getTime();
        return sum + Math.max(0, end - start) / 36e5;
      }, 0) / closedTickets.length
    : null;

  // ── Total worked hours ───────────────────────────────────────────
  const workedHours = interventions.reduce(
    (sum, i) => sum + i.duration_minutes / 60,
    0,
  );

  // ── Monthly activity (6-month window) ────────────────────────────
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

  const monthByKey = new Map(months.map((m) => [m.key, m]));
  for (const ticket of closedTickets) {
    const date = new Date(ticket.closed_at || ticket.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthByKey.get(key);
    if (bucket) bucket.closedTickets += 1;
  }
  for (const intervention of interventions) {
    const date = new Date(intervention.started_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthByKey.get(key);
    if (bucket) {
      bucket.workedHours += Math.round((intervention.duration_minutes / 60) * 10) / 10;
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────
  const stats: TechnicianOverviewStats = {
    closedTickets: closedTickets.length,
    averageResolutionHours:
      averageResolutionHours === null ? null : Math.round(averageResolutionHours * 10) / 10,
    workedHours: Math.round(workedHours * 10) / 10,
  };

  // ── Badges ────────────────────────────────────────────────────────
  const badges: TechnicianOverviewBadge[] = [
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
  ];

  return {
    stats,
    monthlyActivity: months.map(({ key: _key, ...rest }) => rest),
    badges,
  };
}
