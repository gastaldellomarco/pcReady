import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "./Modal";
import {
  PRIORITY_LABEL,
  type TicketPriority,
  TICKET_TYPE_LABEL,
  type TicketType,
  DEFAULT_STRUCTURE,
  type ChecklistStructure,
} from "@/lib/pcready";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import { createNotification } from "@/lib/notifications";
import { sendTicketAssignedEmail } from "@/lib/email-events";
import { toast } from "sonner";
import { AsyncAutocomplete, type AsyncAutocompleteOption } from "./AsyncAutocomplete";
import { getPublicAppSettings, validateTechnicianDeviceLimit } from "@/lib/app-settings";

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
  email?: string | null;
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
type DeviceFlow = "existing" | "none";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function CreateTicketModal() {
  const { createOpen, closeCreate, triggerRefresh } = useTickets();
  const { user, canEdit, session } = useAuth();
  const notify = useServerFn(createNotification);
  const sendAssignedEmail = useServerFn(sendTicketAssignedEmail);
  const loadSettings = useServerFn(getPublicAppSettings);
  const validateLimit = useServerFn(validateTechnicianDeviceLimit);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [templates, setTemplates] = useState<TplOpt[]>([]);
  const [ticketCategories, setTicketCategories] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOpt | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactOpt | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceOpt | null>(null);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlow>("existing");
  const [templateId, setTemplateId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    client_id: "",
    device_id: "",
    requester_contact_id: "",
    requester: "",
    free_requester: false,
    ticket_type: "device" as TicketType,
    priority: "med" as TicketPriority,
    assignee_id: "",
    ticket_category: "",
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
    loadSettings()
      .then((s) => setTicketCategories(s?.ticket_categories ?? []))
      .catch(() => setTicketCategories([]));
  }, [createOpen]);

  async function submit() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    if (!f.client_id || !f.requester) return toast.error("Compila i campi obbligatori");
    if (f.ticket_type === "device" && !f.device_id) {
      return toast.error("Seleziona un dispositivo");
    }
    setBusy(true);
    try {
      const tpl = templates.find((t) => t.id === templateId);
      const structure = tpl?.structure || DEFAULT_STRUCTURE;
      const client = selectedClient?.id === f.client_id ? selectedClient : await fetchClientById(f.client_id);
      const device =
        deviceFlow === "existing"
          ? selectedDevice?.id === f.device_id
            ? selectedDevice
            : await fetchDeviceById(f.device_id)
          : null;
      if (!client) return toast.error("Seleziona un cliente");
      const contact =
        selectedContact?.id === f.requester_contact_id
          ? selectedContact
          : await fetchContactById(f.requester_contact_id);
      const requester = f.free_requester ? f.requester.trim() : contact ? contactName(contact) : "";
      if (!requester) return toast.error("Seleziona un richiedente o usa il fallback libero");
      const ticketInsert = {
        client: client.company_name || client.name,
        client_id: client.id,
        device_id: f.ticket_type === "device" ? device?.id || null : null,
        category: f.ticket_category || null,
        requester,
        requester_contact_id: f.free_requester ? null : contact?.id || null,
        priority: f.priority,
        ticket_type: f.ticket_type,
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
      // Insert initial status history record
      await (supabase as any).from("ticket_status_history").insert({
        ticket_id: data.id,
        from_status: null,
        to_status: "pending",
        changed_by: user!.id,
        changed_at: new Date().toISOString(),
        note: "Ticket creato",
      });
      await supabase.from("activity_log").insert({
        type: "user",
        message: `${data.ticket_code} creato`,
        ticket_id: data.id,
        actor_id: user!.id,
      });
      if (f.assignee_id && session?.access_token) {
        // Validate technician device limit for device tickets
        if (f.ticket_type === "device") {
          await validateLimit({ data: { assigneeId: f.assignee_id } }).catch((err) => {
            throw err instanceof Error ? err : new Error("Limite tecnico superato");
          });
        }
        const assignee = techs.find((t) => t.id === f.assignee_id);
        await notify({
          data: {
            accessToken: session.access_token,
            notification: {
              userId: f.assignee_id,
              type: "ticket_assigned",
              title: `${data.ticket_code} assegnato a te`,
              body: `${client.company_name || client.name} - ${device?.model || "Nessun asset"}`,
              payload: { ticket_id: data.id, ticket_code: data.ticket_code },
              link: "/tickets",
            },
          },
        });
        void sendAssignedEmail({ data: { ticketId: data.id, assigneeId: f.assignee_id } }).catch((err) => {
          console.error("Failed to send ticket assigned email:", err);
        });
        if (assignee) toast.message(`Notifica inviata a ${assignee.full_name}`);
      }
      toast.success(`${data.ticket_code} creato`);
      setF({
        client_id: "",
        device_id: "",
        requester_contact_id: "",
        requester: "",
        free_requester: false,
        ticket_type: "device",
        priority: "med",
        assignee_id: "",
        ticket_category: "",
        software: "",
        notes: "",
      });
      setSelectedClient(null);
      setSelectedContact(null);
      setSelectedDevice(null);
      setDeviceFlow("existing");
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
            <AsyncAutocomplete
              value={f.client_id}
              selectedOption={selectedClient ? clientOption(selectedClient) : null}
              placeholder="Cerca cliente..."
              emptyLabel="Nessun cliente"
              loadOptions={loadClientOptions}
              onChange={(value, option) => {
                const client = option ? optionToClient(option) : null;
                setSelectedClient(client);
                setSelectedContact(null);
                setSelectedDevice(null);
                setF({
                  ...f,
                  client_id: value,
                  device_id: "",
                  requester_contact_id: "",
                  requester: "",
                });
              }}
            />
          </Field>
          <Field label="Categoria">
            <select
              className="pc-input"
              value={f.ticket_category}
              onChange={(e) => setF({ ...f, ticket_category: e.target.value })}
            >
              <option value="">— Nessuna —</option>
              {ticketCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo ticket">
            <select
              className="pc-input"
              value={f.ticket_type}
              onChange={(e) => {
                const ticketType = e.target.value as TicketType;
                setF({ ...f, ticket_type: ticketType, device_id: ticketType === "device" ? f.device_id : "" });
                if (ticketType !== "device") setSelectedDevice(null);
              }}
            >
              {Object.entries(TICKET_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {f.ticket_type === "device" && (
          <Field label="Dispositivo *">
            <AsyncAutocomplete
              value={f.device_id}
              selectedOption={selectedDevice ? deviceOption(selectedDevice) : null}
              placeholder={f.client_id ? "Cerca dispositivo..." : "Seleziona prima un cliente"}
              emptyLabel="Nessun dispositivo"
              disabled={!f.client_id}
              loadOptions={(query) => loadDeviceOptions(query, f.client_id)}
              onChange={(value, option) => {
                setSelectedDevice(option ? optionToDevice(option) : null);
                setF({ ...f, device_id: value });
              }}
            />
          </Field>
        )}
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
              <AsyncAutocomplete
                value={f.requester_contact_id}
                selectedOption={selectedContact ? contactOption(selectedContact) : null}
                placeholder={f.client_id ? "Cerca referente..." : "Seleziona prima un cliente"}
                emptyLabel="Nessun referente"
                disabled={!f.client_id}
                loadOptions={(query) => loadContactOptions(query, f.client_id)}
                onChange={(value, option) => {
                  const contact = option ? optionToContact(option) : null;
                  setSelectedContact(contact);
                  setF({
                    ...f,
                    requester_contact_id: value,
                    requester: contact ? contactName(contact) : "",
                  });
                }}
              />
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
        {f.ticket_type === "device" && (
          <>
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
          </>
        )}
        <Field label={f.ticket_type === "device" ? "Note" : "Descrizione problema"}>
          <textarea
            className={`pc-input ${f.ticket_type === "device" ? "min-h-[72px]" : "min-h-[132px]"}`}
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

type ClientOption = AsyncAutocompleteOption & { client: ClientOpt };
type ContactOption = AsyncAutocompleteOption & { contact: ContactOpt };
type DeviceOption = AsyncAutocompleteOption & { device: DeviceOpt };

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[,%]/g, "");
}

async function loadClientOptions(query: string): Promise<ClientOption[]> {
  let request = supabase.from("clients").select("id, name, company_name, email").order("name");
  const term = cleanSearchTerm(query);
  if (term) {
    request = request.or(`name.ilike.%${term}%,company_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data, error } = await request.range(0, 19);
  if (error) {
    toast.error(error.message);
    return [];
  }
  return ((data ?? []) as ClientOpt[]).map(clientOption);
}

async function fetchClientById(id: string): Promise<ClientOpt | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, company_name, email")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    toast.error(error.message);
    return null;
  }
  return (data as ClientOpt | null) ?? null;
}

async function loadContactOptions(query: string, clientId: string): Promise<ContactOption[]> {
  if (!clientId) return [];
  let request = supabase
    .from("client_contacts")
    .select("id, client_id, full_name, first_name, last_name, email, job_title, role, is_primary")
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  const term = cleanSearchTerm(query);
  if (term) {
    request = request.or(
      `full_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,job_title.ilike.%${term}%,role.ilike.%${term}%`,
    );
  }
  const { data, error } = await request.range(0, 19);
  if (error) {
    toast.error(error.message);
    return [];
  }
  return ((data ?? []) as ContactOpt[]).map(contactOption);
}

async function fetchContactById(id: string): Promise<ContactOpt | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from("client_contacts")
    .select("id, client_id, full_name, first_name, last_name, email, job_title, role, is_primary")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    toast.error(error.message);
    return null;
  }
  return (data as ContactOpt | null) ?? null;
}

async function loadDeviceOptions(query: string, clientId: string): Promise<DeviceOption[]> {
  if (!clientId) return [];
  let request = supabase
    .from("devices")
    .select("id, client_id, model, serial, os, assigned_to")
    .eq("client_id", clientId)
    .order("model");
  const term = cleanSearchTerm(query);
  if (term) {
    request = request.or(
      `model.ilike.%${term}%,serial.ilike.%${term}%,assigned_to.ilike.%${term}%`,
    );
  }
  const { data, error } = await request.range(0, 19);
  if (error) {
    toast.error(error.message);
    return [];
  }
  return ((data ?? []) as DeviceOpt[]).map(deviceOption);
}

async function fetchDeviceById(id: string): Promise<DeviceOpt | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from("devices")
    .select("id, client_id, model, serial, os, assigned_to")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    toast.error(error.message);
    return null;
  }
  return (data as DeviceOpt | null) ?? null;
}

function clientOption(client: ClientOpt): ClientOption {
  return {
    value: client.id,
    label: client.company_name || client.name,
    description: client.email,
    client,
  };
}

function contactOption(contact: ContactOpt): ContactOption {
  return {
    value: contact.id,
    label: contactName(contact),
    description: contact.email || contact.job_title || contact.role,
    contact,
  };
}

function deviceOption(device: DeviceOpt): DeviceOption {
  return {
    value: device.id,
    label: `${device.model}${device.serial ? ` - ${device.serial}` : ""}`,
    description: device.assigned_to || device.os,
    device,
  };
}

function optionToClient(option: AsyncAutocompleteOption): ClientOpt {
  return (option as ClientOption).client;
}

function optionToContact(option: AsyncAutocompleteOption): ContactOpt {
  return (option as ContactOption).contact;
}

function optionToDevice(option: AsyncAutocompleteOption): DeviceOpt {
  return (option as DeviceOption).device;
}
