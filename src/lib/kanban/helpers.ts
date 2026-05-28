import { pcReadyColors } from "@/lib/design-system";
import { computeSlaStatus, type TicketPriority } from "@/lib/pcready";

/**
 * Minimal card-like shape needed to compute an SLA indicator.
 *
 * @description Avoids importing the full `Card` type from route files,
 * preventing circular dependencies. Both `KanbanColumnsView` and `SwimLaneRow`
 * satisfy this interface.
 */
export type SlaCardLike = {
  created_at?: string | null;
  updated_at?: string | null;
  priority: TicketPriority;
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
};

/**
 * SLA indicator for a Kanban card.
 *
 * @description Returns color, label, and status for the SLA badge displayed on
 * cards in the Kanban views. Uses `computeSlaStatus` to determine the current
 * SLA state based on priority, deadlines, and breach flags.
 *
 * @param card - A card-like object with the fields needed for SLA computation
 * @returns An object with color hex, human-readable label, and status string
 *
 * @example
 * const indicator = slaIndicator({ created_at: "2026-05-01T12:00:00Z", priority: "high" });
 * // → { color: "#DC2626", label: "SLA violato", status: "overdue" }
 */
export function slaIndicator(card: SlaCardLike) {
  const sla = computeSlaStatus(
    card.created_at || card.updated_at || new Date().toISOString(),
    card.priority,
    undefined,
    card.due_date || card.sla_deadline,
    card.sla_breached,
  );
  if (sla.status === "overdue")
    return { color: pcReadyColors.danger, label: "SLA violato", status: "overdue" as const };
  if (sla.status === "warning")
    return { color: pcReadyColors.warning, label: "In scadenza", status: "warning" as const };
  return { color: pcReadyColors.success, label: "SLA OK", status: "ok" as const };
}
