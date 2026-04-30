import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import {
  PRIORITY_LABEL,
  type TicketPriority,
  DEFAULT_STRUCTURE,
  type ChecklistStructure,
} from "@/lib/pcready";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { toast } from "sonner";

interface Tech {
  id: string;
  full_name: string;
  initials: string;
}
interface TplOpt {
  id: string;
  name: string;
  structure: ChecklistStructure;
  is_default: boolean;
}
interface ClientOpt {
  id: string;
  name: string;
  company_name: string | null;
}
interface ContactOpt {
  id: string;
  client_id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  job_title: string | null;
  role: string | null;
  is_primary: boolean;
}
interface DeviceOpt {
  id: string;
  client_id: string;
  model: string;
  serial: string | null;
  os: string | null;
  assigned_to: string | null;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CreateTicketModal() {
  const { createOpen, closeCreate, triggerRefresh } = useTickets();
  const { user, canEdit } = useAuth();
  const [techs, setTechs] = useState<Tech[]>([]);
  const [templates, setTemplates] = useState<TplOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [devices, setDevices] = useState<DeviceOpt[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    client_id: "",
    device_id: "",
    requester_contact_id: "",
    requester: "",
    free_requester: false,
    priority: "med" as TicketPriority,
    assignee_id: "",
    software: "",
    notes: "",
  });

