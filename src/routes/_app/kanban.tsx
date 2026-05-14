import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import queries from "@/lib/queries/tickets";
import activityQueries from "@/lib/queries/activity";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketPriority, type TicketStatus, PRIORITY_LABEL } from "@/lib/pcready";
import { openTicketDetail } from "@/lib/use-detail";
import { PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwimLaneView } from "@/components/kanban/SwimLaneView";
import { cn } from "@/lib/utils";
import { DEFAULT_WIP_LIMITS, getKanbanAppSettings, type WipLimits } from "@/lib/app-settings";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { createNotification } from "@/lib/notifications";
import { sendTicketAssignedEmail } from "@/lib/email-events";
import { Rows3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban — PCReady" },
      { name: "description", content: "Vista Kanban dei ticket per stato di preparazione." },
    ],
  }),
  component: KanbanPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

interface Card {
  id: string;
  ticket_code: string;
  client: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  device?: { model: string; serial: string | null } | null;
  assignee?: { id: string; full_name: string; initials: string } | null;
  completed_at?: string | null;
}

type ViewMode = "columns" | "swimlanes";
const KANBAN_STATUSES: TicketStatus[] = ["pending", "in-progress", "testing", "ready", "completed"];
const KANBAN_VIEW_MODE_KEY = "pcready:kanban:view-mode";

