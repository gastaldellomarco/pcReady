import type { TicketStatus } from "@/lib/pcready";

/**
 * The core column statuses shown in Kanban views.
 *
 * @description Used by KanbanColumnsView, SwimLaneRow, WipConfigDialog, and
 * KanbanWipWidget. Archived tickets are excluded from the main board and
 * handled separately (e.g. bulk archive action appends `"archived"` on the fly).
 */
export const KANBAN_STATUSES: TicketStatus[] = [
  "pending",
  "in-progress",
  "testing",
  "ready",
  "completed",
];

/** localStorage key for the Kanban view mode ("columns" | "swimlanes"). */
export const KANBAN_VIEW_MODE_KEY = "pcready:kanban:view-mode";

/** localStorage key for the active Kanban filter state. */
export const KANBAN_FILTERS_KEY = "pcready:kanban:filters";

/** localStorage key for the set of collapsed column statuses. */
export const KANBAN_COLLAPSED_COLUMNS_KEY = "pcready:kanban:collapsed-columns";

/** localStorage key for the Swim Lane group mode ("technician" | "client" | "priority"). */
export const KANBAN_GROUP_MODE_KEY = "pcready:kanban:group-mode";
