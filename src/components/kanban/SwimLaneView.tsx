import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { WipProgressBar } from "@/components/kanban/WipProgressBar";
import OverflowTable from "@/components/ui/overflow-table";
import { DEFAULT_WIP_LIMITS, type WipLimits } from "@/lib/app-settings";
import { PRIORITY_LABEL, STATUS_META, type TicketPriority, type TicketStatus } from "@/lib/pcready";
import { cn } from "@/lib/utils";
import { SwimLaneRow } from "./SwimLaneRow";
import type { ViewerInfo } from "@/hooks/useKanbanPresence";
import type { TechnicianOption } from "@/lib/technicians";

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  high: "#DC2626",
  med: "#EA580C",
  low: "#16A34A",
};

/** Canonical priority order for UI ordering (high → med → low). */
export const PRIORITY_ORDER: TicketPriority[] = ["high", "med", "low"];

/**
 *
 */
export type SwimLaneGroupMode = "technician" | "client" | "priority";

/**
 *
 */
export interface SwimLaneCard {
  id: string;
  ticket_code: string;
  client: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  device?: { model: string; serial: string | null } | null;
  assignee?: { id: string; full_name: string; initials: string } | null;
}

interface SwimLaneViewProps {
  cards: SwimLaneCard[];
  technicians: TechnicianOption[];
  groupMode: SwimLaneGroupMode;
  wipLimits: WipLimits;
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
  cardViewers: ReadonlyMap<string, ViewerInfo[]>;
  setCurrentCard: (cardId: string | null) => void;
  statusChangedAtMap: ReadonlyMap<string, string>;
}

/**
 * Pure computation: groups cards by assignee_id into a Map.
 * Technicians are pre-seeded with empty arrays; unassigned cards
 * go into the `null` key.
 */
export function groupCardsByTechnician(
  cards: SwimLaneCard[],
  technicians: TechnicianOption[],
): Map<string | null, SwimLaneCard[]> {
  const map = new Map<string | null, SwimLaneCard[]>();
  for (const technician of technicians) map.set(technician.id, []);
  map.set(null, []);
  for (const card of cards) {
    const key = card.assignee_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(card);
  }
  return map;
}

/**
 * Pure computation: groups cards by client name.
 */
export function groupCardsByClient(cards: SwimLaneCard[]): Map<string, SwimLaneCard[]> {
  const map = new Map<string, SwimLaneCard[]>();
  for (const card of cards) {
    const key = card.client || "Nessun cliente";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(card);
  }
  return map;
}

/**
 * Pure computation: groups cards by priority (high/med/low), preserving
 * the priority order and skipping empty groups.
 */
export function groupCardsByPriority(
  cards: SwimLaneCard[],
): Map<TicketPriority, SwimLaneCard[]> {
  const map = new Map<TicketPriority, SwimLaneCard[]>();
  for (const p of PRIORITY_ORDER) map.set(p, []);
  for (const card of cards) {
    if (map.has(card.priority)) {
      map.get(card.priority)!.push(card);
    }
  }
  return map;
}

/**
 *
 */
