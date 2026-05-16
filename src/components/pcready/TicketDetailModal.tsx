import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "./Modal";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { useTicketDetail } from "@/lib/use-detail";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import queries from "@/lib/queries/tickets";
import {
  type ChecklistState,
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  fmtDate,
  fmtDateTime,
  type ChecklistStructure,
  DEFAULT_STRUCTURE,
  structureProgress,
  computeSlaStatus,
  formatSlaCountdown,
} from "@/lib/pcready";
import { StatusBadge, PriorityLabel, AssigneeChip, TicketTypeBadge } from "./StatusBadge";
import { createNotification } from "@/lib/notifications";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/queries/keys";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TicketNotes } from "@/components/tickets/TicketNotes";
import { sendChecklistCompletedEmail } from "@/lib/email-events";
import activityQueries from "@/lib/queries/activity";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { parseChecklistStructure } from "@/types/checklist-structure";

interface TicketRow {
  id: string;
  ticket_code: string;
  client: string;
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
  device_id: string | null;
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
  device?: { model: string; serial: string | null } | null;
}

export function TicketDetailModal() {
  const { id, close } = useTicketDetail();
  const { canEdit, user, session } = useAuth();
  const notify = useServerFn(createNotification);
  const sendChecklistEmail = useServerFn(sendChecklistCompletedEmail);
  useTickets();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tab, setTab] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { useTicketQuery, useTicketAssignmentsQuery, useUpdateTicket, useDeleteTicket } =
    queries as any;
  const ticketQuery = useTicketQuery(id);
  const assignmentsQuery = useTicketAssignmentsQuery(id);
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const insertActivity = activityQueries.insertActivity as any;
  const addTicketStatusHistory = (queries as any).addTicketStatusHistory as any;
  const qc = useQueryClient();

  useEffect(() => {
    if (assignmentsQuery.data) setAssignments(assignmentsQuery.data as AssignmentRow[]);
  }, [assignmentsQuery.data]);

  if (!id || ticketQuery.isLoading || !ticketQuery.data) return null;
  const ticket = ticketQuery.data as TicketRow;
  const struct: ChecklistStructure =
    ticket.checklist_structure && Object.keys(ticket.checklist_structure).length
      ? parseChecklistStructure(ticket.checklist_structure)
      : DEFAULT_STRUCTURE;
  const tabKeys = Object.keys(struct);
  const currentTab = tab && struct[tab] ? tab : tabKeys[0];
  const asset = assetInfo(ticket);

  async function update(patch: { checklist?: ChecklistState; status?: TicketStatus }) {
    // cast to any to avoid strict DB update typing differences for status enum
    const dbPatch: TablesUpdate<"tickets"> = {
      ...patch,
      checklist: patch.checklist as unknown as Json | undefined,
    } as any;
    try {
      await updateTicket.mutateAsync({ id: ticket.id, patch: dbPatch });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore aggiornamento";
      return toast.error(message);
    }
  }

  async function toggleItem(itemId: string) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const cur = { ...(ticket.checklist || {}) } as ChecklistState;
    cur[currentTab] = { ...(cur[currentTab] || {}), [itemId]: !cur[currentTab]?.[itemId] };
    await update({ checklist: cur });
    const prog = structureProgress(cur, struct, currentTab);
    if (prog.pct === 100) {
      if (ticket.assignee_id && session?.access_token) {
        await notify({
          data: {
            accessToken: session.access_token,
            notification: {
              userId: ticket.assignee_id,
              type: "checklist_completed",
              title: `${ticket.ticket_code}: checklist completata`,
              body: struct[currentTab]?.label || "Sezione checklist completata",
              payload: { ticket_id: ticket.id, checklist_key: currentTab },
              link: "/tickets",
            },
          },
        });
      }
      void sendChecklistEmail({
        data: {
          ticketId: ticket.id,
          checklistName: struct[currentTab]?.label || "Checklist completata",
        },
      }).catch((err) => {
        console.error("Failed to send checklist completed email:", err);
      });
      if (currentTab === "os" && ticket.status === "pending") await advance("in-progress", true);
      if (currentTab === "software" && ticket.status === "in-progress")
        await advance("testing", true);
    }
  }

  async function advance(next: TicketStatus, auto = false) {
    const previousStatus = ticket.status;
    await update({ status: next });
    // Insert status history record
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
    toast.success(`Avanzato a ${STATUS_META[next].label}`);

    // Trigger completion workflow when status changes to 'completed'
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

  const meta = STATUS_META[ticket.status];
  const sla = computeSlaStatus(
    ticket.created_at,
    ticket.priority,
    undefined,
    ticket.due_date || ticket.sla_deadline,
    ticket.sla_breached,
  );

  return (
    <Modal
      open={true}
      onClose={close}
      size="lg"
      title={`${ticket.ticket_code} - ${asset.model}`}
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
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Info label="Cliente" value={ticket.client} />
        <Info
          label="Stato"
          value={
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
            </div>
          }
        />
        <Info label="Asset" value={asset.model} />
        <Info
          label="Seriale"
          value={<span className="font-mono text-text3 text-xs">{asset.serial}</span>}
        />
        <Info label="Priorita" value={<PriorityLabel p={ticket.priority} />} />
        <Info label="Tipo" value={<TicketTypeBadge type={ticket.ticket_type} />} />
        <Info label="Richiedente" value={ticket.requester} />
        <Info label="Utente asset" value={asset.assignedTo} />
        <Info
          label="Assegnato a"
          value={
            <AssigneeChip initials={ticket.assignee?.initials} name={ticket.assignee?.full_name} />
          }
        />
        <Info label="Creato" value={fmtDate(ticket.created_at)} />
        <Info
          label="SLA"
          value={
            <span className="inline-flex flex-col text-xs">
              <span
                className={
                  sla.status === "overdue"
                    ? "text-red-600 font-semibold"
                    : sla.status === "warning"
                      ? "text-amber-600 font-semibold"
                      : "text-green-600 font-semibold"
                }
              >
                {sla.status === "overdue"
                  ? "SLA violato"
                  : sla.status === "warning"
                    ? "In scadenza"
                    : "SLA OK"}
              </span>
              <span className="font-mono text-text3">{formatSlaCountdown(sla.deadline)}</span>
            </span>
          }
        />
        <Info label="Prima risposta" value={fmtDateTime(ticket.sla_response_at)} />
        <Info label="OS asset" value={asset.os} />
        <Info label="Software" value={<span className="text-xs">{ticket.software || "-"}</span>} />
      </div>

      {assignments.length > 0 && (
        <div
          className="mb-4 p-3 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div className="pc-label">Storico asset-ticket</div>
          <div className="flex flex-col gap-1.5">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[12px] text-text2">
                <span className="font-semibold">{a.device?.model || "Asset"}</span>
                <span className="font-mono text-text3">{a.device?.serial || "-"}</span>
                <span className="ml-auto text-text3">{fmtDateTime(a.assigned_at)}</span>
                {a.unassigned_at && (
                  <span className="text-text3">chiuso {fmtDateTime(a.unassigned_at)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {ticket.notes && (
        <div
          className="mb-4 p-3 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div className="pc-label">Note</div>
          <div className="text-[12.5px] text-text2">{ticket.notes}</div>
        </div>
      )}

      <div className="border-b mb-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex">
          {tabKeys.map((key) => {
            const p = structureProgress(ticket.checklist || {}, struct, key);
            const on = currentTab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="px-4 py-2 text-[12.5px] font-semibold transition-colors -mb-px border-b-2"
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
      </div>

      <div className="flex flex-col gap-1.5">
        {(struct[currentTab]?.items || []).map((item) => {
          const done = ticket.checklist?.[currentTab]?.[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-left text-[13px] transition-all"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                color: done ? "var(--text3)" : "var(--text)",
                textDecoration: done ? "line-through" : "none",
              }}
            >
              <span
                className="w-[17px] h-[17px] rounded flex items-center justify-center flex-shrink-0"
                style={{
                  background: done ? "var(--success)" : "transparent",
                  border: "1.5px solid " + (done ? "var(--success)" : "var(--border2)"),
                }}
              >
                {done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </span>
              {item.text}
            </button>
          );
        })}
        {!struct[currentTab]?.items?.length && (
          <div className="text-center py-6 text-text3 text-[12px]">
            Nessuna voce in questa sezione
          </div>
        )}
      </div>

      <TicketNotes
        ticketId={ticket.id}
        onChanged={() => {
          qc.invalidateQueries(QUERY_KEYS.ticket(ticket.id) as any);
          qc.invalidateQueries(QUERY_KEYS.tickets as any);
        }}
      />
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

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="pc-label">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

function assetInfo(ticket: TicketRow) {
  return {
    model: ticket.device?.model || "Nessun asset associato",
    serial: ticket.device?.serial || "-",
    os: ticket.device?.os || "-",
    assignedTo: ticket.device?.assigned_to || "-",
  };
}
