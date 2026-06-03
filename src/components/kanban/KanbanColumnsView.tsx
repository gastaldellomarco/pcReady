import { ChevronDown, ChevronRight } from "lucide-react";
import { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ColumnNote } from "@/components/kanban/ColumnNote";
import { TicketCard } from "@/components/kanban/TicketCard";
import { WipProgressBar } from "@/components/kanban/WipProgressBar";
import {
  DEFAULT_WIP_LIMITS,
  type KanbanColumnColors,
  type KanbanColumnNotes,
  type WipLimits,
} from "@/lib/app-settings";
import { setTicketContext } from "@/lib/detail-navigation";
import { KANBAN_STATUSES } from "@/lib/kanban/constants";
import {
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/pcready";
import { cn } from "@/lib/utils";
import type { TechnicianOption } from "@/lib/technicians";
import type { Card as KanbanCard } from "@/routes/_app/kanban.lazy";

/* ── Main component ─────────────────────────────────────────────────────── */

/**
 *
 */
export interface KanbanColumnsViewProps {
  cards: KanbanCard[];
  archiveDays: number;
  wipLimits: WipLimits;
  columnColors: KanbanColumnColors;
  columnNotes: KanbanColumnNotes;
  noteSaving: TicketStatus | null;
  collapsedColumns: Set<TicketStatus>;
  compactView: boolean;
  isMobile: boolean;
  dragId: string | null;
  overCol: TicketStatus | null;
  overLimitCol: TicketStatus | null;
  canEdit: boolean;
  isAdmin: boolean;
  technicians: TechnicianOption[];
  selectedTicketIds: Set<string>;
  cardViewers: ReadonlyMap<string, { initials: string; full_name: string }[]>;
  statusChangedAtMap: Map<string, string>;
  isWipBlocked: (targetStatus: TicketStatus, currentDragId: string | null) => boolean;
  onToggleCollapseColumn: (status: TicketStatus) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOverCol: (col: TicketStatus | null) => void;
  onOverLimitCol: (col: TicketStatus | null) => void;
  onOverCell: (cell: string | null) => void;
  onMove: (id: string, status: TicketStatus, assigneeId?: string | null) => void;
  onPriorityChange: (id: string, priority: TicketPriority) => void;
  onCardClick: (event: MouseEvent, ticketId: string) => void;
  onSaveColumnNote: (status: TicketStatus, text: string) => void;
  onSetCurrentCard: (id: string | null) => void;
}

/**
 *
 */
export function KanbanColumnsView({
  cards,
  archiveDays,
  wipLimits,
  columnColors,
  columnNotes,
  noteSaving,
  collapsedColumns,
  compactView,
  isMobile,
  dragId,
  overCol,
  overLimitCol,
  canEdit,
  isAdmin,
  technicians,
  selectedTicketIds,
  cardViewers,
  statusChangedAtMap,
  isWipBlocked,
  onToggleCollapseColumn,
  onDragStart,
  onDragEnd,
  onOverCol,
  onOverLimitCol,
  onOverCell,
  onMove,
  onPriorityChange,
  onCardClick,
  onSaveColumnNote,
  onSetCurrentCard,
}: KanbanColumnsViewProps) {
  const { t } = useTranslation(["kanban", "tickets"]);

  return (
    <div className={cn(
      isMobile ? "flex gap-4 pb-4 overflow-x-auto snap-x snap-mandatory scrollbar-thin" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4",
    )}>
      {isMobile && (
        <div className="sticky left-0 z-10 flex-shrink-0 w-px" />
      )}
      {KANBAN_STATUSES.map((s) => {
        let items = cards.filter((r) => r.status === s);
        if (s === "completed") {
          try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - (archiveDays ?? 7));
            items = items.filter((r) => r.completed_at && new Date(r.completed_at) >= cutoff);
          } catch {
            // ignore date parse issues
          }
        }
        const count = items.length;
        const limit = (wipLimits ?? DEFAULT_WIP_LIMITS)[s];
        const isOverLimit = limit > 0 && count > limit;
        const wipPct = limit > 0 ? (count / limit) * 100 : 0;
        const isHidden = collapsedColumns.has(s);
        if (isHidden) {
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggleCollapseColumn(s)}
              className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-2 py-4 transition-all hover:border-text3"
              style={{ background: columnColors[s] || undefined }}
              title={t("expandColumn", "Espandi {{column}}", { column: t("tickets:status." + s, STATUS_META[s].label) })}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: STATUS_META[s].color }}
              />
              <span className="writing-mode-vertical text-[10px] font-bold uppercase tracking-wider text-text3 [writing-mode:vertical-rl]">
                {t("tickets:status." + s, STATUS_META[s].label)}
              </span>
              <ChevronRight className="h-4 w-4 text-text3" />
              <span
                className={cn(
                  "text-[10px] font-mono",
                  isOverLimit ? "text-red-600 font-bold" : "text-text3",
                )}
              >
                {limit > 0 ? `${count}/${limit}` : count}
              </span>
            </button>
          );
        }

        const isOver = overCol === s;
        const isBlocked = overLimitCol === s;
        return (
          <div
            key={s}
            className={cn(
              "flex flex-col gap-2 rounded-xl p-1",
              isMobile && "min-w-[280px] max-w-[300px] snap-center flex-shrink-0",
              isBlocked && "pc-shake",
            )}
            onDragOver={(e) => {
              if (!dragId) return;
              if (isWipBlocked(s, dragId)) {
                e.preventDefault();
                onOverLimitCol(s);
                onOverCol(null);
                return;
              }
              e.preventDefault();
              onOverCol(s);
              onOverLimitCol(null);
            }}
            onDragLeave={() => {
              onOverCol(null);
              onOverLimitCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) {
                if (isWipBlocked(s, dragId)) {
                  toast.error(t("wipLimitBlocked", "Limite WIP raggiunto per questa colonna"));
                  onOverLimitCol(null);
                  onOverCol(null);
                  onDragEnd();
                  onOverCell(null);
                  return;
                }
                void onMove(dragId, s);
              }
              onOverCol(null);
              onDragEnd();
              onOverCell(null);
            }}
          >
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={() => onToggleCollapseColumn(s)}
                className="flex items-center gap-1 text-left"
              >
                <span
                  className="size-2.5 rounded-full flex-shrink-0"
                  style={{ background: STATUS_META[s].color }}
                />
                <span className="text-[12px] font-bold uppercase tracking-wider">
                  {t("tickets:status." + s, STATUS_META[s].label)}
                </span>
                {!count && !compactView ? (
                  <ChevronDown className="h-3 w-3 text-text3 ml-0.5" />
                ) : null}
              </button>
              {limit > 0 ? (
                <div className="ml-auto flex items-center gap-1.5">
                  <WipProgressBar pct={wipPct} className="w-14" />
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      isOverLimit ? "text-red-600 font-bold" : "text-text3",
                    )}
                  >
                    {count}/{limit}
                  </span>
                </div>
              ) : (
                <span className="ml-auto text-[10px] font-mono text-text3">{count}</span>
              )}
            </div>

            <ColumnNote
              note={columnNotes[s] ?? ""}
              saving={noteSaving === s}
              canEdit={isAdmin}
              onSave={(text: string) => { void onSaveColumnNote(s, text); }}
            />

            <div
              className="flex flex-col gap-2 min-h-[120px] p-2 rounded-[10px] transition-all"
              style={{
                background: isBlocked
                  ? `color-mix(in oklab, #DC2626 12%, transparent)`
                  : isOver
                    ? `color-mix(in oklab, ${STATUS_META[s].color} 10%, transparent)`
                    : columnColors[s] || "transparent",
                border: "1.5px dashed " + (isBlocked ? "#DC2626" : isOver ? STATUS_META[s].color : "transparent"),
                boxShadow: isBlocked ? "0 0 12px rgba(220,38,38,0.25)" : undefined,
              }}
            >
              {items.map((c) => (
                <TicketCard
                  key={c.id}
                  card={c}
                  canEdit={canEdit}
                  isDragging={dragId === c.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  selected={selectedTicketIds.has(c.id)}
                  compactView={compactView}
                  technicians={technicians}
                  statuses={KANBAN_STATUSES}
                  status={c.status}
                  assigneeId={c.assignee_id ?? null}
                  onMove={(id, status, assigneeId) => void onMove(id, status, assigneeId)}
                  onPriorityChange={(id, priority) => void onPriorityChange(id, priority)}
                  onClick={onCardClick}
                  onOpenDetail={() => setTicketContext(c.id, cards.map((r) => r.id))}
                  viewers={cardViewers.get(c.id) ?? []}
                  onHover={onSetCurrentCard}
                  statusChangedAt={statusChangedAtMap.get(c.id) ?? null}
                />
              ))}

              {!items.length && (
                <div
                  className="text-center py-6 text-[11px] text-text3 rounded-[7px]"
                  style={{ border: "1.5px dashed var(--border2)" }}
                >
                  {t("dragHere", "Trascina qui")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
