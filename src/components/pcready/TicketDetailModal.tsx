import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "./Modal";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { openDeviceDetail, useTicketDetail } from "@/lib/use-detail";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import queries, { loadDeviceOptions } from "@/lib/queries/tickets";
import {
  type ChecklistState,
  STATUS_META,
  PRIORITY_LABEL,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  fmtDate,
  fmtDateTime,
  type ChecklistItemDef,
  type ChecklistStructure,
  DEFAULT_STRUCTURE,
  structureProgress,
  structureOverallProgress,
  computeSlaStatus,
  formatSlaCountdown,
} from "@/lib/pcready";
import { AssigneeChip, PriorityLabel, StatusBadge, TicketTypeBadge } from "./StatusBadge";
import { createNotification } from "@/lib/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queries/keys";
import {
  Archive,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  GitBranch,
  History,
  Link as LinkIcon,
  ListChecks,
  Paperclip,
  Printer,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TicketNotes } from "@/components/tickets/TicketNotes";
import { TicketAttachments } from "@/components/tickets/TicketAttachments";
import { TicketRelations } from "@/components/tickets/TicketRelations";
import { TicketTimeTracking } from "@/components/tickets/TicketTimeTracking";
import { sendChecklistCompletedEmail } from "@/lib/email-events";
import activityQueries from "@/lib/queries/activity";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { parseChecklistStructure } from "@/types/checklist-structure";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { formatDuration, useTicketTimeSummary } from "@/lib/queries/ticketTimeEntries";
import checklistQueries, { type TicketChecklistInstanceRow } from "@/lib/queries/checklist";

interface TicketRow {
  id: string;
  ticket_code: string;
  client: string;
  client_id: string | null;
  requester: string;
  ticket_type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id: string | null;
  software: string | null;
  notes: string | null;
  checklist: ChecklistState;
  created_at: string;
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  sla_response_at?: string | null;
  billable_hours?: number | null;
  hourly_rate?: number | null;
  material_cost?: number | null;
  labor_cost?: number | null;
  total_cost?: number | null;
  cost_notes?: string | null;
  cost_currency?: string | null;
  device_id: string | null;
  model?: string | null;
  checklist_structure?: ChecklistStructure | null;
  device?: {
    id: string;
    model: string;
    serial: string | null;
    os: string | null;
    assigned_to: string | null;
    status: string;
  } | null;
  assignee?: { full_name: string; initials: string } | null;
}

interface AssignmentRow {
  id: string;
  assigned_at: string;
  unassigned_at: string | null;
  notes: string | null;
  device?: { id?: string; model: string; serial: string | null } | null;
}

type DetailTab = "detail" | "checklists" | "notes" | "history" | "attachments";

const DETAIL_TABS: { key: DetailTab; label: string; icon: typeof ListChecks }[] = [
  { key: "detail", label: "Dettaglio", icon: ListChecks },
  { key: "checklists", label: "Checklist", icon: CheckCircle2 },
  { key: "notes", label: "Note", icon: GitBranch },
  { key: "history", label: "Storico", icon: History },
  { key: "attachments", label: "Allegati", icon: Paperclip },
];

