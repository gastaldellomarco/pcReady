import { Clock } from "lucide-react";
import { computeCycleTime, CYCLE_COLORS, CYCLE_BG_COLORS } from "@/lib/cycle-time";
import type { TicketStatus } from "@/lib/pcready";

/**
 * Displays how long a ticket has been in its current column.
 *
 * @description Computes cycle time from status change timestamp (or fallback to
 * created_at / updated_at) and renders a compact pill with the duration. Shows
 * both cycle time and lead time when available.
 */
export function TimeInColumnLabel({
  updatedAt,
  status,
  createdAt,
  statusChangedAt,
}: {
  updatedAt?: string | null;
  status?: TicketStatus;
  createdAt?: string | null;
  statusChangedAt?: string | null;
}) {
  const actualChanged = statusChangedAt ?? createdAt ?? updatedAt;
  const { cycle, lead, cycleColor } = computeCycleTime(createdAt, actualChanged, status);
  if (!cycle) return null;

  const color = cycleColor ? CYCLE_COLORS[cycleColor] : undefined;
  const bgColor = cycleColor ? CYCLE_BG_COLORS[cycleColor] : undefined;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-mono font-medium leading-none"
      style={{
        background: bgColor ?? "transparent",
        color: color ?? "var(--text3)",
      }}
      title={
        lead ? `In questa colonna da ${cycle} · Aperto da ${lead}` : `In questa colonna da ${cycle}`
      }
    >
      {cycleColor && (
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      )}
      <Clock className="h-2.5 w-2.5" />
      {cycle}
    </span>
  );
}
