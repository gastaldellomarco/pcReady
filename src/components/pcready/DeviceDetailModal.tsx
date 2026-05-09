import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { supabase } from "@/integrations/supabase/client";
import { useDeviceDetail } from "@/lib/use-detail";
import { fmtDateTime } from "@/lib/pcready";
import { toast } from "sonner";

interface DeviceRow {
  id: string;
  serial: string | null;
  model: string;
  os: string | null;
  status: string;
  client?: { name: string } | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

interface AssignmentRow {
  id: string;
  ticket_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  assigned_by: string | null;
  notes: string | null;
  ticket?: { id: string; ticket_code: string; status: string; priority: string; client: string } | null;
}

interface TicketRow {
  id: string;
  ticket_code: string;
  client: string;
  requester: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

interface HistoryRow {
  id: string;
  ticket_id: string | null;
  assignment_id: string | null;
  action: string;
  occurred_at: string;
  actor_id: string | null;
  changed_fields: unknown;
  notes: string | null;
}

interface TimelineItem {
  id: string;
  at: string;
  kind: "device" | "assignment" | "ticket" | "status" | "maintenance" | "note";
  title: string;
  detail: string;
  operator?: string | null;
}

export function DeviceDetailModal() {
  const { id, close } = useDeviceDetail();
  const [d, setD] = useState<DeviceRow | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryRow[]>([]);

  useEffect(() => {
    if (!id) {
      setD(null);
      setAssignments([]);
      setTickets([]);
      setHistoryEntries([]);
      return;
    }

    supabase
      .from("devices")
      .select("*, client:clients(name)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setD(data as DeviceRow | null);
      });

    supabase
      .from("ticket_device_assignments")
      .select(
        "id, ticket_id, assigned_at, unassigned_at, assigned_by, notes, ticket:tickets(id, ticket_code, status, priority, client)",
      )
      .eq("device_id", id)
      .order("assigned_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setAssignments((data ?? []) as AssignmentRow[]);
      });

    supabase
      .from("tickets")
      .select("id, ticket_code, client, requester, status, priority, created_at, updated_at, notes")
      .eq("device_id", id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setTickets((data ?? []) as TicketRow[]);
      });

