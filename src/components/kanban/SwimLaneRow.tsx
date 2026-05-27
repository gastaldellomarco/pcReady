import type { MouseEvent } from "react";
import { AssigneeChip, PriorityLabel } from "@/components/pcready/StatusBadge";
import {
  STATUS_META,
  computeSlaStatus,
  formatSlaCountdown,
  PRIORITY_LABEL,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/pcready";
import { pcReadyColors } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { openTicketDetail } from "@/lib/detail-navigation";
import type { TechnicianOption } from "@/lib/technicians";
import type { SwimLaneCard } from "./SwimLaneView";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SwimLaneRowProps {
  technician: TechnicianOption | null;
  technicians: TechnicianOption[];
  cards: SwimLaneCard[];
  totalLaneCards: number;
  statuses: TicketStatus[];
  visibleStatuses: TicketStatus[];
  collapsedColumns: Set<TicketStatus>;
  compactView: boolean;
  onToggleCollapseColumn: (status: TicketStatus) => void;
  canEdit: boolean;
  dragId: string | null;
  overCell: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverCell: (cellId: string) => void;
  onDragLeaveCell: (cellId: string) => void;
  onMove: (id: string, status: TicketStatus, assigneeId: string | null) => void;
  onPriorityChange?: (id: string, priority: TicketPriority) => void;
  selectedCardIds?: Set<string>;
  onCardClick?: (event: MouseEvent, id: string) => void;
}

export function SwimLaneRow({
  technician,
  technicians,
  cards,
  totalLaneCards,
  statuses,
  visibleStatuses,
  collapsedColumns,
  compactView,
  onToggleCollapseColumn,
  canEdit,
  dragId,
  overCell,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDragLeaveCell,
  onMove,
  onPriorityChange,
  selectedCardIds,
  onCardClick,
}: SwimLaneRowProps) {
  const { t } = useTranslation(["kanban", "tickets"]);
  const assigneeId = technician?.id ?? null;
  const laneId = assigneeId ?? "unassigned";

  return (
    <tr className="border-b align-top" style={{ borderColor: "var(--border)" }}>
      <th
        className="sticky left-0 z-10 w-44 min-w-44 px-3 py-3 text-left align-top"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            {technician ? (
              <AssigneeChip initials={technician.initials} name={technician.full_name} />
            ) : (
              <UnassignedBadge />
            )}
          </div>
          <span className="text-[10px] font-mono text-text3 whitespace-nowrap">
            {totalLaneCards}
          </span>
        </div>
      </th>
      {statuses.map((status) => {
        const isHidden =
          collapsedColumns.has(status) || (compactView && !visibleStatuses.includes(status));
        if (isHidden) {
          return (
            <td key={status} className="min-w-[48px] w-[48px] p-0 align-top">
              <div className="flex min-h-[112px] items-center justify-center">
                <button
                  type="button"
                  onClick={() => onToggleCollapseColumn(status)}
                  className="flex flex-col items-center gap-0.5 cursor-pointer"
                  title={t("expandColumn", "Espandi {{column}}", { column: t("tickets:status." + status, STATUS_META[status].label) })}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: STATUS_META[status].color }}
                  />
                </button>
              </div>
            </td>
          );
        }

        const cellId = `${laneId}:${status}`;
        const items = cards.filter((card) => card.status === status);
        const isOver = overCell === cellId;

        return (
          <td key={status} className="min-w-[220px] p-2 align-top">
            <div
              className="flex min-h-[112px] flex-col gap-2 rounded-[8px] p-2 transition-all"
              style={{
                background: isOver
                  ? `color-mix(in oklab, ${STATUS_META[status].color} 10%, transparent)`
                  : "var(--surface2)",
                border: "1.5px dashed " + (isOver ? STATUS_META[status].color : "var(--border)"),
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                onDragOverCell(cellId);
              }}
              onDragLeave={() => onDragLeaveCell(cellId)}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId) onMove(dragId, status, assigneeId);
                onDragEnd();
              }}
            >
              {items.map((card) => (
                <TicketCard
                  key={card.id}
                  card={card}
                  canEdit={canEdit}
                  isDragging={dragId === card.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  selected={!!selectedCardIds?.has(card.id)}
                  compactView={compactView}
                  technicians={technicians}
                  statuses={statuses}
                  currentAssigneeId={assigneeId}
                  currentStatus={status}
                  onMove={onMove}
                  onPriorityChange={onPriorityChange}
                  onCardClick={onCardClick}
                />
              ))}
              {!items.length && (
                <div
                  className="flex min-h-16 items-center justify-center rounded-[7px] text-[11px] text-text3"
                  style={{ border: "1.5px dashed var(--border2)" }}
                >
                  {t("dragHere", "Trascina qui")}
                </div>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function TimeInColumnLabel({ updatedAt }: { updatedAt?: string | null }) {
  const { t } = useTranslation("kanban");
  if (!updatedAt) return null;
  try {
    const d = new Date(updatedAt);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let label: string;
    if (hours < 1) label = `${minutes}m`;
    else if (hours < 24) label = `${hours}h`;
    else {
      const days = Math.floor(hours / 24);
      label = `${days}g`;
    }

    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-text3 font-mono"
        title={t("inColumnSince", "In questa colonna da {{time}}", { time: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m` })}
      >
        <Clock className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  } catch {
    return null;
  }
}

function TicketCard({
  card,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
  selected,
  compactView,
  technicians,
  statuses,
  currentAssigneeId,
  currentStatus,
  onMove,
  onPriorityChange,
  onCardClick,
}: {
  card: SwimLaneCard;
  canEdit: boolean;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  selected?: boolean;
  compactView: boolean;
  technicians: TechnicianOption[];
  statuses: TicketStatus[];
  currentAssigneeId: string | null;
  currentStatus: TicketStatus;
  onMove: (id: string, status: TicketStatus, assigneeId: string | null) => void;
  onPriorityChange?: (id: string, priority: TicketPriority) => void;
  onCardClick?: (event: MouseEvent, id: string) => void;
}) {
  const { t } = useTranslation(["kanban", "tickets"]);
  const indicator = slaIndicator(card);
  const translatedSlaLabel = indicator.status === "overdue"
    ? t("tickets:sla.breached", indicator.label)
    : indicator.status === "warning"
      ? t("tickets:status.expiring", indicator.label)
      : t("tickets:sla.ok", indicator.label);

  return (
    <div
      draggable={canEdit}
      onDragStart={() => onDragStart(card.id)}
      onDragEnd={onDragEnd}
      onClick={(event) => (onCardClick ? onCardClick(event, card.id) : openTicketDetail(card.id))}
      className={cn(
        "pc-card group text-left transition-all hover:shadow-md",
        compactView ? "p-2" : "p-3",
        "select-none",
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
      {canEdit && (
        <div
          className="mt-2 hidden grid-cols-1 gap-1 group-hover:grid"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-3 gap-1">
            <select
              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
              value={currentAssigneeId ?? "unassigned"}
              onChange={(event) =>
                onMove(
                  card.id,
                  currentStatus,
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
              value={currentStatus}
              onChange={(event) =>
                onMove(card.id, event.target.value as TicketStatus, currentAssigneeId)
              }
              title={t("moveTo", "Sposta a")}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {t("tickets:status." + status, STATUS_META[status].label)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm h-7"
            onClick={() => openTicketDetail(card.id)}
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
          {!compactView && <TimeInColumnLabel updatedAt={card.updated_at} />}
        </div>
      </div>
    </div>
  );
}

function slaIndicator(card: SwimLaneCard) {
  const sla = computeSlaStatus(
    card.created_at || card.updated_at || new Date().toISOString(),
    card.priority,
    undefined,
    card.due_date || card.sla_deadline,
    card.sla_breached,
  );
  if (sla.status === "overdue") return { color: pcReadyColors.danger, label: "SLA violato", status: "overdue" };
  if (sla.status === "warning") return { color: pcReadyColors.warning, label: "In scadenza", status: "warning" };
  return { color: pcReadyColors.success, label: "SLA OK", status: "ok" };
}

function SlaMiniLabel({ card, compactView }: { card: SwimLaneCard; compactView?: boolean }) {
  const { t } = useTranslation(["tickets"]);
  const indicator = slaIndicator(card);
  const deadline = card.due_date || card.sla_deadline;
  // Hide OK badges — only show warning/overdue
  if (indicator.status === "ok") return null;
  const countdown = deadline
    ? formatSlaCountdown(deadline)
    : indicator.status === "overdue"
      ? t("sla.breached", indicator.label)
      : t("status.expiring", indicator.label);
  const isOverdue = indicator.status === "overdue";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 font-semibold whitespace-nowrap",
        compactView ? "text-[9px]" : "text-[9.5px]",
        isOverdue && "border",
      )}
      style={{
        background: `${indicator.color}22`,
        color: indicator.color,
        ...(isOverdue ? { borderColor: indicator.color, borderWidth: "1px" } : {}),
      }}
      title={countdown}
    >
      {countdown}
    </span>
  );
}

function UnassignedBadge() {
  const { t } = useTranslation(["tickets"]);
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      {t("unassigned", "Non assegnato")}
    </span>
  );
}
