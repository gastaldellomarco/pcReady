import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketStatus } from "@/lib/pcready";
import { openTicketDetail } from "@/lib/use-detail";
import { PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({ meta: [{ title: "Kanban — PCReady" }, { name: "description", content: "Vista Kanban dei ticket per stato di preparazione." }] }),
  component: KanbanPage,
});

interface Card { id: string; ticket_code: string; client: string; model: string; status: TicketStatus;
  priority: any; assignee?: { full_name: string; initials: string } | null; }

function KanbanPage() {
  const { refreshKey, triggerRefresh } = useTickets();
  const { canEdit, user } = useAuth();
  const [rows, setRows] = useState<Card[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);

  useEffect(() => {
    supabase.from("tickets").select("id, ticket_code, client, model, status, priority, assignee:profiles!tickets_assignee_id_fkey(full_name, initials)")
      .order("created_at", { ascending: false }).then(({ data }) => setRows((data ?? []) as any));
  }, [refreshKey]);

  async function moveTo(id: string, status: TicketStatus) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const card = rows.find(r => r.id === id);
    if (!card || card.status === status) return;
    // optimistic
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setRows(rs => rs.map(r => r.id === id ? { ...r, status: card.status } : r));
      return;
    }
    await supabase.from("activity_log").insert({
      type: "user", message: `${card.ticket_code}: stato → "${STATUS_META[status].label}" (kanban)`,
      ticket_id: card.id, actor_id: user!.id,
    });
    toast.success(`Spostato in ${STATUS_META[status].label}`);
    triggerRefresh();
  }

  const cols: TicketStatus[] = ["pending", "in-progress", "testing", "ready"];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cols.map(s => {
        const items = rows.filter(r => r.status === s);
        const isOver = overCol === s;
        return (
          <div key={s} className="flex flex-col gap-2"
            onDragOver={e => { if (dragId) { e.preventDefault(); setOverCol(s); } }}
            onDragLeave={() => setOverCol(c => c === s ? null : c)}
            onDrop={e => { e.preventDefault(); if (dragId) moveTo(dragId, s); setOverCol(null); setDragId(null); }}>
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[s].color }}/>
              <span className="text-[12px] font-bold uppercase tracking-wider">{STATUS_META[s].label}</span>
              <span className="ml-auto text-[10px] font-mono text-text3 px-2 py-0.5 rounded-full"
                style={{ background: "var(--surface3)", border: "1px solid var(--border)" }}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 min-h-[120px] p-2 rounded-[10px] transition-all"
              style={{
                background: isOver ? "color-mix(in oklab, " + STATUS_META[s].color + " 10%, transparent)" : "transparent",
                border: "1.5px dashed " + (isOver ? STATUS_META[s].color : "transparent"),
              }}>
              {items.map(c => (
                <div key={c.id}
                  draggable={canEdit}
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => openTicketDetail(c.id)}
                  className="pc-card text-left p-3 hover:shadow-md transition-all select-none"
                  style={{
                    cursor: canEdit ? "grab" : "pointer",
                    opacity: dragId === c.id ? 0.4 : 1,
                    transform: dragId === c.id ? "scale(0.98)" : undefined,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10.5px] text-text3">{c.ticket_code}</span>
                    <PriorityLabel p={c.priority} />
                  </div>
                  <div className="text-[12.5px] font-semibold mb-0.5">{c.model}</div>
                  <div className="text-[11px] text-text3 mb-2">{c.client}</div>
                  <AssigneeChip initials={c.assignee?.initials} name={c.assignee?.full_name} />
                </div>
              ))}
              {!items.length && <div className="text-center py-6 text-[11px] text-text3 rounded-[7px]"
                style={{ border: "1.5px dashed var(--border2)" }}>Trascina qui</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
