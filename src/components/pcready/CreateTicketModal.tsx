import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { CLIENTS, OS_OPTIONS, PRIORITY_LABEL, type TicketPriority, DEFAULT_STRUCTURE, type ChecklistStructure } from "@/lib/pcready";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { toast } from "sonner";

interface Tech { id: string; full_name: string; initials: string; }
interface TplOpt { id: string; name: string; structure: ChecklistStructure; is_default: boolean; }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CreateTicketModal() {
  const { createOpen, closeCreate, triggerRefresh } = useTickets();
  const { user, canEdit } = useAuth();
  const [techs, setTechs] = useState<Tech[]>([]);
  const [templates, setTemplates] = useState<TplOpt[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    model: "", serial: "", requester: "", end_user: "",
    client: CLIENTS[0], priority: "med" as TicketPriority,
    assignee_id: "", os: OS_OPTIONS[0], software: "", notes: "",
  });

  useEffect(() => {
    if (!createOpen) return;
    supabase.from("profiles").select("id, full_name, initials")
      .order("full_name").then(({ data }) => setTechs((data ?? []) as Tech[]));
    supabase.from("checklist_templates").select("id, name, structure, is_default")
      .order("is_default", { ascending: false }).order("created_at", { ascending: true })
      .then(({ data }) => {
        const arr = (data ?? []) as unknown as TplOpt[];
        setTemplates(arr);
        const def = arr.find(t => t.is_default) || arr[0];
        if (def) setTemplateId(def.id);
      });
  }, [createOpen]);

  async function submit() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!f.model || !f.requester || !f.client) return toast.error("Compila i campi obbligatori");
    setBusy(true);
    try {
      const code = `PCT-${String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0")}`;
      const tpl = templates.find(t => t.id === templateId);
      const structure = tpl?.structure || DEFAULT_STRUCTURE;
      const { data, error } = await supabase.from("tickets").insert({
        ticket_code: code,
        client: f.client, model: f.model, serial: f.serial || null,
        requester: f.requester, end_user: f.end_user || null,
        priority: f.priority, status: "pending",
        assignee_id: f.assignee_id || null,
        os: f.os, software: f.software || null, notes: f.notes || null,
        checklist: {}, created_by: user!.id,
        template_id: tpl?.id || null,
        checklist_structure: structure as unknown as Json,
      }).select("id, ticket_code").single();
      if (error) throw error;
      await supabase.from("activity_log").insert({
        type: "user", message: `${data.ticket_code} creato`,
        ticket_id: data.id, actor_id: user!.id,
      });
      toast.success(`${data.ticket_code} creato`);
      setF({ model: "", serial: "", requester: "", end_user: "", client: CLIENTS[0],
        priority: "med", assignee_id: "", os: OS_OPTIONS[0], software: "", notes: "" });
      closeCreate();
      triggerRefresh();
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Errore creazione"));
    } finally { setBusy(false); }
  }

  return (
    <Modal open={createOpen} onClose={closeCreate} title="Nuovo dispositivo / ticket PC" size="lg"
      footer={<>
        <button className="pc-btn pc-btn-ghost" onClick={closeCreate}>Annulla</button>
        <button className="pc-btn pc-btn-primary" disabled={busy} onClick={submit}>
          {busy ? "Creazione…" : "Crea ticket"}
        </button>
      </>}>
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Modello PC *"><input className="pc-input" value={f.model}
            onChange={e => setF({ ...f, model: e.target.value })} placeholder="Dell Latitude 5540" /></Field>
          <Field label="Seriale"><input className="pc-input font-mono" value={f.serial}
            onChange={e => setF({ ...f, serial: e.target.value })} placeholder="ABCD1234" /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Richiedente *"><input className="pc-input" value={f.requester}
            onChange={e => setF({ ...f, requester: e.target.value })} /></Field>
          <Field label="Utente finale"><input className="pc-input" value={f.end_user}
            onChange={e => setF({ ...f, end_user: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Cliente *">
            <select className="pc-input" value={f.client} onChange={e => setF({ ...f, client: e.target.value })}>
              {CLIENTS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Priorità">
            <select className="pc-input" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as TicketPriority })}>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Assegna a">
            <select className="pc-input" value={f.assignee_id} onChange={e => setF({ ...f, assignee_id: e.target.value })}>
              <option value="">— Non assegnato —</option>
              {techs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </Field>
          <Field label="OS richiesto">
            <select className="pc-input" value={f.os} onChange={e => setF({ ...f, os: e.target.value })}>
              {OS_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Software richiesti"><textarea className="pc-input min-h-[72px]" value={f.software}
          onChange={e => setF({ ...f, software: e.target.value })} placeholder="Microsoft 365, Adobe CC, VS Code..." /></Field>
        <Field label="Modello checklist">
          <select className="pc-input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
            {!templates.length && <option value="">— Checklist standard —</option>}
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.is_default ? "  (predefinito)" : ""}</option>
            ))}
          </select>
        </Field>
        <Field label="Note"><textarea className="pc-input min-h-[72px]" value={f.notes}
          onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="pc-label">{label}</label>{children}</div>;
}
