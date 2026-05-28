import { useTranslation } from "react-i18next";
import { TicketCard } from "@/components/kanban/TicketCard";
import { UnassignedBadge } from "@/components/kanban/UnassignedBadge";
import { AssigneeChip } from "@/components/pcready/StatusBadge";
import { DEFAULT_WIP_LIMITS, type WipLimits } from "@/lib/app-settings";
import { openTicketDetail } from "@/lib/detail-navigation";
import {
  STATUS_META,
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
                  status={status}
                  assigneeId={assigneeId}
                  onMove={onMove}
                  onPriorityChange={onPriorityChange}
                  onClick={onCardClick}
                  onOpenDetail={() => openTicketDetail(card.id)}
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

