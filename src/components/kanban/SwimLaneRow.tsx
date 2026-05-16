import { AssigneeChip, PriorityLabel } from "@/components/pcready/StatusBadge";
import {
  STATUS_META,
  computeSlaStatus,
  formatSlaCountdown,
  type TicketStatus,
} from "@/lib/pcready";
import { cn } from "@/lib/utils";
import { openTicketDetail } from "@/lib/use-detail";
import type { TechnicianOption } from "@/lib/technicians";
import type { SwimLaneCard } from "./SwimLaneView";
import { Clock } from "lucide-react";

interface SwimLaneRowProps {
  technician: TechnicianOption | null;
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
}

export function SwimLaneRow({
  technician,
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
}: SwimLaneRowProps) {
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
                  title={`Espandi ${STATUS_META[status].label}`}
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

function TimeInColumnLabel({ updatedAt }: { updatedAt?: string | null }) {
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
        title={`In questa colonna da ${hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`}`}
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
        borderLeft: `4px solid ${slaIndicator(card).color}`,
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] text-text3">{card.ticket_code}</span>
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: slaIndicator(card).color }}
            title={slaIndicator(card).label}
          />
          <PriorityLabel p={card.priority} />
        </div>
      </div>
      <div className="mb-0.5 text-[12.5px] font-semibold">
        {card.device?.model || "Nessun asset"}
      </div>
      <div className="mb-2 text-[11px] text-text3">{card.client}</div>
      <div className="flex items-center justify-between">
        <div>
          {card.assignee ? (
            <AssigneeChip initials={card.assignee.initials} name={card.assignee.full_name} />
          ) : (
            <UnassignedBadge />
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <SlaMiniLabel card={card} />
          <TimeInColumnLabel updatedAt={card.updated_at} />
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
  if (sla.status === "overdue") return { color: "#DC2626", label: "SLA violato" };
  if (sla.status === "warning") return { color: "#CA8A04", label: "In scadenza" };
  return { color: "#16A34A", label: "SLA OK" };
}

function SlaMiniLabel({ card }: { card: SwimLaneCard }) {
  const indicator = slaIndicator(card);
  const deadline = card.due_date || card.sla_deadline;
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
      style={{ background: `${indicator.color}22`, color: indicator.color }}
      title={deadline ? formatSlaCountdown(deadline) : indicator.label}
    >
      {indicator.label}
    </span>
  );
}

function UnassignedBadge() {
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Non assegnato
    </span>
  );
}
