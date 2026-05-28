import { Clock, ChevronDown, ChevronRight } from "lucide-react";
import { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ColumnNote } from "@/components/kanban/ColumnNote";
import { PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import {
  DEFAULT_WIP_LIMITS,
  type KanbanColumnColors,
  type KanbanColumnNotes,
  type WipLimits,
} from "@/lib/app-settings";
import { computeCycleTime, CYCLE_COLORS, CYCLE_BG_COLORS } from "@/lib/cycle-time";
import { setTicketContext } from "@/lib/detail-navigation";
import {
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
  PRIORITY_LABEL,
  computeSlaStatus,
  formatSlaCountdown,
} from "@/lib/pcready";
import { cn } from "@/lib/utils";
import type { TechnicianOption } from "@/lib/technicians";
import type { Card as KanbanCard } from "@/routes/_app/kanban.lazy";

const KANBAN_STATUSES: TicketStatus[] = ["pending", "in-progress", "testing", "ready", "completed"];

/** SLA indicator for a card — shared with the parent route */
export function slaIndicator(card: KanbanCard) {
  const sla = computeSlaStatus(
    card.created_at || card.updated_at || new Date().toISOString(),
    card.priority,
    undefined,
    card.due_date || card.sla_deadline,
    card.sla_breached,
  );
  if (sla.status === "overdue")
    return { color: "#DC2626", label: "SLA violato", status: "overdue" as const };
  if (sla.status === "warning")
    return { color: "#CA8A04", label: "In scadenza", status: "warning" as const };
  return { color: "#16A34A", label: "SLA OK", status: "ok" as const };
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function ViewerAvatars({ viewers }: { viewers: { initials: string; full_name: string }[] }) {
  if (!viewers.length) return null;
  const max = 3;
  const shown = viewers.slice(0, max);
  const extra = viewers.length - max;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((v, i) => (
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
      {extra > 0 && (
        <span
          className="relative inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 text-[7px] font-bold leading-none"
          style={{
            background: "var(--surface3)",
            color: "var(--text3)",
            borderColor: "var(--surface1)",
          }}
          title={`+${extra} altri`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

function SlaMiniLabel({ card, compactView }: { card: KanbanCard; compactView?: boolean }) {
  const indicator = slaIndicator(card);
  const deadline = card.due_date || card.sla_deadline;
  if (indicator.status === "ok") return null;
  const countdown = deadline ? formatSlaCountdown(deadline) : indicator.label;
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
  return (
    <span className="inline-flex items-center w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Non assegnato
    </span>
  );
}

function WipProgressBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#DC2626" : pct >= 70 ? "#CA8A04" : "#16A34A";
  const bgColor = pct >= 90 ? "#FEE2E2" : pct >= 70 ? "#FEF9C3" : "#DCFCE7";
  return (
    <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: bgColor }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
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
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
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
                  <WipProgressBar pct={wipPct} />
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
                <div
                  key={c.id}
                  draggable={canEdit}
                  onDragStart={() => onDragStart(c.id)}
                  onDragEnd={onDragEnd}
                  onMouseEnter={() => onSetCurrentCard(c.id)}
                  onMouseLeave={() => onSetCurrentCard(null)}
                  onClick={(event) => onCardClick(event, c.id)}
                  className={cn(
                    "pc-card group text-left hover:shadow-md transition-all select-none min-h-[44px]",
                    compactView ? "p-2" : "p-3",
                    selectedTicketIds.has(c.id) && "ring-2 ring-accent",
                  )}
                  style={{
                    cursor: canEdit ? "grab" : "pointer",
                    opacity: dragId === c.id ? 0.4 : 1,
                    transform: dragId === c.id ? "scale(0.98)" : undefined,
                    borderLeft: `4px solid ${slaIndicator(c).color}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10.5px] text-text3">{c.ticket_code}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: slaIndicator(c).color }}
                        title={slaIndicator(c).label}
                      />
                      <PriorityLabel p={c.priority} />
                    </div>
                  </div>
                  <div
                    className={cn(
                      "font-semibold",
                      compactView ? "text-[11.5px]" : "text-[12.5px] mb-0.5",
                    )}
                  >
                    {c.device?.model || t("tickets:noAsset", "Nessun asset")}
                  </div>
                  {!compactView && (
                    <div className="text-[11px] text-text3 mb-2">{c.client}</div>
                  )}
                  {cardViewers.has(c.id) && (
                    <div className="mb-2">
                      <ViewerAvatars viewers={cardViewers.get(c.id)!} />
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
                          value={c.assignee_id ?? "unassigned"}
                          onChange={(event) =>
                            void onMove(
                              c.id,
                              c.status,
                              event.target.value === "unassigned" ? null : event.target.value,
                            )
                          }
                          title={t("assignTitle", "Assegna")}
                        >
                          <option value="unassigned">{t("tickets:unassigned", "Non assegnato")}</option>
                          {technicians.map((technician) => (
                            <option key={technician.id} value={technician.id}>
                              {technician.full_name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
                          value={c.priority}
                          onChange={(event) =>
                            void onPriorityChange(c.id, event.target.value as TicketPriority)
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
                          value={c.status}
                          onChange={(event) =>
                            void onMove(c.id, event.target.value as TicketStatus)
                          }
                          title={t("moveTo", "Sposta a")}
                        >
                          {KANBAN_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t("tickets:status." + status, STATUS_META[status].label)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="pc-btn pc-btn-ghost pc-btn-sm h-7"
                        onClick={() => setTicketContext(c.id, cards.map((r) => r.id))}
                      >
                        {t("tickets:details", "Apri dettaglio")}
                      </button>
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex items-center justify-between",
                      compactView ? "mt-2" : "",
                    )}
                  >
                    <div>
                      {c.assignee ? (
                        <AssigneeChip
                          initials={c.assignee.initials}
                          name={c.assignee.full_name}
                        />
                      ) : (
                        <UnassignedBadge />
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SlaMiniLabel card={c} compactView={compactView} />
                      {!compactView && (
                        <TimeInColumnLabel
                          updatedAt={c.updated_at}
                          createdAt={c.created_at}
                          status={c.status}
                          statusChangedAt={statusChangedAtMap.get(c.id)}
                        />
                      )}
                    </div>
                  </div>
                </div>
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
