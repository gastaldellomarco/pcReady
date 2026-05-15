import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "./Modal";
import { supabase } from "@/integrations/supabase/client";
import { openTicketDetail, useDeviceDetail } from "@/lib/use-detail";
import {
  DEVICE_STATUS_LABEL,
  fmtDateTime,
  formatDeviceStatus,
  STATUS_META,
  TICKET_TYPE_LABEL,
  type DeviceInventoryStatus,
  type TicketType,
} from "@/lib/pcready";
import { useAuth } from "@/lib/auth-context";
import { updateDeviceStatus } from "@/lib/device-status";
import { useTickets } from "@/lib/use-tickets";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketPlus, Save } from "lucide-react";

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
  ticket?: {
    id: string;
    ticket_code: string;
    status: string;
    priority: string;
    client: string;
  } | null;
}

interface TicketRow {
  id: string;
  ticket_code: string;
  client: string;
  requester: string;
  status: string;
  priority: string;
  ticket_type: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  created_by: string | null;
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

interface ActivityRow {
  id: string;
  created_at: string;
  message: string;
  ticket_id: string | null;
  actor_id: string | null;
  type: string;
}

interface TimelineItem {
  id: string;
  at: string;
  kind: "device" | "assignment" | "ticket" | "status" | "maintenance" | "note";
  title: string;
  detail: string;
  operatorId?: string | null;
  operatorLabel?: string;
  ticketId?: string | null;
}

const DEVICE_STATUS_OPTIONS: DeviceInventoryStatus[] = [
  "available",
  "assigned",
  "maintenance",
  "retired",
];

export function DeviceDetailModal() {
  const { id, close } = useDeviceDetail();
  const { session, canEdit } = useAuth();
  const patchDeviceStatus = useServerFn(updateDeviceStatus);
  const [d, setD] = useState<DeviceRow | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<DeviceInventoryStatus | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const { openCreate } = useTickets();

  useEffect(() => {
    if (!id) {
      setD(null);
      setAssignments([]);
      setTickets([]);
      setHistoryEntries([]);
      setActivities([]);
      setProfileNames({});
      setLoading(false);
      return;
    }

    const deviceId = id;
    let cancelled = false;
    setLoading(true);

    async function run() {
      const devRes = await supabase
        .from("devices")
        .select("*, client:clients(name)")
        .eq("id", deviceId)
        .maybeSingle();

      if (cancelled) return;
      if (devRes.error) {
        toast.error(devRes.error.message);
        setLoading(false);
        return;
      }
      setD(devRes.data as DeviceRow | null);

      const assignRes = await supabase
        .from("ticket_device_assignments")
        .select(
          "id, ticket_id, assigned_at, unassigned_at, assigned_by, notes, ticket:tickets(id, ticket_code, status, priority, client)",
        )
        .eq("device_id", deviceId)
        .order("assigned_at", { ascending: false });

      if (cancelled) return;
      if (assignRes.error) {
        toast.error(assignRes.error.message);
        setAssignments([]);
      } else {
        setAssignments((assignRes.data ?? []) as AssignmentRow[]);
      }

      const assignmentTicketIds = [
        ...new Set((assignRes.data ?? []).map((r: { ticket_id: string }) => r.ticket_id)),
      ];

      let ticketsQuery = supabase
        .from("tickets")
        .select(
          "id, ticket_code, client, requester, status, priority, ticket_type, created_at, updated_at, notes, created_by",
        );

      if (assignmentTicketIds.length) {
        ticketsQuery = ticketsQuery.or(
          `device_id.eq.${deviceId},id.in.(${assignmentTicketIds.join(",")})`,
        );
      } else {
        ticketsQuery = ticketsQuery.eq("device_id", deviceId);
      }

      const ticketsRes = await ticketsQuery.order("created_at", { ascending: false });

      if (cancelled) return;
      if (ticketsRes.error) {
        toast.error(ticketsRes.error.message);
        setTickets([]);
      } else {
        setTickets((ticketsRes.data ?? []) as TicketRow[]);
      }

      const histRes = await supabase
        .from("ticket_device_assignment_history")
        .select(
          "id, ticket_id, assignment_id, action, occurred_at, actor_id, changed_fields, notes",
        )
        .eq("device_id", deviceId)
        .order("occurred_at", { ascending: false });

      if (cancelled) return;
      if (histRes.error) {
        toast.error(histRes.error.message);
        setHistoryEntries([]);
      } else {
        setHistoryEntries((histRes.data ?? []) as HistoryRow[]);
      }

      const ticketRows = (ticketsRes.data ?? []) as TicketRow[];
      const relatedTicketIds = [
        ...new Set([...assignmentTicketIds, ...ticketRows.map((t) => t.id)]),
      ];

      let logRows: ActivityRow[] = [];
      if (relatedTicketIds.length) {
        const logRes = await supabase
          .from("activity_log")
          .select("id, created_at, message, ticket_id, actor_id, type")
          .in("ticket_id", relatedTicketIds)
          .order("created_at", { ascending: false });
        if (!cancelled && !logRes.error) {
          logRows = (logRes.data ?? []) as ActivityRow[];
        }
      }

      // Also load device-level activity (status changes, etc.)
      const deviceLogRes = await (supabase as any)
        .from("activity_log")
        .select("id, created_at, message, ticket_id, actor_id, type")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false });
      if (!cancelled && !deviceLogRes.error && deviceLogRes.data) {
        // Merge device logs with ticket logs, avoiding duplicates by id
        const existingIds = new Set(logRows.map((r) => r.id));
        for (const row of deviceLogRes.data as ActivityRow[]) {
          if (!existingIds.has(row.id)) {
            logRows.push(row);
            existingIds.add(row.id);
          }
        }
        logRows.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }

      if (cancelled) return;
      setActivities(logRows);

      const dev = devRes.data as DeviceRow | null;
      const actorIds = new Set<string>();
      if (dev?.created_by) actorIds.add(dev.created_by);
      (assignRes.data ?? []).forEach((a: AssignmentRow) => {
        if (a.assigned_by) actorIds.add(a.assigned_by);
      });
      (histRes.data ?? []).forEach((h: HistoryRow) => {
        if (h.actor_id) actorIds.add(h.actor_id);
      });
      logRows.forEach((l) => {
        if (l.actor_id) actorIds.add(l.actor_id);
      });
      ticketRows.forEach((t) => {
        if (t.created_by) actorIds.add(t.created_by);
      });

      if (actorIds.size) {
        const profRes = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [...actorIds]);
        if (!cancelled && !profRes.error && profRes.data) {
          const map: Record<string, string> = {};
          (profRes.data as { id: string; full_name: string }[]).forEach((p) => {
            map[p.id] = p.full_name;
          });
          setProfileNames(map);
        } else if (!cancelled) {
          setProfileNames({});
        }
      } else if (!cancelled) {
        setProfileNames({});
      }

      if (!cancelled) setLoading(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const ticketCodeById = useMemo(() => {
    const m = new Map<string, string>();
    tickets.forEach((t) => m.set(t.id, t.ticket_code));
    assignments.forEach((a) => {
      if (a.ticket?.ticket_code) m.set(a.ticket_id, a.ticket.ticket_code);
    });
    return m;
  }, [tickets, assignments]);

  const timeline = useMemo(() => {
    if (!d) return [];
    return buildDeviceTimeline({
      device: d,
      tickets,
      historyEntries,
      activities,
      ticketCodeById,
      profileNames,
    });
  }, [d, tickets, historyEntries, activities, ticketCodeById, profileNames]);

  const lastEvent = timeline[0];

  const resolveName = (uid: string | null | undefined) => {
    if (!uid) return null;
    return profileNames[uid] ?? `Utente ${uid.slice(0, 8)}…`;
  };

  async function commitDeviceStatus(next: DeviceInventoryStatus) {
    if (!session?.access_token || !d) return;
    setStatusSaving(true);
    try {
      await patchDeviceStatus({
        data: {
          accessToken: session.access_token,
          deviceId: d.id,
          status: next,
        },
      });
      setD({ ...d, status: next });
      toast.success("Stato dispositivo aggiornato");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Aggiornamento stato non riuscito");
    } finally {
      setStatusSaving(false);
      setConfirmStatusOpen(false);
      setPendingStatus(null);
    }
  }

  async function saveNotes() {
    if (!d || !session?.access_token) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("devices")
        .update({ notes: notesDraft || null })
        .eq("id", d.id);
      if (error) throw error;
      setD({ ...d, notes: notesDraft || null });
      setEditingNotes(false);
      toast.success("Note tecniche aggiornate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio note");
    } finally {
      setSavingNotes(false);
    }
  }

  function onDeviceStatusSelect(value: string) {
    const next = value as DeviceInventoryStatus;
    if (!d || next === d.status) return;
    if (next === "maintenance" || next === "retired") {
      setPendingStatus(next);
      setConfirmStatusOpen(true);
      return;
    }
    void commitDeviceStatus(next);
  }

  if (!id) return null;

  if (loading || !d) {
    return (
      <Modal open={true} onClose={close} size="lg" title="Scheda asset">
        <div className="py-10 text-center text-[13px] text-text3">
          {loading ? "Caricamento cronologia…" : "Dispositivo non trovato."}
        </div>
        <div className="flex justify-end">
          <button className="pc-btn pc-btn-ghost" type="button" onClick={close}>
            Chiudi
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onClose={close}
      size="xl"
      title={`${d.model} — ${d.serial || "senza seriale"}`}
    >
      <p className="text-[11px] text-text3 font-mono mb-3 -mt-1">Asset · {d.id}</p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="min-w-0">
          <div className="pc-label">Stato dispositivo</div>
          {canEdit ? (
            <Select
              value={d.status as DeviceInventoryStatus}
              onValueChange={onDeviceStatusSelect}
              disabled={statusSaving}
            >
              <SelectTrigger className="mt-1 h-9 text-[13px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {DEVICE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-[13px] font-medium mt-1">{formatDeviceStatus(d.status)}</div>
          )}
        </div>
        <div>
          <div className="pc-label">Ultimo aggiornamento scheda</div>
          <div className="text-[13px]">{fmtDateTime(d.updated_at)}</div>
        </div>
        <div>
          <div className="pc-label">Cliente</div>
          <div className="text-[13px]">{d.client?.name || "—"}</div>
        </div>
        <div>
          <div className="pc-label">Utente asset (anagrafica)</div>
          <div className="text-[13px]">{d.assigned_to || "—"}</div>
        </div>
        <div>
          <div className="pc-label">OS</div>
          <div className="text-[13px]">{d.os || "—"}</div>
        </div>
        <div>
          <div className="pc-label">Creato il / da</div>
          <div className="text-[13px]">
            {fmtDateTime(d.created_at)}
            {d.created_by ? ` · ${resolveName(d.created_by)}` : ""}
          </div>
        </div>
      </div>

      {lastEvent && (
        <div
          className="mb-4 rounded-lg px-3 py-2.5 text-[12.5px]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <span className="pc-label">Ultimo evento registrato</span>
          <div className="mt-1 text-text2">
            <span className="font-semibold text-text">{lastEvent.title}</span>
            <span className="text-text3"> · {fmtDateTime(lastEvent.at)}</span>
            {lastEvent.operatorLabel ? (
              <span className="text-text3"> · {lastEvent.operatorLabel}</span>
            ) : null}
          </div>
        </div>
      )}

      {d.notes !== undefined && (
        <div className="flex items-start justify-between gap-2 mb-4 p-3 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="pc-label mb-1">Note tecniche</div>
            {editingNotes ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="pc-input w-full min-h-[80px] text-[12.5px]"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Inserisci note tecniche sul dispositivo..."
                />
                <div className="flex gap-2">
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    disabled={savingNotes}
                    onClick={saveNotes}
                  >
                    <Save className="h-3 w-3" />
                    {savingNotes ? "Salvataggio..." : "Salva"}
                  </button>
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm"
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesDraft(d?.notes ?? "");
                    }}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="text-[12.5px] text-text2 whitespace-pre-wrap cursor-pointer hover:bg-background/50 rounded px-1 -mx-1 py-1"
                onClick={() => {
                  if (!canEdit) return;
                  setNotesDraft(d?.notes ?? "");
                  setEditingNotes(true);
                }}
              >
                {d.notes || (
                  <span className="text-text3 italic">Nessuna nota tecnica{canEdit ? " — clicca per aggiungere" : ""}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="mb-4 p-3 rounded-lg"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
      >
        <div className="pc-label">Cronologia operativa (unica timeline)</div>
        <p className="text-[11px] text-text3 mt-1 mb-3">
          Assegnazioni ticket/device ricostruite dalla tabella storica; cambi di stato e attività
          dai ticket collegati provengono dal log attività; manutenzioni come ticket di tipo
          &quot;Manutenzione&quot; o stato dispositivo in manutenzione.
        </p>
        <div className="relative max-h-[min(420px,50vh)] overflow-y-auto pl-1">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          <div className="flex flex-col gap-0">
            {timeline.map((item) => (
              <div key={item.id} className="relative flex gap-3 py-2.5 pl-5 text-[13px]">
                <div
                  className="absolute left-0 top-[18px] h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                  style={{ background: timelineColor(item.kind) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{item.title}</span>
                    <span className="font-mono text-[11px] text-text3">{fmtDateTime(item.at)}</span>
                    {item.kind !== "device" && (
                      <span className="text-[10px] uppercase tracking-wide text-text3">
                        {timelineKindLabel(item.kind)}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-text2 mt-0.5 whitespace-pre-wrap">
                    {item.detail}
                  </div>
                  {item.operatorLabel && (
                    <div className="mt-1 text-[11px] text-text3">
                      Operatore: {item.operatorLabel}
                    </div>
                  )}
                  {item.ticketId && (
                    <button
                      type="button"
                      className="mt-1.5 text-[11px] font-semibold text-accent hover:underline"
                      onClick={() => openTicketDetail(item.ticketId!)}
                    >
                      Apri ticket
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!timeline.length && (
              <div className="text-[12.5px] text-text3 py-4 pl-5">
                Nessun evento nella cronologia.
              </div>
            )}
          </div>
        </div>
      </div>

      {tickets.length > 0 && (
        <div
          className="mb-4 p-3 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div className="pc-label">Ticket collegati ({tickets.length})</div>
          <p className="text-[11px] text-text3 mt-1 mb-2">
            Ticket con <code className="text-[10px]">device_id</code> su questo asset o con
            assegnazioni in cronologia.
          </p>
          <div className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className="flex flex-wrap items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[13px] hover:border-border hover:bg-background/80"
                onClick={() => openTicketDetail(ticket.id)}
              >
                <span className="font-semibold">{ticket.ticket_code}</span>
                <span className="text-text2">{ticket.client}</span>
                <span className="text-text3">
                  {STATUS_META[ticket.status as keyof typeof STATUS_META]?.label ?? ticket.status}
                </span>
                <span className="text-text3 text-[12px]">
                  {TICKET_TYPE_LABEL[ticket.ticket_type as TicketType] ?? ticket.ticket_type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={confirmStatusOpen} onOpenChange={(open) => {
        setConfirmStatusOpen(open);
        if (!open) setPendingStatus(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma cambio stato</AlertDialogTitle>
            <AlertDialogDescription>
              Impostare lo stato su{" "}
              <span className="font-medium text-foreground">
                {pendingStatus ? DEVICE_STATUS_LABEL[pendingStatus] : "—"}
              </span>{" "}
              può impattare disponibilità e assegnazioni. Continuare?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              type="button"
              onClick={() => {
                setPendingStatus(null);
              }}
            >
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={!pendingStatus || statusSaving}
              onClick={() => {
                if (pendingStatus) void commitDeviceStatus(pendingStatus);
              }}
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-between">
        {d ? (
          <button
            className="pc-btn pc-btn-primary pc-btn-sm"
            type="button"
            onClick={() => {
              close();
              // Small delay to let modal close before opening create dialog
              setTimeout(() => openCreate(), 150);
            }}
          >
            <TicketPlus className="h-3.5 w-3.5" />
            Crea ticket con questo dispositivo
          </button>
        ) : (
          <div />
        )}
        <button className="pc-btn pc-btn-ghost" type="button" onClick={close}>
          Chiudi
        </button>
      </div>
    </Modal>
  );
}

function timelineKindLabel(kind: TimelineItem["kind"]): string {
  const labels: Record<TimelineItem["kind"], string> = {
    device: "asset",
    assignment: "assegnazione",
    ticket: "ticket",
    status: "stato",
    maintenance: "manutenzione",
    note: "nota",
  };
  return labels[kind];
}

function buildDeviceTimeline(input: {
  device: DeviceRow;
  tickets: TicketRow[];
  historyEntries: HistoryRow[];
  activities: ActivityRow[];
  ticketCodeById: Map<string, string>;
  profileNames: Record<string, string>;
}): TimelineItem[] {
  const { device, tickets, historyEntries, activities, ticketCodeById, profileNames } = input;

  const nameOf = (uid: string | null | undefined) => {
    if (!uid) return undefined;
    return profileNames[uid] ?? `Utente ${uid.slice(0, 8)}…`;
  };

  const items: TimelineItem[] = [];

  items.push({
    id: `device-created-${device.id}`,
    at: device.created_at,
    kind: "device",
    title: "Asset registrato in inventario",
    detail: `${device.model}${device.serial ? ` · seriale ${device.serial}` : ""}`,
    operatorId: device.created_by,
    operatorLabel: nameOf(device.created_by) ?? undefined,
  });

  const createdMs = new Date(device.created_at).getTime();
  const updatedMs = new Date(device.updated_at).getTime();
  if (updatedMs - createdMs > 2000) {
    const noteExcerpt =
      device.notes && device.notes.length > 160
        ? `${device.notes.slice(0, 160)}…`
        : device.notes || "";
    items.push({
      id: `device-meta-${device.id}-${device.updated_at}`,
      at: device.updated_at,
      kind: device.status === "maintenance" ? "maintenance" : "status",
      title: "Scheda dispositivo aggiornata (snapshot)",
      detail: [
        `Stato: ${formatDeviceStatus(device.status)}`,
        device.assigned_to ? `Utente asset: ${device.assigned_to}` : null,
        noteExcerpt ? `Note: ${noteExcerpt}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  const historySorted = [...historyEntries].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  for (const entry of historySorted) {
    items.push({
      id: `history-${entry.id}`,
      at: entry.occurred_at,
      kind: historyKind(entry.action, entry),
      title: historyTitle(entry.action),
      detail: historyDetail(entry, ticketCodeById),
      operatorId: entry.actor_id,
      operatorLabel: nameOf(entry.actor_id),
      ticketId: entry.ticket_id,
    });
  }

  const activitySorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const log of activitySorted) {
    items.push({
      id: `activity-${log.id}`,
      at: log.created_at,
      kind: activityKind(log.message, log.type),
      title: "Attività su ticket",
      detail: log.message,
      operatorId: log.actor_id,
      operatorLabel: nameOf(log.actor_id),
      ticketId: log.ticket_id,
    });
  }

  for (const ticket of tickets) {
    const hasCreationLog = activities.some(
      (a) =>
        a.ticket_id === ticket.id &&
        /creato/i.test(a.message) &&
        Math.abs(new Date(a.created_at).getTime() - new Date(ticket.created_at).getTime()) <
          120_000,
    );
    if (!hasCreationLog) {
      const tlabel = TICKET_TYPE_LABEL[ticket.ticket_type as TicketType] ?? ticket.ticket_type;
      items.push({
        id: `ticket-open-${ticket.id}`,
        at: ticket.created_at,
        kind: ticket.ticket_type === "maintenance" ? "maintenance" : "ticket",
        title: "Ticket collegato all’asset",
        detail: `${ticket.ticket_code} · ${tlabel} · ${ticket.client} · ${STATUS_META[ticket.status as keyof typeof STATUS_META]?.label ?? ticket.status}`,
        operatorId: ticket.created_by,
        operatorLabel: nameOf(ticket.created_by),
        ticketId: ticket.id,
      });
    }

    if (ticket.notes?.trim()) {
      const excerpt =
        ticket.notes.length > 200 ? `${ticket.notes.slice(0, 200)}…` : ticket.notes.trim();
      items.push({
        id: `ticket-notes-${ticket.id}-${ticket.updated_at}`,
        at: ticket.updated_at,
        kind: "note",
        title: `Descrizione / note ticket ${ticket.ticket_code}`,
        detail: excerpt,
        ticketId: ticket.id,
      });
    }
  }

  items.sort((a, b) => {
    const diff = new Date(b.at).getTime() - new Date(a.at).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return dedupeTimeline(items);
}

/** Rimuove voci quasi duplicate (stesso istante e stesso significato). */
function dedupeTimeline(items: TimelineItem[]): TimelineItem[] {
  const seen = new Set<string>();
  const out: TimelineItem[] = [];
  for (const item of items) {
    const key = `${item.at}|${item.kind}|${item.title}|${item.detail.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function historyKind(action: string, entry: HistoryRow): TimelineItem["kind"] {
  if (action === "replaced") return "assignment";
  if (action === "deleted") return "assignment";
  if (action === "unassigned") return "assignment";
  if (action === "assigned") return "assignment";
  const msg = `${entry.notes ?? ""} ${JSON.stringify(entry.changed_fields ?? "")}`;
  if (/maintenance/i.test(msg)) return "maintenance";
  return "assignment";
}

function historyTitle(action: string) {
  if (action === "assigned") return "Asset assegnato a un ticket";
  if (action === "unassigned") return "Assegnazione asset a ticket chiusa";
  if (action === "replaced") return "Sostituzione dispositivo sul ticket";
  if (action === "deleted") return "Assegnazione rimossa (record eliminato)";
  return action.replace(/_/g, " ");
}

function historyDetail(entry: HistoryRow, ticketCodeById: Map<string, string>) {
  const code = entry.ticket_id ? ticketCodeById.get(entry.ticket_id) : null;
  const ticketPart = code
    ? `Ticket ${code}`
    : entry.ticket_id
      ? `Ticket ${entry.ticket_id.slice(0, 8)}…`
      : "Ticket";

  if (
    entry.action === "replaced" &&
    entry.changed_fields &&
    typeof entry.changed_fields === "object"
  ) {
    const cf = entry.changed_fields as { from?: string; to?: string };
    const from = cf.from?.slice(0, 8) ?? "?";
    const to = cf.to?.slice(0, 8) ?? "?";
    return `${ticketPart}: collegamento spostato su altro asset (…${from} → …${to})`;
  }

  const note = entry.notes?.trim();
  if (note) return `${ticketPart}: ${note}`;
  return ticketPart;
}

function activityKind(message: string, type: string): TimelineItem["kind"] {
  const m = message.toLowerCase();
  if (m.includes("stato") || m.includes("kanban")) return "status";
  if (m.includes("manutenzione") || type === "auto") return "status";
  if (m.includes("creato")) return "ticket";
  return "ticket";
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
