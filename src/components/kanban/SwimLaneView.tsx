import { useMemo } from "react";
import { STATUS_META, type TicketPriority, type TicketStatus } from "@/lib/pcready";
import { DEFAULT_WIP_LIMITS, type WipLimits } from "@/lib/app-settings";
import type { TechnicianOption } from "@/lib/technicians";
import { cn } from "@/lib/utils";
import { SwimLaneRow } from "./SwimLaneRow";

export interface SwimLaneCard {
  id: string;
  ticket_code: string;
  client: string;
  model: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  device?: { model: string; serial: string | null } | null;
  assignee?: { id: string; full_name: string; initials: string } | null;
}

interface SwimLaneViewProps {
  cards: SwimLaneCard[];
  technicians: TechnicianOption[];
  wipLimits: WipLimits;
  statuses: TicketStatus[];
  canEdit: boolean;
  dragId: string | null;
  overCell: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverCell: (cellId: string) => void;
  onDragLeaveCell: (cellId: string) => void;
  onMove: (id: string, status: TicketStatus, assigneeId: string | null) => void;
}

export function SwimLaneView({
  cards,
  technicians,
  wipLimits,
  statuses,
  canEdit,
  dragId,
  overCell,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDragLeaveCell,
  onMove,
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
                const count = cards.filter((card) => card.status === status).length;
                const limit = (wipLimits ?? DEFAULT_WIP_LIMITS)[status];
                const isOverLimit = limit > 0 && count > limit;

                return (
                  <th
                    key={status}
                    className="min-w-[220px] border-b px-3 py-3 text-left"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
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
                statuses={statuses}
                canEdit={canEdit}
                dragId={dragId}
                overCell={overCell}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverCell={onDragOverCell}
                onDragLeaveCell={onDragLeaveCell}
                onMove={onMove}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
