import { AssigneeChip, PriorityLabel } from "@/components/pcready/StatusBadge";
import { STATUS_META, type TicketStatus } from "@/lib/pcready";
import { cn } from "@/lib/utils";
import { openTicketDetail } from "@/lib/use-detail";
import type { TechnicianOption } from "@/lib/technicians";
import type { SwimLaneCard } from "./SwimLaneView";

interface SwimLaneRowProps {
  technician: TechnicianOption | null;
  cards: SwimLaneCard[];
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

export function SwimLaneRow({
  technician,
  cards,
  statuses,
  canEdit,
  dragId,
  overCell,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDragLeaveCell,
  onMove,
}: SwimLaneRowProps) {
  const assigneeId = technician?.id ?? null;
  const laneId = assigneeId ?? "unassigned";

  return (
    <tr className="border-b align-top" style={{ borderColor: "var(--border)" }}>
      <th
        className="sticky left-0 z-10 w-44 min-w-44 px-3 py-3 text-left align-top"
        style={{ background: "var(--surface)" }}
      >
        {technician ? (
          <AssigneeChip initials={technician.initials} name={technician.full_name} />
        ) : (
          <UnassignedBadge />
        )}
      </th>
      {statuses.map((status) => {
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
                />
              ))}
              {!items.length && (
                <div
                  className="flex min-h-16 items-center justify-center rounded-[7px] text-[11px] text-text3"
                  style={{ border: "1.5px dashed var(--border2)" }}
                >
                  Trascina qui
                </div>
              )}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function TicketCard({
  card,
  canEdit,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  card: SwimLaneCard;
  canEdit: boolean;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable={canEdit}
      onDragStart={() => onDragStart(card.id)}
      onDragEnd={onDragEnd}
      onClick={() => openTicketDetail(card.id)}
      className={cn("pc-card p-3 text-left transition-all hover:shadow-md", "select-none")}
      style={{
        cursor: canEdit ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        transform: isDragging ? "scale(0.98)" : undefined,
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] text-text3">{card.ticket_code}</span>
        <PriorityLabel p={card.priority} />
      </div>
      <div className="mb-0.5 text-[12.5px] font-semibold">
        {card.device?.model || card.model || "Nessun asset"}
      </div>
      <div className="mb-2 text-[11px] text-text3">{card.client}</div>
      {card.assignee ? (
        <AssigneeChip initials={card.assignee.initials} name={card.assignee.full_name} />
      ) : (
        <UnassignedBadge />
      )}
    </div>
  );
}

function UnassignedBadge() {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Non assegnato
    </span>
  );
}