export function TicketDetailModal() {
  const { id, close } = useTicketDetail();
  const { canEdit, user, session, isAdmin } = useAuth();
  const notify = useServerFn(createNotification);
  const sendChecklistEmail = useServerFn(sendChecklistCompletedEmail);
  const loadTechnicians = useServerFn(listTechnicians);
  useTickets();

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [mainTab, setMainTab] = useState<DetailTab>("detail");
  const [checklistTab, setChecklistTab] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceOptions, setDeviceOptions] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [checklistTemplateToAttach, setChecklistTemplateToAttach] = useState("");
  const [costDraft, setCostDraft] = useState({
    billable_hours: "0",
    hourly_rate: "0",
    material_cost: "0",
    cost_notes: "",
  });

  const {
    useTicketQuery,
    useTicketAssignmentsQuery,
    useTicketHistoryQuery,
    useTicketStatusHistoryQuery,
    useUpdateTicket,
    useDeleteTicket,
  } = queries as any;
  const ticketQuery = useTicketQuery(id);
  const assignmentsQuery = useTicketAssignmentsQuery(id);
  const deviceHistoryQuery = useTicketHistoryQuery(id);
  const statusHistoryQuery = useTicketStatusHistoryQuery(id);
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const insertActivity = activityQueries.insertActivity as any;
  const addTicketStatusHistory = (queries as any).addTicketStatusHistory as any;
  const qc = useQueryClient();
  const timeSummaryQuery = useTicketTimeSummary(id, user?.id);
  const checklistTemplatesQuery = (checklistQueries as any).useChecklistTemplates();
  const checklistInstancesQuery = (checklistQueries as any).useTicketChecklistInstances(id);
  const createChecklistInstance = (checklistQueries as any).useCreateTicketChecklistInstance();
  const upsertChecklistResponse = (checklistQueries as any).useUpsertTicketChecklistResponse(
    id || "",
  );
  const completeChecklistInstance = (checklistQueries as any).useCompleteTicketChecklistInstance(
    id || "",
  );

  useEffect(() => {
    if (assignmentsQuery.data) setAssignments(assignmentsQuery.data as AssignmentRow[]);
  }, [assignmentsQuery.data]);

  useEffect(() => {
    const ticket = ticketQuery.data as TicketRow | null | undefined;
    if (ticket) {
      setTitleDraft(ticket.model || ticket.device?.model || ticket.ticket_code);
      setCostDraft({
        billable_hours: String(ticket.billable_hours ?? 0),
        hourly_rate: String(ticket.hourly_rate ?? 0),
        material_cost: String(ticket.material_cost ?? 0),
        cost_notes: ticket.cost_notes ?? "",
      });
    }
  }, [ticketQuery.data]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }, [session?.access_token, loadTechnicians]);

  useEffect(() => {
    const ticket = ticketQuery.data as TicketRow | null | undefined;
    if (!ticket?.client_id || !deviceSearch.trim()) {
      setDeviceOptions([]);
      return;
    }
    let cancelled = false;
    setDeviceLoading(true);
    loadDeviceOptions(deviceSearch, ticket.client_id)
      .then((rows) => {
        if (!cancelled) setDeviceOptions(rows.filter((device) => device.id !== ticket.device_id));
      })
      .catch(() => {
        if (!cancelled) setDeviceOptions([]);
      })
      .finally(() => {
        if (!cancelled) setDeviceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceSearch, ticketQuery.data]);

  if (!id || ticketQuery.isLoading || !ticketQuery.data) return null;
  const ticket = ticketQuery.data as TicketRow;
  const struct: ChecklistStructure =
    ticket.checklist_structure && Object.keys(ticket.checklist_structure).length
      ? parseChecklistStructure(ticket.checklist_structure)
      : DEFAULT_STRUCTURE;
  const tabKeys = Object.keys(struct);
  const currentChecklistTab = checklistTab && struct[checklistTab] ? checklistTab : tabKeys[0];
  const asset = assetInfo(ticket);
  const meta = STATUS_META[ticket.status];
  const overallProgress = structureOverallProgress(ticket.checklist || {}, struct);
  const openedAgo = formatRelativeTime(ticket.created_at);
  const sla = computeSlaStatus(
    ticket.created_at,
    ticket.priority,
    undefined,
    ticket.due_date || ticket.sla_deadline,
    ticket.sla_breached,
  );
  const statusHistory = (statusHistoryQuery.data ?? []) as any[];
  const deviceHistory = (deviceHistoryQuery.data ?? []) as any[];
  const timeline = buildTimeline(statusHistory, deviceHistory, assignments);
  const totalWorked = formatDuration(timeSummaryQuery.data?.totalMinutes ?? 0);

  async function update(patch: Partial<TicketRow> & { checklist?: ChecklistState }) {
    const dbPatch: TablesUpdate<"tickets"> = {
      ...patch,
      checklist: patch.checklist as unknown as Json | undefined,
    } as any;
    try {
      await updateTicket.mutateAsync({ id: ticket.id, patch: dbPatch });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore aggiornamento";
      toast.error(message);
      throw err;
    }
  }

  async function saveCosts() {
    if (!canEdit) return;
    const patch = {
      billable_hours: parseCostNumber(costDraft.billable_hours),
      hourly_rate: parseCostNumber(costDraft.hourly_rate),
      material_cost: parseCostNumber(costDraft.material_cost),
      cost_notes: costDraft.cost_notes.trim() || null,
    };
    await update(patch as any);
    toast.success("Costi ticket aggiornati");
  }

  function useTrackedHoursAsBillable() {
    const hours = ((timeSummaryQuery.data?.totalMinutes ?? 0) / 60).toFixed(2);
    setCostDraft((current) => ({ ...current, billable_hours: hours }));
  }

  async function saveTitle() {
    if (!canEdit) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) return toast.error("Il titolo non puo' essere vuoto");
    await update({ model: nextTitle } as any);
    setEditingTitle(false);
    toast.success("Titolo aggiornato");
  }

  async function toggleItem(itemId: string) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const cur = { ...(ticket.checklist || {}) } as ChecklistState;
    cur[currentChecklistTab] = {
      ...(cur[currentChecklistTab] || {}),
      [itemId]: !cur[currentChecklistTab]?.[itemId],
    };
    await update({ checklist: cur });
    const prog = structureProgress(cur, struct, currentChecklistTab);
    if (prog.pct === 100) {
      if (ticket.assignee_id && session?.access_token) {
        await notify({
          data: {
            accessToken: session.access_token,
            notification: {
              userId: ticket.assignee_id,
              type: "checklist_completed",
              title: `${ticket.ticket_code}: checklist completata`,
              body: struct[currentChecklistTab]?.label || "Sezione checklist completata",
              payload: { ticket_id: ticket.id, checklist_key: currentChecklistTab },
              link: "/tickets",
            },
          },
        });
      }
      void sendChecklistEmail({
        data: {
          ticketId: ticket.id,
          checklistName: struct[currentChecklistTab]?.label || "Checklist completata",
        },
      }).catch((err) => console.error("Failed to send checklist completed email:", err));
      if (currentChecklistTab === "os" && ticket.status === "pending")
        await advance("in-progress", true);
      if (currentChecklistTab === "software" && ticket.status === "in-progress")
        await advance("testing", true);
    }
  }

  async function advance(next: TicketStatus, auto = false) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const previousStatus = ticket.status;
    await update({ status: next });
    try {
      await addTicketStatusHistory(ticket.id, {
        from_status: previousStatus,
        to_status: next,
        changed_by: user!.id,
        changed_at: new Date().toISOString(),
        note: auto ? "Avanzamento automatico via checklist" : null,
      });
      await insertActivity({
        type: auto ? "auto" : "user",
        message: `${ticket.ticket_code}: stato -> "${STATUS_META[next].label}"${auto ? " automaticamente" : ""}`,
        ticket_id: ticket.id,
        actor_id: user!.id,
      });
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticket.id), "status-history"] });
    } catch (err) {
      console.error("Failed to write status history/activity log", err);
    }
    if (ticket.assignee_id && session?.access_token) {
      await notify({
        data: {
          accessToken: session.access_token,
          notification: {
            userId: ticket.assignee_id,
            type: "ticket_status_changed",
            title: `${ticket.ticket_code}: ${STATUS_META[next].label}`,
            body: auto ? "Stato avanzato automaticamente" : "Stato aggiornato manualmente",
            payload: { ticket_id: ticket.id, status: next },
            link: "/tickets",
          },
        },
      });
    }
    toast.success(`Stato aggiornato: ${STATUS_META[next].label}`);

    if (next === "completed" && session?.access_token) {
      const { completeTicketServer } = await import("@/lib/ticket-completion");
      void completeTicketServer({
        data: { ticketId: ticket.id, changedBy: user!.id, accessToken: session.access_token },
      }).catch((err) => {
        console.error("Failed to complete ticket:", err);
        toast.error("Ticket completato, ma errore invio email/verbale");
      });
    }
  }

  async function changeAssignee(nextAssigneeId: string) {
    await update({ assignee_id: nextAssigneeId || null } as any);
    toast.success(nextAssigneeId ? "Tecnico riassegnato" : "Assegnazione rimossa");
  }

  async function changeDevice(nextDeviceId: string | null) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    await update({ device_id: nextDeviceId } as any);
    setDeviceSearch("");
    toast.success(nextDeviceId ? "Dispositivo collegato" : "Dispositivo scollegato");
  }

  async function attachChecklistTemplate() {
    if (!canEdit || !user) return toast.error("Permessi insufficienti");
    if (!checklistTemplateToAttach) return toast.error("Seleziona un template checklist");
    const template = (checklistTemplatesQuery.data ?? []).find(
      (item: any) => item.id === checklistTemplateToAttach,
    );
    try {
      const instance = await createChecklistInstance.mutateAsync({
        ticketId: ticket.id,
        templateId: checklistTemplateToAttach,
        assignedTo: ticket.assignee_id,
      });
      await insertActivity({
        type: "user",
        message: `${ticket.ticket_code}: checklist "${instance.title}" collegata`,
        ticket_id: ticket.id,
        actor_id: user.id,
      });
      const sectionAssignees = new Map<string, string[]>();
      Object.values(template?.structure || instance.structure || {}).forEach((section: any) => {
        const assignedTo = section.assigned_to || instance.section_assignments?.[section.key];
        if (assignedTo) {
          const labels = sectionAssignees.get(assignedTo) ?? [];
          labels.push(`${instance.title}: ${section.label}`);
          sectionAssignees.set(assignedTo, labels);
        }
      });
      if (session?.access_token) {
        await Promise.all(
          Array.from(sectionAssignees.entries()).map(([userId, labels]) =>
            notify({
              data: {
                accessToken: session.access_token,
                notification: {
                  userId,
                  type: "checklist_section_assigned",
                  title: `${ticket.ticket_code}: sezioni checklist assegnate`,
                  body: labels.join(", "),
                  payload: { ticket_id: ticket.id, checklist_instance_id: instance.id },
                  link: "/tickets",
                },
              },
            }),
          ),
        );
      }
      setChecklistTemplateToAttach("");
      toast.success("Checklist collegata al ticket");
    } catch (err: any) {
      toast.error(err?.message || "Errore collegamento checklist");
    }
  }

  async function saveChecklistResponse(
    instance: TicketChecklistInstanceRow,
    sectionKey: string,
    itemId: string,
    value: string | null,
  ) {
    if (!canEdit || !user) return toast.error("Permessi insufficienti");
    if (instance.status === "completed") return toast.error("Checklist gia' completata");
    const assignedTo =
      instance.section_assignments?.[sectionKey] || instance.structure[sectionKey]?.assigned_to;
    if (assignedTo && assignedTo !== user.id && !isAdmin) {
      return toast.error("Questa sezione e' assegnata a un altro tecnico");
    }
    try {
      await upsertChecklistResponse.mutateAsync({
        instanceId: instance.id,
        itemKey: `${sectionKey}:${itemId}`,
        value,
        compiledBy: user.id,
      });
    } catch (err: any) {
      toast.error(err?.message || "Errore salvataggio risposta");
    }
  }

  async function completeChecklist(instance: TicketChecklistInstanceRow) {
    if (!canEdit || !user) return toast.error("Permessi insufficienti");
    const progress = computeInstanceProgress(instance);
    if (progress.requiredMissing > 0) {
      return toast.error(`Compila prima ${progress.requiredMissing} elementi obbligatori`);
    }
    if (!window.confirm("Confermo di aver verificato tutti gli elementi della checklist.")) return;
    const signatureName =
      window.prompt("Firma opzionale: nome da mostrare nel report PDF", "") || null;
    try {
      const completed = await completeChecklistInstance.mutateAsync({
        instanceId: instance.id,
        completedBy: user.id,
        signatureName,
      });
      await insertActivity({
        type: "user",
        message: `${ticket.ticket_code}: checklist "${completed.title}" completata`,
        ticket_id: ticket.id,
        actor_id: user.id,
        entity_type: "ticket_checklist_instance",
        entity_id: completed.id,
      });
      if (ticket.assignee_id && session?.access_token) {
        await notify({
          data: {
            accessToken: session.access_token,
            notification: {
              userId: ticket.assignee_id,
              type: "checklist_completed",
              title: `${ticket.ticket_code}: checklist completata`,
              body: completed.title,
              payload: { ticket_id: ticket.id, checklist_instance_id: completed.id },
              link: "/tickets",
            },
          },
        });
      }
      void sendChecklistEmail({
        data: { ticketId: ticket.id, checklistName: completed.title },
      }).catch((err) => console.error("Failed to send checklist completed email:", err));
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticket.id), "status-history"] });
      toast.success("Checklist completata");
    } catch (err: any) {
      toast.error(err?.message || "Errore completamento checklist");
    }
  }

  async function duplicateTicket() {
    try {
      const payload = {
        client: ticket.client,
        client_id: ticket.client_id,
        requester: ticket.requester,
        ticket_type: ticket.ticket_type,
        priority: ticket.priority,
        status: "pending",
        assignee_id: ticket.assignee_id,
        software: ticket.software,
        notes: ticket.notes,
        checklist: {},
        checklist_structure: ticket.checklist_structure as any,
        device_id: ticket.device_id,
        model: ticket.model,
      };
      const { data, error } = await (supabase as any)
        .from("tickets")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Ticket duplicato");
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tickets });
      if (data?.id) close();
    } catch (err: any) {
      toast.error(err?.message || "Errore duplicazione ticket");
    }
  }

  async function del() {
    try {
      await deleteTicket.mutateAsync(ticket.id);
      toast.success("Ticket eliminato");
      close();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore cancellazione";
      toast.error(message);
    }
  }

  return (
    <Modal
      open={true}
      onClose={close}
      size="xl"
      title={`${ticket.ticket_code} - ${titleDraft || asset.model}`}
      footer={
        <>
          {canEdit && (
            <button
              className="pc-btn pc-btn-danger pc-btn-sm mr-auto"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3 h-3" /> Elimina
            </button>
          )}
          <button className="pc-btn pc-btn-ghost" onClick={close}>
            Chiudi
          </button>
          {canEdit && meta.next && (
            <button className="pc-btn pc-btn-primary" onClick={() => advance(meta.next!)}>
              Avanza {"->"} {STATUS_META[meta.next].label}
            </button>
          )}
        </>
      }
    >
      <div
        className="sticky top-0 z-10 -mx-[22px] -mt-[20px] mb-4 border-b bg-surface px-[22px] py-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] font-bold text-accent">
                {ticket.ticket_code}
              </span>
              <span className="text-[11px] text-text3">Aperto {openedAgo}</span>
              <span className="text-[11px] text-text3">Ore lavorate: {totalWorked}</span>
            </div>
            {editingTitle ? (
              <div className="flex gap-2">
                <input
                  className="pc-input w-full text-[18px] font-bold"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void saveTitle()}
                />
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={saveTitle}>
                  Salva
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="block max-w-full truncate text-left text-[20px] font-bold hover:text-accent"
                onClick={() => canEdit && setEditingTitle(true)}
              >
                {titleDraft || asset.model}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit ? (
              <select
                className="pc-input h-8 min-w-[120px] w-auto px-3 py-0 text-[12px] leading-none"
                value={ticket.status}
                onChange={(event) => advance(event.target.value as TicketStatus)}
              >
                {Object.entries(STATUS_META).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={ticket.status} />
            )}
            <PriorityLabel p={ticket.priority} />
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => advance("completed")}
              disabled={!canEdit || ticket.status === "completed"}
            >
              <CheckCircle2 className="h-3 w-3" /> Chiudi ticket
            </button>
            <select
              className="pc-input h-8 min-w-[150px] w-auto px-3 py-0 text-[12px] leading-none"
              value={ticket.assignee_id ?? ""}
              disabled={!canEdit}
              onChange={(event) => changeAssignee(event.target.value)}
            >
              <option value="">Riassegna...</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
            </select>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={duplicateTicket}
              disabled={!canEdit}
            >
              <Copy className="h-3 w-3" /> Duplica
            </button>
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => window.print()}>
              <Printer className="h-3 w-3" /> Esporta PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Metric label="Stato" value={<StatusBadge status={ticket.status} />} />
        <Metric label="Priorita" value={PRIORITY_LABEL[ticket.priority]} />
        <Metric
          label="Checklist"
          value={`${overallProgress.done}/${overallProgress.total}`}
          hint={`${overallProgress.pct}%`}
        />
        <Metric
          label="SLA"
          value={
            sla.status === "overdue" ? "Violato" : sla.status === "warning" ? "In scadenza" : "OK"
          }
          hint={formatSlaCountdown(sla.deadline)}
        />
      </div>

      <div className="mb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap gap-1">
          {DETAIL_TABS.map(({ key, label, icon: Icon }) => {
            const active = mainTab === key;
            return (
              <button
                key={key}
                onClick={() => setMainTab(key)}
                className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold transition-colors -mb-px border-b-2"
                style={{
                  color: active ? "var(--accent)" : "var(--text3)",
                  borderColor: active ? "var(--accent)" : "transparent",
                }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {mainTab === "detail" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.4fr_.9fr]">
            <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="mb-3 text-[13px] font-bold">Informazioni ticket</h3>
              <div className="grid grid-cols-2 gap-3">
                <Info
                  label="Descrizione"
                  value={<span className="whitespace-pre-line">{ticket.notes || "-"}</span>}
                />
                <Info label="Tipo" value={<TicketTypeBadge type={ticket.ticket_type} />} />
                <Info label="Cliente" value={ticket.client} />
                <Info label="Richiedente" value={ticket.requester} />
                <Info label="Data apertura" value={fmtDate(ticket.created_at)} />
                <Info label="Prima risposta" value={fmtDateTime(ticket.sla_response_at)} />
                <Info
                  label="Software"
                  value={<span className="text-xs">{ticket.software || "-"}</span>}
                />
              </div>
            </section>
            <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="mb-3 text-[13px] font-bold">Tecnico e azioni</h3>
              <div className="mb-3 rounded-lg p-3" style={{ background: "var(--surface2)" }}>
                <AssigneeChip
                  initials={ticket.assignee?.initials}
                  name={ticket.assignee?.full_name}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="pc-btn pc-btn-primary pc-btn-sm"
                  onClick={() => setMainTab("notes")}
                >
                  <GitBranch className="h-3 w-3" /> Aggiungi nota
                </button>
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={() => setMainTab("attachments")}
                >
                  <Paperclip className="h-3 w-3" /> Carica allegato
                </button>
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={() => setMainTab("history")}
                >
                  <History className="h-3 w-3" /> Vedi storico
                </button>
              </div>
            </section>
          </div>

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-bold">Dispositivi collegati</h3>
              <span className="text-[11px] text-text3">
                {ticket.device_id ? "1 dispositivo attivo" : "Nessun dispositivo"}
              </span>
            </div>
            {ticket.device_id && (
              <div
                className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  className="font-semibold text-accent hover:underline"
                  onClick={() => ticket.device_id && openDeviceDetail(ticket.device_id)}
                >
                  {asset.model}
                </button>
                <span className="font-mono text-[11px] text-text3">{asset.serial}</span>
                <span className="text-[11px] text-text3">{asset.os}</span>
                {canEdit && (
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm ml-auto"
                    onClick={() => changeDevice(null)}
                  >
                    <X className="h-3 w-3" /> Scollega
                  </button>
                )}
              </div>
            )}
            {canEdit && (
              <div className="relative">
                <input
                  className="pc-input w-full"
                  value={deviceSearch}
                  onChange={(event) => setDeviceSearch(event.target.value)}
                  placeholder="Collega dispositivo: cerca per nome, seriale o assegnatario..."
                />
                {deviceSearch && (
                  <div
                    className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {deviceLoading && <div className="p-3 text-[12px] text-text3">Ricerca...</div>}
                    {!deviceLoading && deviceOptions.length === 0 && (
                      <div className="p-3 text-[12px] text-text3">Nessun dispositivo trovato</div>
                    )}
                    {deviceOptions.map((device) => (
                      <button
                        key={device.id}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-surface2"
                        onClick={() => changeDevice(device.id)}
                      >
                        <span>
                          <span className="font-semibold">{device.model}</span>{" "}
                          <span className="font-mono text-text3">{device.serial || "-"}</span>
                        </span>
                        <LinkIcon className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <TicketRelations ticketId={ticket.id} />

          <TicketTimeTracking ticketId={ticket.id} />

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">Costi e fatturazione</h3>
                <p className="text-[11px] text-text3">
                  Manodopera: {formatMoney(ticket.labor_cost)} · Materiali:{" "}
                  {formatMoney(ticket.material_cost)} · Totale: {formatMoney(ticket.total_cost)}
                </p>
              </div>
              {canEdit && (
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={saveCosts}>
                  Salva costi
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-[12px] font-semibold text-text2">
                Ore fatturabili
                <input
                  className="pc-input mt-1"
                  type="number"
                  min="0"
                  step="0.25"
                  disabled={!canEdit}
                  value={costDraft.billable_hours}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, billable_hours: event.target.value }))
                  }
                />
              </label>
              <label className="text-[12px] font-semibold text-text2">
                Tariffa oraria
                <input
                  className="pc-input mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  value={costDraft.hourly_rate}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, hourly_rate: event.target.value }))
                  }
                />
              </label>
              <label className="text-[12px] font-semibold text-text2">
                Materiali / ricambi
                <input
                  className="pc-input mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  value={costDraft.material_cost}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, material_cost: event.target.value }))
                  }
                />
              </label>
              <div className="rounded-lg bg-surface2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
                  Totale stimato
                </div>
                <div className="mt-1 text-lg font-bold">
                  {formatMoney(
                    parseCostNumber(costDraft.billable_hours) *
                      parseCostNumber(costDraft.hourly_rate) +
                      parseCostNumber(costDraft.material_cost),
                  )}
                </div>
                <button
                  className="mt-2 text-[11px] font-semibold text-accent"
                  disabled={!canEdit}
                  onClick={useTrackedHoursAsBillable}
                >
                  Usa ore tracciate ({totalWorked})
                </button>
              </div>
            </div>
            <label className="mt-3 block text-[12px] font-semibold text-text2">
              Note costi
              <textarea
                className="pc-input mt-1 min-h-[70px]"
                disabled={!canEdit}
                value={costDraft.cost_notes}
                onChange={(event) =>
                  setCostDraft((current) => ({ ...current, cost_notes: event.target.value }))
                }
                placeholder="Dettagli materiali, ricambi, accordi di fatturazione..."
              />
            </label>
          </section>

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">Checklist inline</h3>
                <p className="text-[11px] text-text3">
                  {overallProgress.done}/{overallProgress.total} elementi completati
                </p>
              </div>
              <div
                className="h-2 w-44 overflow-hidden rounded-full"
                style={{ background: "var(--surface2)" }}
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${overallProgress.pct}%` }}
                />
              </div>
            </div>
            <div
              className="mb-3 flex flex-wrap gap-1 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              {tabKeys.map((key) => {
                const p = structureProgress(ticket.checklist || {}, struct, key);
                const on = currentChecklistTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setChecklistTab(key)}
                    className="px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px"
                    style={{
                      color: on ? "var(--accent)" : "var(--text3)",
                      borderColor: on ? "var(--accent)" : "transparent",
                    }}
                  >
                    {struct[key].label}{" "}
                    <span className="font-mono text-[10px] opacity-70">
                      {p.done}/{p.total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              {(struct[currentChecklistTab]?.items || []).map((item) => {
                const done = ticket.checklist?.[currentChecklistTab]?.[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="flex items-center gap-2.5 rounded-[7px] px-3 py-2 text-left text-[13px] transition-all"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      color: done ? "var(--text3)" : "var(--text)",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    <span
                      className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded"
                      style={{
                        background: done ? "var(--success)" : "transparent",
                        border: "1.5px solid " + (done ? "var(--success)" : "var(--border2)"),
                      }}
                    >
                      {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    {item.text}
                  </button>
                );
              })}
              {!struct[currentChecklistTab]?.items?.length && (
                <div className="py-6 text-center text-[12px] text-text3">
                  Nessuna voce in questa sezione
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {mainTab === "checklists" && (
        <TicketChecklistPanel
          ticket={ticket}
          instances={(checklistInstancesQuery.data ?? []) as TicketChecklistInstanceRow[]}
          instancesLoading={checklistInstancesQuery.isLoading}
          templates={(checklistTemplatesQuery.data ?? []) as any[]}
          selectedTemplateId={checklistTemplateToAttach}
          onSelectedTemplateIdChange={setChecklistTemplateToAttach}
          onAttachTemplate={attachChecklistTemplate}
          onSaveResponse={saveChecklistResponse}
          onComplete={completeChecklist}
          technicians={technicians}
          currentUserId={user?.id ?? null}
          canEdit={canEdit}
          isAdmin={isAdmin}
        />
      )}

      {mainTab === "notes" && (
        <TicketNotes
          ticketId={ticket.id}
          onChanged={() => {
            qc.invalidateQueries(QUERY_KEYS.ticket(ticket.id) as any);
            qc.invalidateQueries(QUERY_KEYS.tickets as any);
          }}
        />
      )}
      {mainTab === "history" && (
        <TicketHistory
          timeline={timeline}
          loading={statusHistoryQuery.isLoading || deviceHistoryQuery.isLoading}
        />
      )}
      {mainTab === "attachments" && <TicketAttachments ticketId={ticket.id} />}

      <DestructiveConfirmDialog
        open={deleteOpen}
        title="Eliminare questo ticket?"
        description={`Il ticket ${ticket.ticket_code} verra' rimosso definitivamente. L'azione non puo' essere annullata.`}
        confirmLabel="Elimina ticket"
        loadingLabel="Eliminazione..."
        onOpenChange={setDeleteOpen}
        onConfirm={del}
      />
    </Modal>
  );
}

function TicketChecklistPanel({
  ticket,
  instances,
  instancesLoading,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  onAttachTemplate,
  onSaveResponse,
  onComplete,
  technicians,
  currentUserId,
  canEdit,
  isAdmin,
}: {
  ticket: TicketRow;
  instances: TicketChecklistInstanceRow[];
  instancesLoading: boolean;
  templates: Array<{ id: string; name: string; is_default?: boolean }>;
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (value: string) => void;
  onAttachTemplate: () => void;
  onSaveResponse: (
    instance: TicketChecklistInstanceRow,
    sectionKey: string,
    itemId: string,
    value: string | null,
  ) => void;
  onComplete: (instance: TicketChecklistInstanceRow) => void;
  technicians: TechnicianOption[];
  currentUserId: string | null;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold">Checklist collegate</h3>
            <p className="text-[11px] text-text3">
              Le checklist vengono istanziate come snapshot indipendente dal template.
            </p>
          </div>
          {canEdit && (
            <div className="flex min-w-[320px] flex-1 justify-end gap-2">
              <select
                className="pc-input max-w-[320px] text-[12px]"
                value={selectedTemplateId}
                onChange={(event) => onSelectedTemplateIdChange(event.target.value)}
              >
                <option value="">— Collega checklist —</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default ? " (predefinito)" : ""}
                  </option>
                ))}
              </select>
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                disabled={!selectedTemplateId}
                onClick={onAttachTemplate}
              >
                Collega
              </button>
            </div>
          )}
        </div>
        {instancesLoading && <div className="text-[12px] text-text3">Caricamento checklist...</div>}
        {!instancesLoading && !instances.length && (
          <div
            className="rounded-lg border p-6 text-center text-[12px] text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            Nessuna checklist collegata a questo ticket.
          </div>
        )}
        <div className="space-y-3">
          {instances.map((instance) => {
            const progress = computeInstanceProgress(instance);
            return (
              <div
                key={instance.id}
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-bold">{instance.title}</h4>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background:
                            instance.status === "completed" ? "var(--success)" : "var(--surface2)",
                          color: instance.status === "completed" ? "white" : "var(--text3)",
                        }}
                      >
                        {instance.status === "completed"
                          ? "Completata"
                          : instance.status === "in_progress"
                            ? "In corso"
                            : "Da compilare"}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-text3">
                      Ticket {ticket.ticket_code} · {progress.done}/{progress.total} elementi ·{" "}
                      {progress.pct}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-40 overflow-hidden rounded-full"
                      style={{ background: "var(--surface2)" }}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <button
                      className="pc-btn pc-btn-ghost pc-btn-sm"
                      onClick={() => window.print()}
                    >
                      <Printer className="h-3 w-3" /> Esporta PDF
                    </button>
                    {canEdit && instance.status !== "completed" && (
                      <button
                        className="pc-btn pc-btn-primary pc-btn-sm"
                        disabled={progress.requiredMissing > 0}
                        title={
                          progress.requiredMissing > 0
                            ? "Compila prima tutti gli elementi obbligatori"
                            : "Completa checklist"
                        }
                        onClick={() => onComplete(instance)}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Completa checklist
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(instance.structure).map(([sectionKey, section]) => {
                    const assignedTo =
                      instance.section_assignments?.[sectionKey] || section.assigned_to || null;
                    const assignedTech = technicians.find((tech) => tech.id === assignedTo);
                    const sectionLocked = !!assignedTo && assignedTo !== currentUserId && !isAdmin;
                    const responses = responseMap(instance.responses);
                    return (
                      <div
                        key={sectionKey}
                        className="rounded-lg border p-3"
                        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[12.5px] font-bold">{section.label}</div>
                            <div className="text-[11px] text-text3">
                              {assignedTech
                                ? `Assegnata a ${assignedTech.full_name}`
                                : "Nessun tecnico specifico"}
                              {sectionLocked ? " · sola lettura per te" : ""}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {section.items.map((item) => {
                            const key = `${sectionKey}:${item.id}`;
                            const response = responses.get(key);
                            const disabled =
                              !canEdit || sectionLocked || instance.status === "completed";
                            return (
                              <ChecklistResponseInput
                                key={item.id}
                                item={item}
                                value={response?.value ?? ""}
                                response={response}
                                disabled={disabled}
                                compiledByLabel={
                                  technicians.find((tech) => tech.id === response?.compiled_by)
                                    ?.full_name
                                }
                                onSave={(value) =>
                                  onSaveResponse(instance, sectionKey, item.id, value)
                                }
                              />
                            );
                          })}
                          {!section.items.length && (
                            <div className="text-[12px] text-text3">
                              Nessuna voce in questa sezione
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {instance.status === "completed" && (
                  <div
                    className="mt-3 rounded-lg border p-2 text-[11px] text-text3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Completata {fmtDateTime(instance.completed_at)}
                    {instance.signature_name ? ` · Firma: ${instance.signature_name}` : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChecklistResponseInput({
  item,
  value,
  response,
  disabled,
  compiledByLabel,
  onSave,
}: {
  item: ChecklistItemDef;
  value: string;
  response?: TicketChecklistInstanceRow["responses"][number];
  disabled: boolean;
  compiledByLabel?: string;
  onSave: (value: string | null) => void;
}) {
  const itemType = item.type || "checkbox";
  const done = isResponseComplete(item, value);
  const commonMeta = response ? (
    <span className="text-[10.5px] text-text3">
      salvato da {compiledByLabel || response.compiled_by || "utente"} ·{" "}
      {fmtDateTime(response.compiled_at)}
    </span>
  ) : null;

  if (itemType === "text" || itemType === "number") {
    return (
      <label
        className="block rounded-md border bg-background p-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-semibold">
            {item.text} {item.required && <span className="text-red-500">*</span>}
          </span>
          {commonMeta}
        </div>
        <input
          className="pc-input"
          type={itemType === "number" ? "number" : "text"}
          defaultValue={value}
          disabled={disabled}
          onChange={(event) => onSave(event.target.value)}
          placeholder={itemType === "number" ? "Valore numerico" : "Risposta"}
        />
      </label>
    );
  }

  return (
    <label
      className="flex items-center gap-2 rounded-md border bg-background p-2"
      style={{ borderColor: "var(--border)", color: done ? "var(--text3)" : "var(--text)" }}
    >
      <input
        type="checkbox"
        checked={value === "checked"}
        disabled={disabled}
        onChange={(event) => onSave(event.target.checked ? "checked" : "unchecked")}
      />
      <span className="flex-1 text-[12px]">
        {item.text} {item.required && <span className="text-red-500">*</span>}
      </span>
      {commonMeta}
    </label>
  );
}

function responseMap(responses: TicketChecklistInstanceRow["responses"]) {
  return new Map(responses.map((response) => [response.item_key, response]));
}

function isResponseComplete(item: ChecklistItemDef, value?: string | null) {
  const itemType = item.type || "checkbox";
  if (itemType === "checkbox") return value === "checked";
  return !!value?.trim();
}

function computeInstanceProgress(instance: TicketChecklistInstanceRow) {
  const responses = responseMap(instance.responses);
  let done = 0;
  let total = 0;
  let requiredMissing = 0;
  Object.entries(instance.structure).forEach(([sectionKey, section]) => {
    section.items.forEach((item) => {
      total += 1;
      const response = responses.get(`${sectionKey}:${item.id}`);
      const completed = isResponseComplete(item, response?.value);
      if (completed) done += 1;
      if (item.required && !completed) requiredMissing += 1;
    });
  });
  return { done, total, requiredMissing, pct: total ? Math.round((done / total) * 100) : 0 };
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="pc-label">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="pc-label">{label}</div>
      <div className="text-[13px] font-bold">{value}</div>
      {hint && <div className="mt-1 font-mono text-[11px] text-text3">{hint}</div>}
    </div>
  );
}

function TicketHistory({ timeline, loading }: { timeline: TimelineItem[]; loading: boolean }) {
  if (loading) return <div className="text-[12px] text-text3">Caricamento storico...</div>;
  if (!timeline.length)
    return (
      <div
        className="rounded-lg border p-6 text-center text-[12px] text-text3"
        style={{ borderColor: "var(--border)" }}
      >
        Nessun evento storico disponibile
      </div>
    );
  return (
    <div className="relative space-y-0 pl-5 before:absolute before:bottom-0 before:left-[9px] before:top-0 before:w-px before:bg-border">
      {timeline.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="relative pb-5">
            <span className="absolute -left-5 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-4 ring-surface">
              <Icon className="h-3.5 w-3.5 text-accent" />
            </span>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[13px] font-semibold">{item.title}</div>
                <div className="text-[11px] text-text3">{fmtDateTime(item.at)}</div>
              </div>
              <div className="mt-1 text-[12px] text-text2">{item.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type TimelineItem = {
  id: string;
  at: string;
  title: string;
  description: string;
  icon: typeof Clock;
};

function buildTimeline(
  statusRows: any[],
  deviceRows: any[],
  assignments: AssignmentRow[],
): TimelineItem[] {
  const statusItems = statusRows.map((row) => ({
    id: `status-${row.id}`,
    at: row.changed_at,
    title: "Cambio stato",
    description: `${labelStatus(row.from_status)} -> ${labelStatus(row.to_status)}${row.note ? ` · ${row.note}` : ""}`,
    icon: RefreshCw,
  }));
  const deviceItems = deviceRows.map((row) => ({
    id: `device-history-${row.id}`,
    at: row.occurred_at,
    title: row.action === "unassigned" ? "Dispositivo scollegato" : "Dispositivo assegnato",
    description: `${row.device?.model || "Dispositivo"} ${row.device?.serial || ""}${row.notes ? ` · ${row.notes}` : ""}`,
    icon: Archive,
  }));
  const assignmentItems = assignments.map((row) => ({
    id: `assignment-${row.id}`,
    at: row.assigned_at,
    title: "Assegnazione dispositivo",
    description: `Assegnato a ${row.device?.model || "dispositivo"} ${row.device?.serial || ""}`,
    icon: UserRound,
  }));
  return [...statusItems, ...deviceItems, ...assignmentItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function labelStatus(status?: string | null) {
  if (!status) return "iniziale";
  return STATUS_META[status as TicketStatus]?.label || status;
}

function assetInfo(ticket: TicketRow) {
  return {
    model: ticket.device?.model || ticket.model || "Nessun asset associato",
    serial: ticket.device?.serial || "-",
    os: ticket.device?.os || "-",
    assignedTo: ticket.device?.assigned_to || "-",
  };
}

function parseCostNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function formatMoney(value: string | number | null | undefined) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    parseCostNumber(value),
  );
}

function formatRelativeTime(value: string) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "-";
  const diffMs = Date.now() - created;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  return `${months} mesi fa`;
}