    supabase
      .from("ticket_device_assignment_history")
      .select("id, ticket_id, assignment_id, action, occurred_at, actor_id, changed_fields, notes")
      .eq("device_id", id)
      .order("occurred_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        setHistoryEntries((data ?? []) as HistoryRow[]);
      });
  }, [id]);

  if (!id || !d) return null;
  const timeline = buildDeviceTimeline(d, assignments, tickets, historyEntries);

  return (
    <Modal open={true} onClose={close} size="lg" title={`${d.model} - ${d.serial || "-"}`}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="pc-label">Stato</div>
          <div className="text-[13px]">{d.status}</div>
        </div>
        <div>
          <div className="pc-label">Aggiornato</div>
          <div className="text-[13px]">{fmtDateTime(d.updated_at)}</div>
        </div>
        <div>
          <div className="pc-label">Cliente</div>
          <div className="text-[13px]">{d.client?.name || "-"}</div>
        </div>
        <div>
          <div className="pc-label">Utente asset</div>
          <div className="text-[13px]">{d.assigned_to || "-"}</div>
        </div>
        <div>
          <div className="pc-label">OS</div>
          <div className="text-[13px]">{d.os || "-"}</div>
        </div>
        <div>
          <div className="pc-label">ID</div>
          <div className="text-[13px] font-mono">{d.id}</div>
        </div>
        <div>
          <div className="pc-label">Operatore</div>
          <div className="text-[13px] font-mono">{d.created_by || "-"}</div>
        </div>
      </div>

      {d.notes && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="pc-label">Note tecniche</div>
          <div className="text-[12.5px] text-text2">{d.notes}</div>
        </div>
      )}

      <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
        <div className="pc-label">Timeline asset</div>
        <div className="mt-3 flex flex-col gap-3">
          {timeline.map((item) => (
            <div key={item.id} className="flex gap-3 text-[13px]">
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: timelineColor(item.kind) }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.title}</span>
                  <span className="font-mono text-[11px] text-text3">{fmtDateTime(item.at)}</span>
                </div>
                <div className="text-[12px] text-text2">{item.detail}</div>
                {item.operator && (
                  <div className="mt-1 font-mono text-[11px] text-text3">Operatore: {item.operator}</div>
                )}
              </div>
            </div>
          ))}
          {!timeline.length && <div className="text-[12.5px] text-text3">Nessun evento storico disponibile.</div>}
        </div>
      </div>

      {assignments.length > 0 && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="pc-label">Storico assegnazioni</div>
          <div className="flex flex-col gap-2 mt-2">
            {assignments.map((a) => (
              <div key={a.id} className="text-[13px] flex items-center gap-2">
                <div className="font-semibold">{a.ticket?.ticket_code || "-"}</div>
                <div className="font-mono text-text3">{fmtDateTime(a.assigned_at)}</div>
                <div className="ml-auto text-text3">{a.unassigned_at ? `chiuso ${fmtDateTime(a.unassigned_at)}` : "attivo"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tickets.length > 0 && (
        <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <div className="pc-label">Ticket associati</div>
          <div className="flex flex-col gap-2 mt-2">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="text-[13px] flex items-center gap-2">
                <div className="font-semibold">{ticket.ticket_code}</div>
                <div className="text-text2">{ticket.client}</div>
                <div className="ml-auto text-text3">{ticket.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button className="pc-btn pc-btn-ghost" onClick={close}>
          Chiudi
        </button>
      </div>
    </Modal>
  );
}

function buildDeviceTimeline(
  device: DeviceRow,
  assignments: AssignmentRow[],
  tickets: TicketRow[],
  historyEntries: HistoryRow[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    {
      id: `device-created-${device.id}`,
      at: device.created_at,
      kind: "device",
      title: "Asset creato",
      detail: `${device.model}${device.serial ? ` · ${device.serial}` : ""}`,
      operator: device.created_by,
    },
    {
      id: `device-updated-${device.id}`,
      at: device.updated_at,
      kind: device.status === "maintenance" ? "maintenance" : "status",
      title: "Stato corrente",
      detail: `${device.status}${device.assigned_to ? ` · assegnato a ${device.assigned_to}` : ""}`,
    },
  ];

  if (device.notes) {
    items.push({
      id: `device-notes-${device.id}`,
      at: device.updated_at,
      kind: "note",
      title: "Note tecniche aggiornate",
      detail: device.notes,
    });
  }

  assignments.forEach((assignment) => {
    items.push({
      id: `assignment-start-${assignment.id}`,
      at: assignment.assigned_at,
      kind: "assignment",
      title: "Asset assegnato a ticket",
      detail: `${assignment.ticket?.ticket_code || assignment.ticket_id}${assignment.notes ? ` · ${assignment.notes}` : ""}`,
      operator: assignment.assigned_by,
    });
    if (assignment.unassigned_at) {
      items.push({
        id: `assignment-end-${assignment.id}`,
        at: assignment.unassigned_at,
        kind: "assignment",
        title: "Assegnazione chiusa",
        detail: assignment.ticket?.ticket_code || assignment.ticket_id,
      });
    }
  });

  const assignedTicketIds = new Set(assignments.map((assignment) => assignment.ticket_id));

  tickets.forEach((ticket) => {
    if (assignedTicketIds.has(ticket.id)) return;
    items.push({
      id: `ticket-created-${ticket.id}`,
      at: ticket.created_at,
      kind: "ticket",
      title: "Ticket associato",
      detail: `${ticket.ticket_code} · ${ticket.client} · ${ticket.status}`,
    });
    if (ticket.updated_at !== ticket.created_at) {
      items.push({
        id: `ticket-updated-${ticket.id}`,
        at: ticket.updated_at,
        kind: "ticket",
        title: "Ticket aggiornato",
        detail: `${ticket.ticket_code} · ${ticket.status}`,
      });
    }
    if (ticket.notes) {
      items.push({
        id: `ticket-notes-${ticket.id}`,
        at: ticket.updated_at,
        kind: "note",
        title: "Nota ticket",
        detail: `${ticket.ticket_code} · ${ticket.notes}`,
      });
    }
  });

  historyEntries.forEach((entry) => {
    items.push({
      id: `history-${entry.id}`,
      at: entry.occurred_at,
      kind: historyKind(entry.action),
      title: historyTitle(entry.action),
      detail: historyDetail(entry),
      operator: entry.actor_id,
    });
  });

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function historyKind(action: string): TimelineItem["kind"] {
  if (action.includes("status")) return "status";
  if (action.includes("maintenance")) return "maintenance";
  if (action.includes("note")) return "note";
  return "assignment";
}

function historyTitle(action: string) {
  if (action === "assigned") return "Assegnazione registrata";
  if (action === "unassigned") return "Assegnazione rimossa";
  if (action === "updated") return "Assegnazione aggiornata";
  return action.replace(/_/g, " ");
}

function historyDetail(entry: HistoryRow) {
  const changed = entry.changed_fields ? ` · ${JSON.stringify(entry.changed_fields)}` : "";
  return `${entry.notes || "Evento storico asset-ticket"}${changed}`;
}

function timelineColor(kind: TimelineItem["kind"]) {
  if (kind === "assignment") return "#1B4FD8";
  if (kind === "ticket") return "#7C3AED";
  if (kind === "maintenance") return "#EF9827";
  if (kind === "note") return "#6B7280";
  if (kind === "status") return "#16A34A";
  return "var(--accent)";
}

export default DeviceDetailModal;
