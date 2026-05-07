import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import {
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
  PRIORITY_LABEL,
} from "@/lib/pcready";
import { openTicketDetail } from "@/lib/use-detail";
import { PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEFAULT_WIP_LIMITS, getKanbanAppSettings, type WipLimits } from "@/lib/app-settings";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { createNotification } from "@/lib/notifications";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban — PCReady" },
      { name: "description", content: "Vista Kanban dei ticket per stato di preparazione." },
    ],
  }),
  component: KanbanPage,
});

interface Card {
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

function KanbanPage() {
  const { refreshKey, triggerRefresh } = useTickets();
  const { canEdit, user, profile, session } = useAuth();
  const loadKanbanSettings = useServerFn(getKanbanAppSettings);
  const loadTechnicians = useServerFn(listTechnicians);
  const notify = useServerFn(createNotification);
  const [rows, setRows] = useState<Card[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [wipLimits, setWipLimits] = useState<WipLimits>(DEFAULT_WIP_LIMITS);
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);

  useEffect(() => {
    supabase
      .from("tickets")
      .select(
        "id, ticket_code, client, model, status, priority, assignee_id, device:devices(model, serial), assignee:profiles!tickets_assignee_id_fkey(id, full_name, initials)",
      )
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Card[]));
  }, [refreshKey]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadKanbanSettings({ data: { accessToken: session.access_token } })
      .then((settings) => setWipLimits(settings.wip_limits))
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i limiti WIP")));
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then(setTechnicians)
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i tecnici")));
  }, [session?.access_token, loadKanbanSettings, loadTechnicians]);

  async function moveTo(id: string, status: TicketStatus) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const card = rows.find((r) => r.id === id);
    if (!card || card.status === status) return;
    // optimistic
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: card.status } : r)));
      return;
    }
    await supabase.from("activity_log").insert({
      type: "user",
      message: `${card.ticket_code}: stato → "${STATUS_META[status].label}" (kanban)`,
      ticket_id: card.id,
      actor_id: user!.id,
    });
    if (card.assignee_id && session?.access_token) {
      await notify({
        data: {
          accessToken: session.access_token,
          notification: {
            userId: card.assignee_id,
            type: "ticket_status_changed",
            title: `${card.ticket_code}: ${STATUS_META[status].label}`,
            body: `${card.client} - ${card.device?.model || card.model || "Nessun asset"}`,
            payload: { ticket_id: card.id, status },
            link: "/kanban",
          },
        },
      });
    }
    toast.success(`Spostato in ${STATUS_META[status].label}`);
    triggerRefresh();
  }

  const cols: TicketStatus[] = ["pending", "in-progress", "testing", "ready"];
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
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
            {technicians.map((technician) => (
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cols.map((s) => {
          const items = filteredRows.filter((r) => r.status === s);
          const count = items.length;
          const limit = wipLimits[s];
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
                if (dragId) moveTo(dragId, s);
                setOverCol(null);
                setDragId(null);
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
                    ? "color-mix(in oklab, " + STATUS_META[s].color + " 10%, transparent)"
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
                      {c.device?.model || c.model || "Nessun asset"}
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
