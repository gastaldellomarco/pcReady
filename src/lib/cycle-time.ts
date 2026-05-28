import type { TicketStatus } from "@/lib/pcready";

/**
 * Per-status cycle time thresholds (in hours).
 * Green: duration < good
 * Yellow: duration < warning
 * Red: duration >= warning
 */
export interface CycleThresholds {
  good: number;   // green
  warning: number; // amber/red threshold
}

/** Traffic-light color for the cycle-time indicator badge. */
export type CycleColor = "ok" | "warning" | "overdue";

/**
 * Default thresholds per status (hours).
 * Customisable via app settings in the future.
 */
const DEFAULT_CYCLE_THRESHOLDS: Record<TicketStatus, CycleThresholds> = {
  pending:      { good: 1, warning: 4 },
  "in-progress": { good: 4, warning: 24 },
  testing:      { good: 4, warning: 24 },
  ready:        { good: 8, warning: 48 },
  completed:    { good: Infinity, warning: Infinity },
  archived:     { good: Infinity, warning: Infinity },
};

/** Lead time thresholds (hours since creation). */
const LEAD_THRESHOLDS: CycleThresholds = {
  good: 24,    // < 1 day
  warning: 72, // < 3 days
};

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Compute cycle metrics for a ticket in its current status.
 *
 * @param createdAt   ISO string of ticket creation
 * @param statusChangedAt  ISO string of last status change (or `createdAt` if never changed)
 * @param currentStatus    The ticket's current status lane
 * @returns Duration data with traffic-light level + label
 */
export function computeCycleTime(
  createdAt?: string | null,
  statusChangedAt?: string | null,
  currentStatus?: TicketStatus | null,
) {
  const now = Date.now();

  const createdMs = parseIso(createdAt);
  const statusMs = parseIso(statusChangedAt) ?? createdMs;
  const cycleMs = statusMs != null ? now - statusMs : null;
  const leadMs = createdMs != null ? now - createdMs : null;

  const cycle = cycleMs != null ? msToLabel(cycleMs, "cycle") : null;
  const lead  = leadMs  != null ? msToLabel(leadMs, "lead") : null;

  const cycleColor: CycleColor | null =
    currentStatus && cycleMs != null && currentStatus in DEFAULT_CYCLE_THRESHOLDS
      ? classify(cycleMs, DEFAULT_CYCLE_THRESHOLDS[currentStatus])
      : null;

  const leadColor: CycleColor | null =
    leadMs != null
      ? classify(leadMs, LEAD_THRESHOLDS)
      : null;

  return { cycle, lead, cycleColor, leadColor, cycleMs, leadMs };
}

/* ------------------------------------------------------------------ */
/*  Traffic-light palette                                              */
/* ------------------------------------------------------------------ */

export const CYCLE_COLORS: Record<CycleColor, string> = {
  ok:      "#16A34A", // green
  warning: "#CA8A04", // amber
  overdue: "#DC2626", // red
};

export const CYCLE_BG_COLORS: Record<CycleColor, string> = {
  ok:      "#DCFCE7",
  warning: "#FEF9C3",
  overdue: "#FEE2E2",
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function parseIso(s?: string | null): number | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  } catch {
    return null;
  }
}

function classify(durationMs: number, { good, warning }: CycleThresholds): CycleColor {
  const hours = durationMs / 3_600_000;
  if (hours < good) return "ok";
  if (hours < warning) return "warning";
  return "overdue";
}

function msToLabel(ms: number, type: "cycle" | "lead"): string {
  // Guard against negative durations (clock drift)
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (type === "cycle") {
    // Compact: "5m", "3h", "2g"
    if (totalMinutes < 60) return `${totalMinutes}m`;
    if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${days}g ${remHours}h`;
  }

  // Lead time: more verbose
  if (totalMinutes < 60) return `${totalMinutes}m`;
  if (hours < 24) return `${hours}h ${minutes}m`;
  return `${days}g ${remHours}h`;
}