  useEffect(() => {
    if (!createOpen) return;
    supabase
      .from("profiles")
      .select("id, full_name, initials")
      .order("full_name")
      .then(({ data }) => setTechs((data ?? []) as Tech[]));
    supabase
      .from("clients")
      .select("id, name, company_name")
      .order("name")
      .then(({ data }) => {
        const arr = (data ?? []) as ClientOpt[];
        setClients(arr);
        setF((cur) => ({ ...cur, client_id: cur.client_id || arr[0]?.id || "" }));
      });
    supabase
      .from("checklist_templates")
      .select("id, name, structure, is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const arr = (data ?? []) as unknown as TplOpt[];
        setTemplates(arr);
        const def = arr.find((t) => t.is_default) || arr[0];
        if (def) setTemplateId(def.id);
      });
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen || !f.client_id) {
      setDevices([]);
      setContacts([]);
      return;
    }
    supabase
      .from("devices")
      .select("id, client_id, model, serial, os, assigned_to")
      .eq("client_id", f.client_id)
      .order("model")
      .then(({ data }) => {
        const arr = (data ?? []) as DeviceOpt[];
        setDevices(arr);
        setF((cur) => ({
          ...cur,
          device_id: arr.some((d) => d.id === cur.device_id) ? cur.device_id : "",
        }));
      });
    supabase
      .from("client_contacts")
      .select("id, client_id, full_name, first_name, last_name, email, job_title, role, is_primary")
      .eq("client_id", f.client_id)
      .order("is_primary", { ascending: false })
      .order("full_name")
      .then(({ data }) => {
        const arr = (data ?? []) as ContactOpt[];
        setContacts(arr);
        setF((cur) => {
          if (cur.free_requester) return { ...cur, requester_contact_id: "" };
          const current = arr.find((c) => c.id === cur.requester_contact_id);
          const next = current || arr[0];
          return {
            ...cur,
            requester_contact_id: next?.id || "",
            requester: next ? contactName(next) : "",
          };
        });
      });
  }, [createOpen, f.client_id]);

  async function submit() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!f.client_id || !f.requester) return toast.error("Compila i campi obbligatori");
    setBusy(true);
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const structure = tpl?.structure || DEFAULT_STRUCTURE;
      const client = clients.find((c) => c.id === f.client_id);
      const device = devices.find((d) => d.id === f.device_id);
      if (!client) return toast.error("Seleziona un cliente");
      const contact = contacts.find((c) => c.id === f.requester_contact_id);
      const requester = f.free_requester ? f.requester.trim() : contact ? contactName(contact) : "";
      if (!requester) return toast.error("Seleziona un richiedente o usa il fallback libero");
      const ticketInsert = {
        client: client.company_name || client.name,
        client_id: client.id,
        device_id: device?.id || null,
        requester,
        requester_contact_id: f.free_requester ? null : contact?.id || null,
        priority: f.priority,
        status: "pending",
        assignee_id: f.assignee_id || null,
        software: f.software || null,
        notes: f.notes || null,
        checklist: {},
        created_by: user!.id,
        template_id: tpl?.id || null,
        checklist_structure: structure as unknown as Json,
      } as Omit<TablesInsert<"tickets">, "ticket_code">;
      // ticket_code viene assegnato dal trigger DB per evitare collisioni tra client.
      const { data, error } = await supabase
        .from("tickets")
        .insert(ticketInsert as TablesInsert<"tickets">)
        .select("id, ticket_code")
        .single();
      if (error) throw error;
      await supabase.from("activity_log").insert({
        type: "user",
        message: `${data.ticket_code} creato`,
        ticket_id: data.id,
        actor_id: user!.id,
      });
      toast.success(`${data.ticket_code} creato`);
      setF({
        client_id: clients[0]?.id || "",
        device_id: "",
        requester_contact_id: "",
        requester: "",
        free_requester: false,
        priority: "med",
        assignee_id: "",
        software: "",
        notes: "",
      });
      closeCreate();
      triggerRefresh();
    } catch (e: unknown) {
      toast.error(errorMessage(e, "Errore creazione"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={createOpen}
      onClose={closeCreate}
      title="Nuovo ticket PC"
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={closeCreate}>
            Annulla
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy} onClick={submit}>
            {busy ? "Creazione..." : "Crea ticket"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Cliente *">
            <select
              className="pc-input"
              value={f.client_id}
              onChange={(e) =>
                setF({
                  ...f,
                  client_id: e.target.value,
                  device_id: "",
                  requester_contact_id: "",
                  requester: "",
                })
              }
            >
              {!clients.length && <option value="">Nessun cliente disponibile</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dispositivo">
            <select
              className="pc-input"
              value={f.device_id}
              onChange={(e) => setF({ ...f, device_id: e.target.value })}
            >
              <option value="">
                {devices.length
                  ? "Nessun dispositivo associato"
                  : "Nessun dispositivo per questo cliente"}
              </option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.model}
                  {d.serial ? ` - ${d.serial}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Richiedente *">
            {f.free_requester ? (
              <input
                className="pc-input"
                value={f.requester}
                onChange={(e) => setF({ ...f, requester: e.target.value })}
                placeholder="Nome richiedente non censito"
              />
            ) : (
              <select
                className="pc-input"
                value={f.requester_contact_id}
                onChange={(e) => {
                  const contact = contacts.find((c) => c.id === e.target.value);
                  setF({
                    ...f,
                    requester_contact_id: e.target.value,
                    requester: contact ? contactName(contact) : "",
                  });
                }}
              >
                {!contacts.length && <option value="">Nessun referente per questo cliente</option>}
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactName(c)}
                    {c.job_title || c.role ? ` - ${c.job_title || c.role}` : ""}
                  </option>
                ))}
              </select>
            )}
            <label className="mt-2 flex items-center gap-2 text-[12px] text-text3">
              <input
                type="checkbox"
                checked={f.free_requester}
                onChange={(e) =>
                  setF({
                    ...f,
                    free_requester: e.target.checked,
                    requester_contact_id: "",
                    requester: "",
                  })
                }
              />
              Richiedente libero
            </label>
          </Field>
          <Field label="Priorità">
            <select
              className="pc-input"
              value={f.priority}
              onChange={(e) => setF({ ...f, priority: e.target.value as TicketPriority })}
            >
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Assegna a">
            <select
              className="pc-input"
              value={f.assignee_id}
              onChange={(e) => setF({ ...f, assignee_id: e.target.value })}
            >
              <option value="">— Non assegnato —</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Software richiesti">
          <textarea
            className="pc-input min-h-[72px]"
            value={f.software}
            onChange={(e) => setF({ ...f, software: e.target.value })}
            placeholder="Microsoft 365, Adobe CC, VS Code..."
          />
        </Field>
        <Field label="Modello checklist">
          <select
            className="pc-input"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {!templates.length && <option value="">— Checklist standard —</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.is_default ? "  (predefinito)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <textarea
            className="pc-input min-h-[72px]"
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="pc-label">{label}</label>
      {children}
    </div>
  );
}

function contactName(c: ContactOpt) {
  return c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ");
}