export function SwimLaneView({
  cards,
  technicians,
  groupMode = "technician",
  wipLimits,
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
  cardViewers,
  setCurrentCard,
  statusChangedAtMap,
}: SwimLaneViewProps) {
  const { t } = useTranslation(["kanban", "tickets"]);
  const [overLimitCell, setOverLimitCell] = useState<string | null>(null);

  // Clear blocked-cell indicator when drag ends
  useEffect(() => {
    if (!dragId) setOverLimitCell(null);
  }, [dragId]);

  // Dragged card's current status (used for WIP block check across all lanes)
  const dragCardStatus = useMemo(() => {
    if (!dragId) return null;
    const card = cards.find((c) => c.id === dragId);
    return card?.status ?? null;
  }, [cards, dragId]);

  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const card of cards) {
      counts[card.status] = (counts[card.status] || 0) + 1;
    }
    return counts;
  }, [cards]);

  const lanes = useMemo(() => {
    if (groupMode === "client") {
      const map = groupCardsByClient(cards);
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([clientName, laneCards]) => ({
          id: `client:${clientName}`,
          technician: null,
          groupLabel: clientName,
          groupColor: undefined as string | undefined,
          cards: laneCards,
        }));
    }

    if (groupMode === "priority") {
      const map = groupCardsByPriority(cards);
      return PRIORITY_ORDER
        .filter((p) => map.get(p)!.length > 0)
        .map((p) => ({
          id: `priority:${p}`,
          technician: null,
          groupLabel: t("tickets:priority." + p, PRIORITY_LABEL[p]),
          groupColor: PRIORITY_COLORS[p],
          cards: map.get(p)!,
        }));
    }

    // Technician mode (default)
    const map = groupCardsByTechnician(cards, technicians);
    return [
      ...technicians.map((technician) => ({
        id: technician.id,
        technician,
        groupLabel: technician.full_name,
        groupColor: undefined as string | undefined,
        cards: map.get(technician.id) ?? [],
      })),
      {
        id: "unassigned",
        technician: null,
        groupLabel: t("tickets:unassigned", "Non assegnato"),
        groupColor: undefined as string | undefined,
        cards: map.get(null) ?? [],
      },
    ];
  }, [cards, technicians, groupMode, t]);

  return (
    <div className="pc-card overflow-hidden">
      <OverflowTable>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 w-44 min-w-44 border-b px-3 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-text3"
                style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
              >
                {groupMode === "technician"
                  ? t("swimlanesHeader", "Tecnico / Stato")
                  : groupMode === "client"
                    ? t("swimlanesHeaderClient", "Cliente / Stato")
                    : t("swimlanesHeaderPriority", "Priorità / Stato")}
              </th>
              {statuses.map((status) => {
                const isHidden =
                  collapsedColumns.has(status) ||
                  (compactView && !visibleStatuses.includes(status));
                if (isHidden) {
                  return (
                    <th
                      key={status}
                      className="min-w-[48px] w-[48px] border-b px-1 py-3 text-center"
                      style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleCollapseColumn(status)}
                        className="flex flex-col items-center gap-0.5 mx-auto cursor-pointer"
                        title={t("expandColumn", "Espandi {{column}}", {
                          column: t("tickets:status." + status, STATUS_META[status].label),
                        })}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: STATUS_META[status].color }}
                        />
                        <span className="text-[8px] font-bold uppercase tracking-wider text-text3">
                          {t("tickets:status." + status, STATUS_META[status].label).slice(0, 4)}
                        </span>
                      </button>
                    </th>
                  );
                }

                const count = cards.filter((card) => card.status === status).length;
                const limit = (wipLimits ?? DEFAULT_WIP_LIMITS)[status];
                const isOverLimit = limit > 0 && count > limit;
                const wipPct = limit > 0 ? (count / limit) * 100 : 0;

                return (
                  <th
                    key={status}
                    className="min-w-[220px] border-b px-3 py-3 text-left"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ background: STATUS_META[status].color }}
                      />
                      <span className="text-[12px] font-bold uppercase tracking-wider">
                        {t("tickets:status." + status, STATUS_META[status].label)}
                      </span>
                      <span
                        className={cn(
                          "ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px]",
                          isOverLimit
                            ? "border-danger/20 bg-danger-light text-danger"
                            : "text-text3 border-border",
                        )}
                        style={isOverLimit ? undefined : { background: "var(--surface3)" }}
                      >
                        {count}/{limit}
                      </span>
                    </div>
                    {limit > 0 && (
                      <div className="px-0.5">
                        <WipProgressBar pct={wipPct} />
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => (
              <SwimLaneRow
                key={lane.id}
                technician={lane.technician}
                groupMode={groupMode}
                groupLabel={lane.groupLabel ?? ""}
                groupColor={lane.groupColor}
                technicians={technicians}
                cards={lane.cards}
                totalLaneCards={lane.cards.length}
                statuses={statuses}
                visibleStatuses={visibleStatuses}
                collapsedColumns={collapsedColumns}
                compactView={compactView}
                onToggleCollapseColumn={onToggleCollapseColumn}
                canEdit={canEdit}
                dragId={dragId}
                dragCardStatus={dragCardStatus}
                overCell={overCell}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverCell={onDragOverCell}
                onDragLeaveCell={onDragLeaveCell}
                onMove={onMove}
                onPriorityChange={onPriorityChange}
                selectedCardIds={selectedCardIds}
                onCardClick={onCardClick}
                wipLimits={wipLimits}
                columnCounts={columnCounts}
                overLimitCell={overLimitCell}
                onSetOverLimitCell={setOverLimitCell}
                cardViewers={cardViewers}
                setCurrentCard={setCurrentCard}
                statusChangedAtMap={statusChangedAtMap}
              />
            ))}
          </tbody>
        </table>
      </OverflowTable>
    </div>
  );
}
