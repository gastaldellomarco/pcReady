import { useMemo, type MouseEvent } from "react";
import { STATUS_META, type TicketPriority, type TicketStatus } from "@/lib/pcready";
import { DEFAULT_WIP_LIMITS, type WipLimits } from "@/lib/app-settings";
import type { TechnicianOption } from "@/lib/technicians";
import { cn } from "@/lib/utils";
import { SwimLaneRow } from "./SwimLaneRow";

function WipProgressBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#DC2626" : pct >= 70 ? "#CA8A04" : "#16A34A";
  const bgColor = pct >= 90 ? "#FEE2E2" : pct >= 70 ? "#FEF9C3" : "#DCFCE7";
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: bgColor }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

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
  selectedCardIds?: Set<string>;
  onCardClick?: (event: MouseEvent, id: string) => void;
}

export function SwimLaneView({
  cards,
  technicians,
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
  selectedCardIds,
  onCardClick,
}: SwimLaneViewProps) {
  const lanes = useMemo(() => {
    const map = new Map<string | null, SwimLaneCard[]>();
    for (const technician of technicians) map.set(technician.id, []);
    map.set(null, []);

    for (const card of cards) {
      const key = card.assignee_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }

    return [
      ...technicians.map((technician) => ({
        id: technician.id,
        technician,
        cards: map.get(technician.id) ?? [],
      })),
      { id: "unassigned", technician: null, cards: map.get(null) ?? [] },
    ];
  }, [cards, technicians]);

  return (
    <div className="pc-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 w-44 min-w-44 border-b px-3 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-text3"
                style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
              >
                Tecnico / Stato
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
                        title={`Espandi ${STATUS_META[status].label}`}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: STATUS_META[status].color }}
                        />
                        <span className="text-[8px] font-bold uppercase tracking-wider text-text3">
                          {STATUS_META[status].label.slice(0, 4)}
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
                        {STATUS_META[status].label}
                      </span>
                      <span
                        className={cn(
                          "ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px]",
                          isOverLimit
                            ? "border-red-200 bg-red-100 text-red-700"
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
                cards={lane.cards}
                totalLaneCards={lane.cards.length}
                statuses={statuses}
                visibleStatuses={visibleStatuses}
                collapsedColumns={collapsedColumns}
                compactView={compactView}
                onToggleCollapseColumn={onToggleCollapseColumn}
                canEdit={canEdit}
                dragId={dragId}
                overCell={overCell}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverCell={onDragOverCell}
                onDragLeaveCell={onDragLeaveCell}
                onMove={onMove}
                selectedCardIds={selectedCardIds}
                onCardClick={onCardClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
