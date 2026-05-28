import { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { SlaMiniLabel } from "@/components/kanban/SlaMiniLabel";
import { TimeInColumnLabel } from "@/components/kanban/TimeInColumnLabel";
import { UnassignedBadge } from "@/components/kanban/UnassignedBadge";
import { ViewerAvatars } from "@/components/kanban/ViewerAvatars";
import { AssigneeChip, PriorityLabel } from "@/components/pcready/StatusBadge";
import { slaIndicator } from "@/lib/kanban/helpers";
import { PRIORITY_LABEL, STATUS_META, type TicketPriority, type TicketStatus } from "@/lib/pcready";
import { cn } from "@/lib/utils";
import type { TechnicianOption } from "@/lib/technicians";

/**
 * Minimal shape shared by both {@link KanbanCard} and {@link SwimLaneCard}.
 * Only the fields actually rendered by the card are required.
 */
export interface KanbanCardLike {
  id: string;
  ticket_code: string;
  client: string;
  priority: TicketPriority;
  assignee_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  device?: { model: string; serial: string | null } | null;
  assignee?: { id: string; full_name: string; initials: string } | null;
}

/**
 * Reusable kanban card rendered inside both the columns view and the
 * swim-lane view.
 *
 * @param card - The ticket data. Must satisfy {@link KanbanCardLike}.
 * @param status - Status visible in the inline status selector dropdown.
 * @param assigneeId - Assignee pre-selected in the inline assignee selector.
 * @param onOpenDetail - Called when the "Apri dettaglio" button is clicked.
 */
export function TicketCard({
  card,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
  selected,
  compactView,
  technicians,
  statuses,
  status,
  assigneeId,
  onMove,
  onPriorityChange,
  onClick,
  onOpenDetail,
  viewers,
  onHover,
  statusChangedAt,
}: {
  card: KanbanCardLike;
  canEdit: boolean;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  selected?: boolean;
  compactView: boolean;
  technicians: TechnicianOption[];
  statuses: TicketStatus[];
  status: TicketStatus;
  assigneeId: string | null;
  onMove: (id: string, status: TicketStatus, assigneeId: string | null) => void;
  onPriorityChange?: (id: string, priority: TicketPriority) => void;
  onClick?: (event: MouseEvent, id: string) => void;
  onOpenDetail: () => void;
  viewers: { initials: string; full_name: string }[];
  onHover: (cardId: string | null) => void;
  statusChangedAt?: string | null;
}) {
  const { t } = useTranslation(["kanban", "tickets"]);
  const indicator = slaIndicator(card);
  const translatedSlaLabel =
    indicator.status === "overdue"
      ? t("tickets:sla.breached", indicator.label)
      : indicator.status === "warning"
        ? t("tickets:status.expiring", indicator.label)
        : t("tickets:sla.ok", indicator.label);

  return (
    <div
      draggable={canEdit}
      onDragStart={() => onDragStart(card.id)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(card.id)}
      onMouseLeave={() => onHover(null)}
      onClick={(event) => {
        if (onClick) {
          onClick(event, card.id);
        } else {
          onOpenDetail();
        }
      }}
      className={cn(
        "pc-card group text-left transition-all hover:shadow-md",
        compactView ? "p-2" : "p-3",
        "select-none min-h-[44px]",
        selected && "ring-2 ring-accent",
      )}
      style={{
        cursor: canEdit ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "scale(0.98)" : undefined,
        borderLeft: `4px solid ${indicator.color}`,
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] text-text3">{card.ticket_code}</span>
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: indicator.color }}
            title={translatedSlaLabel}
          />
          <PriorityLabel p={card.priority} />
        </div>
      </div>
      <div className={cn("font-semibold", compactView ? "text-[11.5px]" : "mb-0.5 text-[12.5px]")}>
        {card.device?.model || t("tickets:noAsset", "Nessun asset")}
      </div>
      {!compactView && <div className="mb-2 text-[11px] text-text3">{card.client}</div>}
      {viewers.length > 0 && (
        <div className="mb-2">
          <ViewerAvatars viewers={viewers} />
        </div>
      )}
      {canEdit && (
        <div
          className="mt-2 hidden grid-cols-1 gap-1 group-hover:grid"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-3 gap-1">
            <select
              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
              value={assigneeId ?? "unassigned"}
              onChange={(event) =>
                onMove(
                  card.id,
                  status,
                  event.target.value === "unassigned" ? null : event.target.value,
                )
              }
              title={t("assignTitle", "Assegna")}
            >
              <option value="unassigned">{t("tickets:unassigned", "Non assegnato")}</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
            </select>
            <select
              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
              value={card.priority}
              onChange={(event) =>
                onPriorityChange?.(card.id, event.target.value as TicketPriority)
              }
              title={t("tickets:columns.priority", "Priorità")}
            >
              {Object.entries(PRIORITY_LABEL).map(([priority, label]) => (
                <option key={priority} value={priority}>
                  {t("tickets:priority." + priority, label)}
                </option>
              ))}
            </select>
            <select
              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
              value={status}
              onChange={(event) =>
                onMove(card.id, event.target.value as TicketStatus, assigneeId)
              }
              title={t("moveTo", "Sposta a")}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {t("tickets:status." + s, STATUS_META[s].label)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm h-7"
            onClick={onOpenDetail}
          >
            {t("tickets:details", "Apri dettaglio")}
          </button>
        </div>
      )}
      <div className={cn("flex items-center justify-between", compactView ? "mt-2" : "")}>
        <div>
          {card.assignee ? (
            <AssigneeChip initials={card.assignee.initials} name={card.assignee.full_name} />
          ) : (
            <UnassignedBadge />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <SlaMiniLabel card={card} compactView={compactView} />
          {!compactView && (
            <TimeInColumnLabel
              updatedAt={card.updated_at}
              createdAt={card.created_at}
              status={status}
              statusChangedAt={statusChangedAt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