function KanbanPage() {
  useTickets();
  const { canEdit, user, profile, session } = useAuth();
  const loadKanbanSettings = useServerFn(getKanbanAppSettings);
  const loadTechnicians = useServerFn(listTechnicians);
  const notify = useServerFn(createNotification);
  const sendAssignedEmail = useServerFn(sendTicketAssignedEmail);

  const [rows, setRows] = useState<Card[]>([]);
  const [archiveDays, setArchiveDays] = useState<number>(7);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [wipLimits, setWipLimits] = useState<WipLimits>(DEFAULT_WIP_LIMITS);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "columns";
    return window.localStorage.getItem(KANBAN_VIEW_MODE_KEY) === "swimlanes"
      ? "swimlanes"
      : "columns";
  });

  useEffect(() => {
    window.localStorage.setItem(KANBAN_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const { useTicketsList, useUpdateTicket } = queries as any;
  const listQuery = useTicketsList({ pageSize: 2000 });
  const updateTicket = useUpdateTicket();
  useEffect(() => {
    if (listQuery.data) setRows((Array.isArray(listQuery.data.data) ? listQuery.data.data : []) as Card[]);
  }, [listQuery.data]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadKanbanSettings({ data: { accessToken: session.access_token } })
      .then((settings) => {
        setWipLimits(settings?.wip_limits ?? DEFAULT_WIP_LIMITS);
        setArchiveDays(settings?.archive_after_days ?? 7);
      })
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i limiti WIP")));
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then((t) => setTechnicians(Array.isArray(t) ? t : []))
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i tecnici")));
  }, [session?.access_token, loadKanbanSettings, loadTechnicians]);

  async function moveTo(id: string, status: TicketStatus, assigneeId?: string | null) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const card = rows.find((r) => r.id === id);
    if (!card) return;
    const nextAssigneeId = assigneeId === undefined ? card.assignee_id : assigneeId;
    if (card.status === status && card.assignee_id === nextAssigneeId) return;
    const nextAssignee = nextAssigneeId
      ? technicians.find((technician) => technician.id === nextAssigneeId)
      : null;
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              assignee_id: nextAssigneeId,
              assignee: nextAssignee
                ? {
                    id: nextAssignee.id,
                    full_name: nextAssignee.full_name,
                    initials: nextAssignee.initials,
                  }
                : null,
            }
          : r,
      ),
    );
    try {
      await updateTicket.mutateAsync({ id, patch: { status, assignee_id: nextAssigneeId } });
    } catch (err: any) {
      toast.error(err?.message || 'Errore aggiornamento ticket');
      setRows((rs) => rs.map((r) => (r.id === id ? card : r)));
      return;
    }
    // Insert status history record when status changes
    if (card.status !== status) {
      await (queries as any).addTicketStatusHistory(id, {
        from_status: card.status,
        to_status: status,
        changed_by: user!.id,
        changed_at: new Date().toISOString(),
        note: nextAssigneeId !== card.assignee_id ? `Assegnato a ${nextAssignee?.full_name || "Non assegnato"}` : null,
      });
    }

    // Trigger completion workflow when status changes to 'completed'
    if (status === "completed" && card.status !== "completed" && session?.access_token) {
      const { completeTicketServer } = await import("@/lib/ticket-completion");
      void completeTicketServer({ data: { ticketId: id, changedBy: user!.id, accessToken: session.access_token } }).catch((err) => {
        console.error("Failed to complete ticket:", err);
        toast.error("Ticket completato, ma errore invio email/verbale");
      });
    }
    await (activityQueries.insertActivity as any)({ type: 'user', message: `${card.ticket_code}: stato → "${STATUS_META[status].label}" (kanban)`, ticket_id: card.id, actor_id: user!.id });
    if (nextAssigneeId && session?.access_token) {
      await notify({
        data: {
          accessToken: session.access_token,
          notification: {
            userId: nextAssigneeId,
            type: "ticket_status_changed",
            title: `${card.ticket_code}: ${STATUS_META[status].label}`,
            body: `${card.client} - ${card.device?.model || "Nessun asset"}`,
            payload: { ticket_id: card.id, status, assignee_id: nextAssigneeId },
            link: "/kanban",
          },
        },
      });
    }
    if (nextAssigneeId && nextAssigneeId !== card.assignee_id) {
      void sendAssignedEmail({ data: { ticketId: card.id, assigneeId: nextAssigneeId } }).catch((err) => {
        console.error("Failed to send ticket assigned email:", err);
      });
    }
    toast.success(
      nextAssigneeId !== card.assignee_id
        ? `Spostato in ${STATUS_META[status].label} (${nextAssignee?.full_name || "Non assegnato"})`
        : `Spostato in ${STATUS_META[status].label}`,
    );
    // React Query invalidation handles refreshing lists
  }

  const filteredRows = useMemo(() => {
    const baseRows = Array.isArray(rows) ? rows : [];
    return baseRows.filter((row) => {
      const matchesAssignee =
        filterAssignee === "all" ||
        (filterAssignee === "me" && row.assignee_id === profile?.id) ||
        (filterAssignee === "unassigned" && !row.assignee_id) ||
        row.assignee_id === filterAssignee;
      const matchesPriority = filterPriority === "all" || row.priority === filterPriority;
      return matchesAssignee && matchesPriority;
    });
  }, [filterAssignee, filterPriority, profile?.id, rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tutti i tecnici" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tecnici</SelectItem>
            <SelectItem value="me">Solo i miei</SelectItem>
            <SelectItem value="unassigned">Non assegnati</SelectItem>
            {(Array.isArray(technicians) ? technicians : []).map((technician) => (
              <SelectItem key={technician.id} value={technician.id}>
                {technician.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Priorita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-text3 font-mono">
          {filteredRows.length} di {rows.length} ticket
        </span>
        <button
          type="button"
          className={cn(
            "pc-btn pc-btn-sm",
            viewMode === "swimlanes" ? "pc-btn-primary" : "pc-btn-ghost",
          )}
          onClick={() => setViewMode((mode) => (mode === "columns" ? "swimlanes" : "columns"))}
        >
          <Rows3 className="h-3.5 w-3.5" />
          Swim Lanes
        </button>
      </div>

      {viewMode === "swimlanes" ? (
        <SwimLaneView
          cards={filteredRows}
          technicians={Array.isArray(technicians) ? technicians : []}
          wipLimits={wipLimits ?? DEFAULT_WIP_LIMITS}
          statuses={KANBAN_STATUSES}
          canEdit={canEdit}
          dragId={dragId}
          overCell={overCell}
          onDragStart={setDragId}
          onDragEnd={() => {
            setDragId(null);
            setOverCol(null);
            setOverCell(null);
          }}
          onDragOverCell={setOverCell}
          onDragLeaveCell={(cellId) => setOverCell((cell) => (cell === cellId ? null : cell))}
          onMove={(id, status, assigneeId) => void moveTo(id, status, assigneeId)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {KANBAN_STATUSES.map((s) => {
            let items = filteredRows.filter((r) => r.status === s);
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
            const isOver = overCol === s;
            return (
              <div
                key={s}
                className="flex flex-col gap-2"
                onDragOver={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    setOverCol(s);
                  }
                }}
                onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) void moveTo(dragId, s);
                  setOverCol(null);
                  setDragId(null);
                  setOverCell(null);
                }}
              >
                <div className="flex items-center gap-2 px-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: STATUS_META[s].color }}
                  />
                  <span className="text-[12px] font-bold uppercase tracking-wider">
                    {STATUS_META[s].label}
                  </span>
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full border",
                      isOverLimit
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "text-text3 border-border",
                    )}
                    style={isOverLimit ? undefined : { background: "var(--surface3)" }}
                  >
                    {count}/{limit}
                  </span>
                </div>

                <div
                  className="flex flex-col gap-2 min-h-[120px] p-2 rounded-[10px] transition-all"
                  style={{
                    background: isOver
                      ? `color-mix(in oklab, ${STATUS_META[s].color} 10%, transparent)`
                      : "transparent",
                    border: "1.5px dashed " + (isOver ? STATUS_META[s].color : "transparent"),
                  }}
                >
                  {items.map((c) => (
                    <div
                      key={c.id}
                      draggable={canEdit}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                        setOverCell(null);
                      }}
                      onClick={() => openTicketDetail(c.id)}
                      className="pc-card text-left p-3 hover:shadow-md transition-all select-none"
                      style={{
                        cursor: canEdit ? "grab" : "pointer",
                        opacity: dragId === c.id ? 0.4 : 1,
                        transform: dragId === c.id ? "scale(0.98)" : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10.5px] text-text3">{c.ticket_code}</span>
                        <PriorityLabel p={c.priority} />
                      </div>
                      <div className="text-[12.5px] font-semibold mb-0.5">
                        {c.device?.model || "Nessun asset"}
                      </div>
                      <div className="text-[11px] text-text3 mb-2">{c.client}</div>
                      {c.assignee ? (
                        <AssigneeChip initials={c.assignee.initials} name={c.assignee.full_name} />
                      ) : (
                        <UnassignedBadge />
                      )}
                    </div>
                  ))}

                  {!items.length && (
                    <div
                      className="text-center py-6 text-[11px] text-text3 rounded-[7px]"
                      style={{ border: "1.5px dashed var(--border2)" }}
                    >
                      Trascina qui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnassignedBadge() {
  return (
    <span className="inline-flex items-center w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Non assegnato
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
