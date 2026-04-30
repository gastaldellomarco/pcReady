import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { useTicketDetail } from "@/lib/use-detail";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { type ChecklistState, STATUS_META, type TicketPriority, type TicketStatus, generatePrepScript, fmtDate, PRIORITY_LABEL, type ChecklistStructure, DEFAULT_STRUCTURE, structureProgress } from "@/lib/pcready";
import { StatusBadge, PriorityLabel, AssigneeChip } from "./StatusBadge";
import { Check, Code2, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TicketRow {
  id: string; ticket_code: string; client: string; model: string; serial: string | null;
  requester: string; end_user: string | null; priority: TicketPriority; status: TicketStatus;
  assignee_id: string | null; os: string | null; software: string | null; notes: string | null;
  checklist: ChecklistState; created_at: string;
  checklist_structure?: ChecklistStructure | null;
  assignee?: { full_name: string; initials: string } | null;
}

export function TicketDetailModal() {
  const { id, close } = useTicketDetail();
  const { canEdit, isAdmin, user } = useAuth();
  const { triggerRefresh } = useTickets();
  const [t, setT] = useState<TicketRow | null>(null);
  const [tab, setTab] = useState<string>("");
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    if (!id) { setT(null); return; }
    supabase.from("tickets").select("*, assignee:profiles!tickets_assignee_id_fkey(full_name, initials)")
      .eq("id", id).maybeSingle().then(({ data }) => setT(data as unknown as TicketRow | null));
  }, [id]);

  if (!id || !t) return null;
  const ticket = t;
  const struct: ChecklistStructure = (ticket.checklist_structure && Object.keys(ticket.checklist_structure).length
    ? ticket.checklist_structure
    : DEFAULT_STRUCTURE) as ChecklistStructure;
  const tabKeys = Object.keys(struct);
  const currentTab = tab && struct[tab] ? tab : tabKeys[0];

  async function update(patch: { checklist?: ChecklistState; status?: TicketStatus }) {
    const dbPatch: TablesUpdate<"tickets"> = {
      ...patch,
      checklist: patch.checklist as unknown as Json | undefined,
    };
    const { error } = await supabase.from("tickets").update(dbPatch).eq("id", ticket.id);
    if (error) return toast.error(error.message);
    setT({ ...ticket, ...patch } as TicketRow);
    triggerRefresh();
  }

  async function toggleItem(itemId: string) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const cur = { ...(ticket.checklist || {}) } as ChecklistState;
    cur[currentTab] = { ...(cur[currentTab] || {}), [itemId]: !cur[currentTab]?.[itemId] };
    await update({ checklist: cur });
    // Auto-advance status: solo per chiavi standard
    const prog = structureProgress(cur, struct, currentTab);
    if (prog.pct === 100) {
      if (currentTab === "os" && ticket.status === "pending") await advance("in-progress", true);
      if (currentTab === "software" && ticket.status === "in-progress") await advance("testing", true);
    }
  }

  async function advance(next: TicketStatus, auto = false) {
    await update({ status: next });
    await supabase.from("activity_log").insert({
      type: auto ? "auto" : "user",
      message: `${ticket.ticket_code}: stato → "${STATUS_META[next].label}"${auto ? " automaticamente" : ""}`,
      ticket_id: ticket.id, actor_id: user!.id,
    });
    toast.success(`Avanzato a ${STATUS_META[next].label}`);
  }

  async function del() {
    if (!confirm(`Eliminare ${ticket.ticket_code}?`)) return;
    const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
    if (error) return toast.error(error.message);
    toast.success("Ticket eliminato");
    close(); triggerRefresh();
  }

  const meta = STATUS_META[t.status];

  return (
    <Modal open={true} onClose={close} size="lg" title={`${t.ticket_code} · ${t.model}`}
      footer={<>
        {isAdmin && (
          <button className="pc-btn pc-btn-danger pc-btn-sm mr-auto" onClick={del}>
            <Trash2 className="w-3 h-3" /> Elimina
          </button>
        )}
        <button className="pc-btn pc-btn-ghost" onClick={() => setShowScript(true)}>
          <Code2 className="w-3 h-3" /> Script
        </button>
        <button className="pc-btn pc-btn-ghost" onClick={close}>Chiudi</button>
        {canEdit && meta.next && (
          <button className="pc-btn pc-btn-primary" onClick={() => advance(meta.next!)}>
            Avanza → {STATUS_META[meta.next].label}
          </button>
        )}
      </>}>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Info label="Cliente" value={t.client} />
        <Info label="Stato" value={<StatusBadge status={t.status} />} />
        <Info label="Seriale" value={<span className="font-mono text-text3 text-xs">{t.serial || "—"}</span>} />
        <Info label="Priorità" value={<PriorityLabel p={t.priority} />} />
        <Info label="Richiedente" value={t.requester} />
        <Info label="Utente finale" value={t.end_user || "—"} />
        <Info label="Assegnato a" value={<AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} />} />
        <Info label="Creato" value={fmtDate(t.created_at)} />
        <Info label="OS" value={t.os || "—"} />
        <Info label="Software" value={<span className="text-xs">{t.software || "—"}</span>} />
      </div>

      {t.notes && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="pc-label">Note</div>
          <div className="text-[12.5px] text-text2">{t.notes}</div>
        </div>
      )}

      <div className="border-b mb-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex">
          {tabKeys.map(key => {
            const p = structureProgress(t.checklist || {}, struct, key);
            const on = currentTab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                className="px-4 py-2 text-[12.5px] font-semibold transition-colors -mb-px border-b-2"
                style={{ color: on ? "var(--accent)" : "var(--text3)", borderColor: on ? "var(--accent)" : "transparent" }}>
                {struct[key].label} <span className="font-mono text-[10px] opacity-70">{p.done}/{p.total}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {(struct[currentTab]?.items || []).map(item => {
          const done = t.checklist?.[currentTab]?.[item.id];
          return (
            <button key={item.id} type="button" onClick={() => toggleItem(item.id)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-left text-[13px] transition-all"
              style={{
                background: "var(--surface2)", border: "1px solid var(--border)",
                color: done ? "var(--text3)" : "var(--text)",
                textDecoration: done ? "line-through" : "none",
              }}>
              <span className="w-[17px] h-[17px] rounded flex items-center justify-center flex-shrink-0"
                style={{ background: done ? "var(--success)" : "transparent", border: "1.5px solid " + (done ? "var(--success)" : "var(--border2)") }}>
                {done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
              {item.text}
            </button>
          );
        })}
        {!struct[currentTab]?.items?.length && (
          <div className="text-center py-6 text-text3 text-[12px]">Nessuna voce in questa sezione</div>
        )}
      </div>

      {showScript && (
        <Modal open={true} onClose={() => setShowScript(false)} size="lg" title="Script di preparazione PC"
          footer={<>
            <button className="pc-btn pc-btn-ghost" onClick={() => setShowScript(false)}>Chiudi</button>
            <button className="pc-btn pc-btn-primary" onClick={async () => {
              await navigator.clipboard.writeText(generatePrepScript(t)); toast.success("Script copiato");
            }}><Copy className="w-3 h-3" /> Copia</button>
          </>}>
          <pre className="text-[11.5px] font-mono p-3 rounded-md overflow-auto max-h-[60vh]"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            {generatePrepScript(t)}
          </pre>
        </Modal>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="pc-label">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}
