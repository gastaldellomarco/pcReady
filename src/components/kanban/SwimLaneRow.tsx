import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AssigneeChip, PriorityLabel } from "@/components/pcready/StatusBadge";
import { DEFAULT_WIP_LIMITS, type WipLimits } from "@/lib/app-settings";
import { computeCycleTime, CYCLE_COLORS, CYCLE_BG_COLORS } from "@/lib/cycle-time";
import { pcReadyColors } from "@/lib/design-system";
import { openTicketDetail } from "@/lib/detail-navigation";
import {
  STATUS_META,
  computeSlaStatus,
  formatSlaCountdown,
  PRIORITY_LABEL,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/pcready";
import { cn } from "@/lib/utils";
import type { SwimLaneCard, SwimLaneGroupMode } from "./SwimLaneView";
import type { ViewerInfo } from "@/hooks/useKanbanPresence";
import type { TechnicianOption } from "@/lib/technicians";
import type { MouseEvent } from "react";

interface SwimLaneRowProps {
  technician: TechnicianOption | null;
  groupMode: SwimLaneGroupMode;
  groupLabel: string;
  groupColor?: string;
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
  dragCardStatus: TicketStatus | null;
  overCell: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverCell: (cellId: string) => void;
  onDragLeaveCell: (cellId: string) => void;
  onMove: (id: string, status: TicketStatus, assigneeId: string | null) => void;
  onPriorityChange?: (id: string, priority: TicketPriority) => void;
  selectedCardIds?: Set<string>;
  onCardClick?: (event: MouseEvent, id: string) => void;
  wipLimits: WipLimits;
  columnCounts: Record<string, number>;
  overLimitCell: string | null;
  onSetOverLimitCell: (cellId: string | null) => void;
  cardViewers: ReadonlyMap<string, ViewerInfo[]>;
  setCurrentCard: (cardId: string | null) => void;
  statusChangedAtMap: ReadonlyMap<string, string>;
}

/**
 *
 */
export function SwimLaneRow({
  technician,
  groupMode,
  groupLabel,
  groupColor,
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
  dragCardStatus,
  overCell,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDragLeaveCell,
  onMove,
  onPriorityChange,
  selectedCardIds,
  onCardClick,
  wipLimits,
  columnCounts,
  overLimitCell,
  onSetOverLimitCell,
  cardViewers,
  setCurrentCard,
  statusChangedAtMap,
}: SwimLaneRowProps) {
  const isWipBlocked = (targetStatus: TicketStatus): boolean => {
    if (!dragId || !dragCardStatus) return false;
    if (dragCardStatus === targetStatus) return false;
    const limit = (wipLimits ?? DEFAULT_WIP_LIMITS)[targetStatus];
    if (!limit || limit <= 0) return false;
    const currentCount = columnCounts[targetStatus] ?? 0;
    return currentCount >= limit;
  };
  const { t } = useTranslation(["kanban", "tickets"]);
  const assigneeId = technician?.id ?? null;
  const laneId = groupMode === "technician"
    ? (assigneeId ?? "unassigned")
    : `${groupMode}:${groupLabel}`;

  return (
    <tr className="border-b align-top" style={{ borderColor: "var(--border)" }}>
      <th
        className="sticky left-0 z-10 w-44 min-w-44 px-3 py-3 text-left align-top"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {groupColor && (
              <span
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ background: groupColor }}
              />
            )}
            {groupMode === "technician" && technician ? (
              <AssigneeChip initials={technician.initials} name={technician.full_name} />
            ) : groupMode === "technician" ? (
              <UnassignedBadge />
            ) : (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold truncate max-w-[160px]"
                style={{
                  background: groupColor ? `${groupColor}18` : "var(--surface3)",
                  color: groupColor || "var(--text1)",
                }}
                title={groupLabel}
              >
                {groupLabel}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-text3 whitespace-nowrap flex-shrink-0">
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
        const isBlocked = overLimitCell === cellId;
        const blocked = isWipBlocked(status);

        return (
          <td key={status} className="min-w-[220px] p-2 align-top">
            <div
              className={cn(
                "flex min-h-[112px] flex-col gap-2 rounded-[8px] p-2 transition-all",
                isBlocked && "pc-shake",
              )}
              style={{
                background: isBlocked
                  ? `color-mix(in oklab, #DC2626 12%, transparent)`
                  : isOver
                    ? `color-mix(in oklab, ${STATUS_META[status].color} 10%, transparent)`
                    : "var(--surface2)",
                border: "1.5px dashed " + (isBlocked ? "#DC2626" : isOver ? STATUS_META[status].color : "var(--border)"),
                boxShadow: isBlocked ? "0 0 12px rgba(220,38,38,0.25)" : undefined,
              }}
              onDragOver={(event) => {
                if (!dragId) return;
                if (blocked) {
                  event.preventDefault();
                  onSetOverLimitCell(cellId);
                  return;
                }
                event.preventDefault();
                onDragOverCell(cellId);
              }}
              onDragLeave={() => {
                if (blocked) onSetOverLimitCell(null);
                onDragLeaveCell(cellId);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragId) {
                  if (blocked) {
                    onSetOverLimitCell(null);
                    onDragEnd();
                    return;
                  }
                  // In non-technician modes, keep the card's current assignee
                  const dropAssignee = groupMode === "technician"
                    ? assigneeId
                    : (cards.find((c) => c.id === dragId)?.assignee_id ?? null);
                  onMove(dragId, status, dropAssignee);
                }
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
                  viewers={cardViewers.get(card.id) ?? []}
                  onHover={setCurrentCard}
                  statusChangedAt={statusChangedAtMap.get(card.id) ?? null}
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

function TimeInColumnLabel({
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
        lead
          ? `In questa colonna da ${cycle} · Aperto da ${lead}`
          : `In questa colonna da ${cycle}`
      }
    >
      {cycleColor && (
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
      )}
      <Clock className="h-2.5 w-2.5" />
      {cycle}
    </span>
  );
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
  viewers,
  onHover,
  statusChangedAt,
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
  viewers: ViewerInfo[];
  onHover: (cardId: string | null) => void;
  statusChangedAt?: string | null;
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
      onMouseEnter={() => onHover(card.id)}
      onMouseLeave={() => onHover(null)}
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
      {viewers.length > 0 && (
        <div className="mb-2 flex items-center -space-x-1.5">
          {viewers.slice(0, 3).map((v, i) => (
            <span
              key={v.full_name + i}
              className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[7px] font-bold leading-none"
              style={{
                background: "var(--accent2)",
                color: "var(--accent)",
                borderColor: "var(--surface1)",
              }}
              title={v.full_name}
            >
              {v.initials}
            </span>
          ))}
          {viewers.length > 3 && (
            <span
              className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[7px] font-bold leading-none"
              style={{
                background: "var(--surface3)",
                color: "var(--text3)",
                borderColor: "var(--surface1)",
              }}
              title={`+${viewers.length - 3} altri`}
            >
              +{viewers.length - 3}
            </span>
          )}
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
          {!compactView && (
            <TimeInColumnLabel
              updatedAt={card.updated_at}
              createdAt={card.created_at}
              status={card.status}
              statusChangedAt={statusChangedAt}
            />
          )}
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
