import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  PRIORITY_LABEL,
  type TicketPriority,
  TICKET_TYPE_LABEL,
  type TicketType,
  DEFAULT_STRUCTURE,
  type ChecklistStructure,
} from "@/lib/pcready";
import activityQueries from "@/lib/queries/activity";
import {
  loadClientOptions,
  fetchClientById,
  loadContactOptions,
  fetchContactById,
  loadDeviceOptions,
  fetchDeviceById,
} from "@/lib/queries/tickets";
import { getInitialCreateTicketFormState } from "./createTicketFormState";
import { Modal } from "./Modal";
const insertActivity = activityQueries.insertActivity as any;
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/ui/form-field";
import { useTickets } from "@/hooks/use-tickets";
import { getPublicAppSettings, validateTechnicianDeviceLimit } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { sendTicketAssignedEmail } from "@/lib/email-events";
import { createNotification } from "@/lib/notifications";
import { formatServerFnErrorForToast } from "@/lib/server-fn-rate-limit-message";
import { createTicket } from "@/lib/tickets";
import { AsyncAutocomplete, type AsyncAutocompleteOption } from "./AsyncAutocomplete";
import type { Json } from "@/integrations/supabase/types";

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

type ClientOption = AsyncAutocompleteOption & { client: ClientOpt };
type ContactOption = AsyncAutocompleteOption & { contact: ContactOpt };
type DeviceOption = AsyncAutocompleteOption & { device: DeviceOpt };

async function loadClientAutocompleteOptions(query: string): Promise<ClientOption[]> {
  const rows = await loadClientOptions(query);
  return (rows ?? []).map((r: any) => {
    const client: ClientOpt = {
      id: r.id,
      name: r.name ?? "",
      company_name: r.company_name ?? null,
      email: r.email ?? null,
    };
    return {
      value: client.id,
      label: (client.company_name || client.name || "Cliente").trim() || "Cliente",
      description: client.email ?? undefined,
      client,
    };
  });
}

async function loadContactAutocompleteOptions(
  query: string,
  clientId: string,
): Promise<ContactOption[]> {
  const rows = await loadContactOptions(query, clientId);
  return (rows ?? []).map((r: any) => {
    const contact: ContactOpt = {
      id: r.id,
      client_id: r.client_id,
      full_name: r.full_name,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      job_title: r.job_title,
      role: r.role,
      is_primary: Boolean(r.is_primary),
    };
    return {
      value: contact.id,
      label: contactName(contact) || "Referente",
      description: contact.email || contact.job_title || contact.role || undefined,
      contact,
    };
  });
}

async function loadDeviceAutocompleteOptions(
  query: string,
  clientId: string,
): Promise<DeviceOption[]> {
  const rows = await loadDeviceOptions(query, clientId);
  return (rows ?? []).map((r: any) => {
    const device: DeviceOpt = {
      id: r.id,
      client_id: r.client_id,
      model: r.model,
      serial: r.serial,
      os: r.os,
      assigned_to: r.assigned_to,
    };
    return deviceOption(device);
  });
}

/**
 *
 */
