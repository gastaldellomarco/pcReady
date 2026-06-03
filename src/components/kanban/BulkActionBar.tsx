import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { KANBAN_STATUSES } from "@/lib/kanban/constants";
import {
  PRIORITY_LABEL,
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/pcready";
import { cn } from "@/lib/utils";
import type { TechnicianOption } from "@/lib/technicians";

/** Props for the Kanban bulk action bar. */
export interface BulkActionBarProps {
  selectedCount: number;
  isMobile: boolean;
  bulkBusy: boolean;
  canEdit: boolean;
  technicians: TechnicianOption[];
  onStatusChange: (status: TicketStatus) => void;
  onReassign: (assigneeId: string) => void;
  onPriorityChange: (priority: TicketPriority) => void;
  onArchive: () => void;
  onDeselect: () => void;
}

/**
 * Fixed bottom bar for Kanban bulk operations.
 *
 * @description Appears when one or more tickets are selected (Shift+click).
 * Allows batch status changes, reassignment, priority changes, and archiving.
 * Responsive: full-width on mobile, centered floating bar on desktop.
 */
export function BulkActionBar({
  selectedCount,
  isMobile,
  bulkBusy,
  canEdit,
  technicians,
  onStatusChange,
  onReassign,
  onPriorityChange,
  onArchive,
  onDeselect,
}: BulkActionBarProps) {
  const { t } = useTranslation(["kanban", "tickets"]);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex flex-wrap items-center gap-1.5 rounded-t-xl border px-2 py-2 shadow-lg",
        isMobile
          ? "pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
          : "bottom-4 left-1/2 max-w-[calc(100vw-2rem)] -translate-x-1/2",
        !isMobile && "rounded-xl",
      )}
      style={{ background: "var(--surface1)", borderColor: "var(--border)" }}
    >
      {isMobile && (
        <div className="flex w-full items-center justify-between gap-1">
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
            {selectedCount} {t("bulk.selected", "selezionati")}
          </span>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-xs"
            onClick={onDeselect}
          >
            <X className="size-3" /> {t("bulk.deselect", "Deseleziona")}
          </button>
        </div>
      )}
      {!isMobile && (
        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
          {selectedCount} {t("bulk.selected", "selezionati")}
        </span>
      )}
      <select
        className="pc-input h-8 max-w-[170px] px-3 py-0 text-[12px] leading-none"
        value=""
        disabled={bulkBusy || !canEdit}
        onChange={(event) => {
          const status = event.target.value as TicketStatus;
          if (status) onStatusChange(status);
        }}
      >
        <option value="">{t("bulk.changeStatus", "Cambia stato...")}</option>
        {KANBAN_STATUSES.concat("archived").map((status) => (
          <option key={status} value={status}>
            {t("tickets:status." + status, STATUS_META[status].label)}
          </option>
        ))}
      </select>
      <select
        className="pc-input h-8 max-w-[180px] px-3 py-0 text-[12px] leading-none"
        value=""
        disabled={bulkBusy || !canEdit}
        onChange={(event) => {
          const value = event.target.value;
          if (value) onReassign(value);
        }}
      >
        <option value="">{t("bulk.reassign", "Riassegna...")}</option>
        <option value="unassigned">{t("tickets:unassigned", "Non assegnato")}</option>
        {technicians.map((technician) => (
          <option key={technician.id} value={technician.id}>
            {technician.full_name}
          </option>
        ))}
      </select>
      <select
        className="pc-input h-8 max-w-[170px] px-3 py-0 text-[12px] leading-none"
        value=""
        disabled={bulkBusy || !canEdit}
        onChange={(event) => {
          const priority = event.target.value as TicketPriority;
          if (priority) onPriorityChange(priority);
        }}
      >
        <option value="">{t("bulk.priority", "Priorità...")}</option>
        {Object.entries(PRIORITY_LABEL).map(([priority, label]) => (
          <option key={priority} value={priority}>
            {t("tickets:priority." + priority, label)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="pc-btn pc-btn-danger pc-btn-sm"
        disabled={bulkBusy || !canEdit}
        onClick={onArchive}
      >
        {t("bulk.archive", "Archivia")}
      </button>
      <button
        type="button"
        className="pc-btn pc-btn-ghost pc-btn-sm"
        onClick={onDeselect}
      >
        X {t("bulk.deselect", "Deseleziona")}
      </button>
      {!isMobile && (
        <span className="text-[10px] text-text3">
          {t("bulk.shiftClickHint", "Shift+click sulle card per selezionare")}
        </span>
      )}
    </div>
  );
}