export function CreateTicketModal() {
  const { t } = useTranslation("tickets");
  const { createOpen, closeCreate } = useTickets();
  const { user, canEdit, session } = useAuth();
  const notify = useServerFn(createNotification);
  const sendAssignedEmail = useServerFn(sendTicketAssignedEmail);
  const loadSettings = useServerFn(getPublicAppSettings);
  const validateLimit = useServerFn(validateTechnicianDeviceLimit);
  const createTicketFn = useServerFn(createTicket);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [templates, setTemplates] = useState<TplOpt[]>([]);
  const [ticketCategories, setTicketCategories] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOpt | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactOpt | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceOpt | null>(null);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlow>("existing");
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [templatePickerId, setTemplatePickerId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(getInitialCreateTicketFormState());

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
        setTemplateIds(def ? [def.id] : []);
        if (def) setTemplatePickerId(def.id);
      });
    if (session?.access_token) {
      loadSettings({ data: { accessToken: session.access_token } })
        .then((s) => setTicketCategories(s?.ticket_categories ?? []))
        .catch(() => setTicketCategories([]));
    } else {
      setTicketCategories([]);
    }
  }, [createOpen, loadSettings, session?.access_token]);

  async function submit() {
    if (!canEdit) return toast.error(t("createTicket.insufficientPermissions", "Permessi insufficienti"));
    if (!f.client_id || !f.requester) return toast.error(t("createTicket.fillRequired", "Compila i campi obbligatori"));
    if (f.ticket_type === "device" && !f.device_id) {
      return toast.error(t("createTicket.selectDeviceRequired", "Seleziona un dispositivo"));
    }
    if (!session?.access_token) return toast.error(t("createTicket.invalidSession", "Sessione non valida"));
    setBusy(true);
    try {
      const selectedTemplates = templates.filter((t) => templateIds.includes(t.id));
      const tpl = selectedTemplates[0];
      const structure = tpl?.structure || DEFAULT_STRUCTURE;
      const client =
        selectedClient?.id === f.client_id ? selectedClient : await fetchClientById(f.client_id);
      const device =
        deviceFlow === "existing"
          ? selectedDevice?.id === f.device_id
            ? selectedDevice
            : await fetchDeviceById(f.device_id)
          : null;
      if (!client) return toast.error(t("createTicket.selectClientRequired", "Seleziona un cliente"));
      const contact =
        selectedContact?.id === f.requester_contact_id
          ? selectedContact
          : await fetchContactById(f.requester_contact_id);
      const requester = f.free_requester ? f.requester.trim() : contact ? contactName(contact) : "";
      if (!requester) return toast.error(t("createTicket.selectRequesterRequired", "Seleziona un richiedente o usa il fallback libero"));
      const ticketInsert = {
        client: client.company_name || client.name,
        client_id: client.id,
        device_id: f.ticket_type === "device" ? device?.id || null : null,
        category: f.ticket_category || null,
        requester,
        requester_contact_id: f.free_requester ? null : contact?.id || null,
        priority: f.priority,
        ticket_type: f.ticket_type,
        status: "pending" as const,
        assignee_id: f.assignee_id || null,
        software: f.software || null,
        notes: f.notes || null,
        checklist: {},
        template_id: tpl?.id || null,
        checklist_template_ids: selectedTemplates.map((template) => template.id),
        checklist_structure: structure as unknown as Json,
      };
      const data = await createTicketFn({
        data: { accessToken: session.access_token, ticket: ticketInsert },
      });
      await insertActivity({
        type: "user",
        message: `${data.ticket_code} creato`,
        ticket_id: data.id,
        actor_id: user!.id,
      });
      const sectionAssignees = new Map<string, string[]>();
      selectedTemplates.forEach((template) => {
        const struct = template.structure || {};
        for (const group of Object.values(struct)) {
          const sections = (group as any).sections;
          if (!sections) continue;
          for (const section of Object.values(sections) as any[]) {
            if (section.assigned_to) {
              const labels = sectionAssignees.get(section.assigned_to) ?? [];
              labels.push(`${template.name}: ${section.label}`);
              sectionAssignees.set(section.assigned_to, labels);
            }
          }
        }
      });
      await Promise.all(
        Array.from(sectionAssignees.entries()).map(([userId, labels]) =>
          notify({
            data: {
              accessToken: session.access_token,
              notification: {
                userId,
                type: "checklist_section_assigned",
                title: `${data.ticket_code}: sezioni checklist assegnate`,
                body: labels.join(", "),
                payload: { ticket_id: data.id, ticket_code: data.ticket_code, sections: labels },
                link: "/tickets",
              },
            },
          }),
        ),
      );
      if (f.assignee_id && session?.access_token) {
        // Validate technician device limit for device tickets
        if (f.ticket_type === "device") {
          await validateLimit({ data: { assigneeId: f.assignee_id } }).catch((err) => {
            throw err instanceof Error ? err : new Error(t("createTicket.limitExceeded", "Limite tecnico superato"));
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
        void sendAssignedEmail({ data: { ticketId: data.id, assigneeId: f.assignee_id } }).catch(
          (err) => {
            console.error("Failed to send ticket assigned email:", err);
          },
        );
        if (assignee) toast.message(t("createTicket.notificationSentTo", "Notifica inviata a {{name}}", { name: assignee.full_name }));
      }
      toast.success(t("createTicket.created", "{{code}} creato", { code: data.ticket_code }));
      // Reset form state only after successful creation
      setF(getInitialCreateTicketFormState());
      setSelectedClient(null);
      setSelectedContact(null);
      setSelectedDevice(null);
      setDeviceFlow("existing");
      const def = templates.find((t) => t.is_default) || templates[0];
      setTemplateIds(def ? [def.id] : []);
      setTemplatePickerId(def?.id || "");
      closeCreate();
    } catch (e: unknown) {
      toast.error(formatServerFnErrorForToast(e, t("createTicket.createError", "Errore creazione")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={createOpen}
      onClose={closeCreate}
      title={t("createTicket.title", "Nuovo ticket PC")}
      size="lg"
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={closeCreate}>
            {t("createTicket.cancel", "Annulla")}
          </button>
          <button className="pc-btn pc-btn-primary" disabled={busy} onClick={submit}>
            {busy ? t("createTicket.creating", "Creazione...") : t("createTicket.create", "Crea ticket")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("createTicket.fieldClient", "Cliente *")}>
            <AsyncAutocomplete
              value={f.client_id}
              selectedOption={selectedClient ? clientOption(selectedClient) : null}
              placeholder={t("createTicket.clientPlaceholder", "Cerca cliente...")}
              emptyLabel={t("createTicket.clientEmpty", "Nessun cliente")}
              loadOptions={loadClientAutocompleteOptions}
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
          <Field label={t("createTicket.fieldCategory", "Categoria")}>
            <select
              className="pc-input"
              value={f.ticket_category}
              aria-label={t("createTicket.fieldCategory", "Categoria")}
              onChange={(e) => setF({ ...f, ticket_category: e.target.value })}
            >
              <option value="">{t("createTicket.noCategory", "— Nessuna —")}</option>
              {ticketCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("createTicket.fieldTicketType", "Tipo ticket")}>
            <select
              className="pc-input"
              value={f.ticket_type}
              aria-label={t("createTicket.fieldTicketType", "Tipo ticket")}
              onChange={(e) => {
                const ticketType = e.target.value as TicketType;
                setF({
                  ...f,
                  ticket_type: ticketType,
                  device_id: ticketType === "device" ? f.device_id : "",
                });
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
          <Field label={t("createTicket.fieldDevice", "Dispositivo *")}>
            <AsyncAutocomplete
              value={f.device_id}
              selectedOption={selectedDevice ? deviceOption(selectedDevice) : null}
              placeholder={f.client_id ? t("createTicket.devicePlaceholder", "Cerca dispositivo...") : t("createTicket.devicePlaceholderNoClient", "Seleziona prima un cliente")}
              emptyLabel={t("createTicket.deviceEmpty", "Nessun dispositivo")}
              disabled={!f.client_id}
              loadOptions={(query) => loadDeviceAutocompleteOptions(query, f.client_id)}
              onChange={(value, option) => {
                setSelectedDevice(option ? optionToDevice(option) : null);
                setF({ ...f, device_id: value });
              }}
            />
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("createTicket.fieldRequester", "Richiedente *")}>
            {f.free_requester ? (
              <input
                className="pc-input"
                value={f.requester}
                aria-label={t("createTicket.freeRequesterPlaceholder", "Nome richiedente non censito")}
                onChange={(e) => setF({ ...f, requester: e.target.value })}
                placeholder={t("createTicket.freeRequesterPlaceholder", "Nome richiedente non censito")}
              />
            ) : (
              <AsyncAutocomplete
                value={f.requester_contact_id}
                selectedOption={selectedContact ? contactOption(selectedContact) : null}
                placeholder={f.client_id ? t("createTicket.requesterPlaceholder", "Cerca referente...") : t("createTicket.requesterPlaceholderNoClient", "Seleziona prima un cliente")}
                emptyLabel={t("createTicket.requesterEmpty", "Nessun referente")}
                disabled={!f.client_id}
                loadOptions={(query) => loadContactAutocompleteOptions(query, f.client_id)}
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
              {t("createTicket.freeRequesterLabel", "Richiedente libero")}
            </label>
          </Field>
          <Field label={t("createTicket.fieldPriority", "Priorità")}>
            <select
              className="pc-input"
              value={f.priority}
              aria-label={t("createTicket.fieldPriority", "Priorità")}
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
          <Field label={t("createTicket.fieldAssignee", "Assegna a")}>
            <select
              className="pc-input"
              value={f.assignee_id}
              aria-label={t("createTicket.fieldAssignee", "Assegna a")}
              onChange={(e) => setF({ ...f, assignee_id: e.target.value })}
            >
              <option value="">{t("createTicket.noAssignee", "— Non assegnato —")}</option>
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
            <Field label={t("createTicket.fieldSoftware", "Software richiesti")}>
              <textarea
                className="pc-input min-h-[72px]"
                value={f.software}
                aria-label={t("createTicket.fieldSoftware", "Software richiesti")}
                onChange={(e) => setF({ ...f, software: e.target.value })}
                placeholder={t("createTicket.softwarePlaceholder", "Microsoft 365, Adobe CC, VS Code...")}
              />
            </Field>
            <Field label={t("createTicket.fieldChecklist", "Collega checklist")}>
              <div className="flex gap-2">                  <select
                  className="pc-input"
                  value={templatePickerId}
                  aria-label={t("createTicket.fieldChecklist", "Collega checklist")}
                  onChange={(e) => setTemplatePickerId(e.target.value)}
                >
                  {!templates.length && <option value="">{t("createTicket.noTemplate", "— Nessun template disponibile —")}</option>}
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.is_default ? t("createTicket.templateDefault", "  (predefinito)") : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="pc-btn pc-btn-ghost"
                  disabled={!templatePickerId || templateIds.includes(templatePickerId)}
                  onClick={() => setTemplateIds((ids) => [...ids, templatePickerId])}
                >
                  {t("createTicket.addChecklist", "Aggiungi")}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {templateIds.map((id) => {
                  const template = templates.find((item) => item.id === id);
                  if (!template) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]"
                      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                    >
                      {template.name}
                      <button
                        type="button"
                        className="text-text3 hover:text-danger"
                        onClick={() => setTemplateIds((ids) => ids.filter((item) => item !== id))}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                {!templateIds.length && (
                  <span className="text-[11px] text-text3">{t("createTicket.noChecklist", "Nessuna checklist collegata")}</span>
                )}
              </div>
            </Field>
          </>
        )}
        <Field label={f.ticket_type === "device" ? t("createTicket.fieldNotes", "Note") : t("createTicket.fieldProblemDesc", "Descrizione problema")}>
          <textarea
            className={`pc-input ${f.ticket_type === "device" ? "min-h-[72px]" : "min-h-[132px]"}`}
            value={f.notes}
            aria-label={f.ticket_type === "device" ? t("createTicket.fieldNotes", "Note") : t("createTicket.fieldProblemDesc", "Descrizione problema")}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}


function contactName(c: ContactOpt) {
  return c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ");
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
