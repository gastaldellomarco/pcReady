import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "./Modal";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { openTicketDetail, useDeviceDetail } from "@/lib/use-detail";
import {
  DEVICE_STATUS_LABEL,
  fmtDateTime,
  fmtDate,
  formatDeviceStatus,
  STATUS_META,
  TICKET_TYPE_LABEL,
  DEFAULT_STRUCTURE,
  structureOverallProgress,
  type ChecklistState,
  type ChecklistStructure,
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
import OverflowTable from "@/components/ui/overflow-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cpu, HardDrive, Monitor, Network, QrCode, Save, TicketPlus, Wrench } from "lucide-react";
import { MaintenanceSchedulePanel } from "@/components/inventory/MaintenanceSchedulePanel";
import {
  daysUntil,
  getWarrantyStatus,
  isProbablyUrl,
  toDateInputValue,
  warrantyProgress,
  WARRANTY_STATUS_META,
  WARRANTY_TYPES,
  type WarrantyType,
} from "@/lib/warranty";
import { pcReadyColors } from "@/lib/design-system";

interface DeviceRow {
  id: string;
  brand: string | null;
  serial: string | null;
  model: string;
  os: string | null;
  os_version: string | null;
  os_architecture: string | null;
  status: string;
  client_id: string;
  client?: { name: string } | null;
  assigned_to: string | null;
  device_type: string | null;
  location_office: string | null;
  location_floor: string | null;
  location_desk: string | null;
  cpu_name: string | null;
  cpu_frequency_ghz: number | null;
  cpu_cores: number | null;
  ram_gb: number | null;
  ram_type: string | null;
  ram_frequency_mhz: number | null;
  storage_type: string | null;
  storage_capacity_gb: number | null;
  storage_drive_count: number | null;
  screen_resolution: string | null;
  screen_size_inches: number | null;
  screen_type: string | null;
  wifi: string | null;
  ethernet: string | null;
  bluetooth: string | null;
  purchase_cost: number | null;
  notes: string | null;
  purchase_date: string | null;
  warranty_expiry_date: string | null;
  warranty_type: string | null;
  warranty_provider: string | null;
  warranty_notes: string | null;
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
  category: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  notes: string | null;
  repair_cost: number | null;
  checklist: Json;
  checklist_structure: Json | null;
  created_by: string | null;
  assignee?: { full_name: string | null; initials: string | null } | null;
  template?: { name: string | null } | null;
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

type DeviceDetailTab = "info" | "hardware" | "maintenance" | "tickets" | "history";

type HardwareDraft = {
  cpu_name: string;
  cpu_frequency_ghz: string;
  cpu_cores: string;
  ram_gb: string;
  ram_type: string;
  ram_frequency_mhz: string;
  storage_type: string;
  storage_capacity_gb: string;
  storage_drive_count: string;
  os: string;
  os_version: string;
  os_architecture: string;
  screen_resolution: string;
  screen_size_inches: string;
  screen_type: string;
  wifi: string;
  ethernet: string;
  bluetooth: string;
};

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
  const [editingWarranty, setEditingWarranty] = useState(false);
  const [savingWarranty, setSavingWarranty] = useState(false);
  const [activeTab, setActiveTab] = useState<DeviceDetailTab>("info");
  const [editingHardware, setEditingHardware] = useState(false);
  const [savingHardware, setSavingHardware] = useState(false);
  const [hardwareDraft, setHardwareDraft] = useState<HardwareDraft>(() => emptyHardwareDraft());
  const [warrantyDraft, setWarrantyDraft] = useState({
    purchase_date: "",
    warranty_expiry_date: "",
    warranty_type: "standard" as WarrantyType,
    warranty_provider: "",
    warranty_notes: "",
  });
  const { openCreate } = useTickets();

  useEffect(() => {
    if (!id) {
      setD(null);
      setAssignments([]);
      setTickets([]);
      setHistoryEntries([]);
      setActivities([]);
      setProfileNames({});
      setEditingWarranty(false);
      setEditingHardware(false);
      setActiveTab("info");
      setHardwareDraft(emptyHardwareDraft());
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
      const deviceRow = devRes.data as DeviceRow | null;
      setD(deviceRow);
      if (deviceRow) {
        setWarrantyDraft({
          purchase_date: toDateInputValue(deviceRow.purchase_date),
          warranty_expiry_date: toDateInputValue(deviceRow.warranty_expiry_date),
          warranty_type: (deviceRow.warranty_type as WarrantyType) || "standard",
          warranty_provider: deviceRow.warranty_provider ?? "",
          warranty_notes: deviceRow.warranty_notes ?? "",
        });
        setHardwareDraft(deviceToHardwareDraft(deviceRow));
      }

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
          "id, ticket_code, client, requester, status, priority, ticket_type, category, created_at, updated_at, closed_at, notes, repair_cost, checklist, checklist_structure, created_by, assignee:profiles!tickets_assignee_id_fkey(full_name, initials), template:checklist_templates(name)",
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
        logRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
  const warrantyStatus = getWarrantyStatus(d?.warranty_expiry_date);
  const warrantyMeta = WARRANTY_STATUS_META[warrantyStatus];
  const warrantyDays = daysUntil(d?.warranty_expiry_date);
  const warrantyBar = warrantyProgress(d ?? {});
  const warrantyRemainingText =
    warrantyDays === null
      ? "Scadenza non impostata"
      : warrantyDays < 0
        ? `Scaduta da ${Math.abs(warrantyDays)} giorni`
        : warrantyDays === 0
          ? "Scade oggi"
          : `Scade tra ${warrantyDays} giorni`;
  const openTickets = tickets.filter((ticket) => !isClosedTicket(ticket));
  const closedTickets = tickets.filter((ticket) => isClosedTicket(ticket));
  const maintenanceTickets = tickets.filter((ticket) =>
    String(ticket.ticket_type || "")
      .toLowerCase()
      .includes("maintenance"),
  );
  const systemHealth = computeSystemHealth(d, openTickets);
  const purchaseCost = d?.purchase_cost ?? 0;
  const repairCosts = maintenanceTickets.reduce(
    (sum, ticket) => sum + (ticket.repair_cost ?? 0),
    0,
  );
  const tco = purchaseCost + repairCosts;
  const checklistSummaries = tickets.flatMap((ticket) => buildChecklistSummary(ticket));

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

  async function saveWarranty() {
    if (!d || !session?.access_token) return;
    setSavingWarranty(true);
    try {
      const payload = {
        purchase_date: warrantyDraft.purchase_date || null,
        warranty_expiry_date: warrantyDraft.warranty_expiry_date || null,
        warranty_type: warrantyDraft.warranty_type || null,
        warranty_provider: warrantyDraft.warranty_provider.trim() || null,
        warranty_notes: warrantyDraft.warranty_notes.trim() || null,
      };
      const { error } = await supabase.from("devices").update(payload).eq("id", d.id);
      if (error) throw error;
      setD({ ...d, ...payload });
      setEditingWarranty(false);
      toast.success("Garanzia aggiornata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio garanzia");
    } finally {
      setSavingWarranty(false);
    }
  }

  function startWarrantyEdit() {
    if (!d) return;
    setWarrantyDraft({
      purchase_date: toDateInputValue(d.purchase_date),
      warranty_expiry_date: toDateInputValue(d.warranty_expiry_date),
      warranty_type: (d.warranty_type as WarrantyType) || "standard",
      warranty_provider: d.warranty_provider ?? "",
      warranty_notes: d.warranty_notes ?? "",
    });
    setEditingWarranty(true);
  }

  async function saveRepairCost(ticket: TicketRow) {
    if (!canEdit) return;
    const current = ticket.repair_cost == null ? "" : String(ticket.repair_cost);
    const raw = window.prompt(`Costo riparazione per ${ticket.ticket_code}`, current);
    if (raw === null) return;
    const value = raw.trim() ? Number(raw.replace(",", ".")) : null;
    if (value !== null && !Number.isFinite(value)) return toast.error("Costo non valido");
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ repair_cost: value })
        .eq("id", ticket.id);
      if (error) throw error;
      setTickets((prev) =>
        prev.map((row) => (row.id === ticket.id ? { ...row, repair_cost: value } : row)),
      );
      toast.success("Costo riparazione aggiornato");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio costo");
    }
  }

  async function saveHardware() {
    if (!d || !session?.access_token) return;
    setSavingHardware(true);
    try {
      const payload = hardwareDraftToPayload(hardwareDraft);
      const { error } = await supabase.from("devices").update(payload).eq("id", d.id);
      if (error) throw error;
      setD({ ...d, ...payload });
      setEditingHardware(false);
      toast.success("Specifiche hardware aggiornate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio hardware");
    } finally {
      setSavingHardware(false);
    }
  }

  function startHardwareEdit() {
    if (!d) return;
    setHardwareDraft(deviceToHardwareDraft(d));
    setEditingHardware(true);
    setActiveTab("hardware");
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
      <div
        className="mb-4 rounded-xl border p-3"
        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-accent">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold leading-tight">
              {d.brand ? `${d.brand} ` : ""}
              {d.model}
            </div>
            <div className="font-mono text-[11px] text-text3">
              Asset · {d.id} · SN {d.serial || "—"}
            </div>
          </div>
          <DeviceStatusPill status={d.status} large />
          <span
            className="rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            {d.client?.name || "Cliente non assegnato"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setActiveTab("info")}>
            Modifica
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() =>
              navigator.clipboard
                ?.writeText(`${window.location.origin}/inventory?device=${d.id}`)
                .then(() => toast.success("Link dispositivo copiato"))
            }
          >
            <QrCode className="h-3 w-3" /> Genera QR
          </button>
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => openCreate()}>
            <TicketPlus className="h-3 w-3" /> Assegna ticket
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={statusSaving}
            onClick={() => void commitDeviceStatus("maintenance")}
          >
            <Wrench className="h-3 w-3" /> Sposta in manutenzione
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b" style={{ borderColor: "var(--border)" }}>
        {(
          [
            ["info", "Informazioni"],
            ["hardware", "Hardware"],
            ["maintenance", "Manutenzione"],
            ["tickets", `Ticket (${tickets.length})`],
            ["history", "Storico"],
          ] as [DeviceDetailTab, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className="px-3 py-2 text-sm font-semibold transition-colors"
            style={{
              color: activeTab === tab ? "var(--accent)" : "var(--text2)",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
            }}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "info" && (
        <>
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
              <div className="pc-label">Brand / seriale</div>
              <div className="text-[13px]">
                {d.brand || "—"} · <span className="font-mono">{d.serial || "—"}</span>
              </div>
            </div>
            <div>
              <div className="pc-label">Tipo dispositivo</div>
              <div className="text-[13px]">{d.device_type || "—"}</div>
            </div>
            <div>
              <div className="pc-label">Localizzazione</div>
              <div className="text-[13px]">{formatLocation(d)}</div>
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

          <div
            className="mb-4 p-3 rounded-lg"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <div className="pc-label">Garanzia</div>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-text2">
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      color: warrantyMeta.color,
                      background: warrantyMeta.background,
                      borderColor: warrantyMeta.color,
                    }}
                  >
                    {warrantyMeta.label}
                  </span>
                  <span>{warrantyRemainingText}</span>
                  {warrantyBar.percent !== null ? <span>({warrantyBar.percent}%)</span> : null}
                </div>
              </div>
              {canEdit && !editingWarranty ? (
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={startWarrantyEdit}>
                  Rinova garanzia
                </button>
              ) : null}
            </div>

            {editingWarranty ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs">
                  <span className="pc-label">Data acquisto</span>
                  <input
                    type="date"
                    className="pc-input mt-1 w-full"
                    value={warrantyDraft.purchase_date}
                    onChange={(e) =>
                      setWarrantyDraft((v) => ({ ...v, purchase_date: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="pc-label">Scadenza garanzia</span>
                  <input
                    type="date"
                    className="pc-input mt-1 w-full"
                    value={warrantyDraft.warranty_expiry_date}
                    onChange={(e) =>
                      setWarrantyDraft((v) => ({ ...v, warranty_expiry_date: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs">
                  <span className="pc-label">Tipo garanzia</span>
                  <select
                    className="pc-input mt-1 w-full"
                    value={warrantyDraft.warranty_type}
                    onChange={(e) =>
                      setWarrantyDraft((v) => ({
                        ...v,
                        warranty_type: e.target.value as WarrantyType,
                      }))
                    }
                  >
                    {WARRANTY_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  <span className="pc-label">Fornitore / URL</span>
                  <input
                    className="pc-input mt-1 w-full"
                    value={warrantyDraft.warranty_provider}
                    onChange={(e) =>
                      setWarrantyDraft((v) => ({ ...v, warranty_provider: e.target.value }))
                    }
                    placeholder="Dell, HP, rivenditore o https://..."
                  />
                </label>
                <label className="text-xs md:col-span-2">
                  <span className="pc-label">Note garanzia / contratto</span>
                  <textarea
                    className="pc-input mt-1 min-h-[70px] w-full"
                    value={warrantyDraft.warranty_notes}
                    onChange={(e) =>
                      setWarrantyDraft((v) => ({ ...v, warranty_notes: e.target.value }))
                    }
                    placeholder="Numero contratto, condizioni, riferimenti..."
                  />
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    disabled={savingWarranty}
                    onClick={saveWarranty}
                  >
                    <Save className="h-3 w-3" />{" "}
                    {savingWarranty ? "Salvataggio..." : "Salva garanzia"}
                  </button>
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm"
                    onClick={() => setEditingWarranty(false)}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-[12.5px] md:grid-cols-4">
                  <div>
                    <div className="pc-label">Acquisto</div>
                    <div>{d.purchase_date ? fmtDate(d.purchase_date) : "—"}</div>
                  </div>
                  <div>
                    <div className="pc-label">Scadenza</div>
                    <div>{d.warranty_expiry_date ? fmtDate(d.warranty_expiry_date) : "—"}</div>
                  </div>
                  <div>
                    <div className="pc-label">Tipo</div>
                    <div>
                      {WARRANTY_TYPES.find((type) => type.value === d.warranty_type)?.label ??
                        d.warranty_type ??
                        "—"}
                    </div>
                  </div>
                  <div>
                    <div className="pc-label">Fornitore</div>
                    {isProbablyUrl(d.warranty_provider) ? (
                      <a
                        className="text-accent hover:underline"
                        href={d.warranty_provider!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Link garanzia
                      </a>
                    ) : (
                      <div>{d.warranty_provider || "—"}</div>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-text3">
                    <span>Avanzamento copertura</span>
                    <span>{warrantyRemainingText}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full"
                    style={{ background: "var(--surface3)" }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${warrantyBar.percent ?? 0}%`,
                        background: warrantyMeta.color,
                      }}
                    />
                  </div>
                  {d.warranty_notes ? (
                    <div className="mt-2 text-[12px] text-text2 whitespace-pre-wrap">
                      {d.warranty_notes}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div
            className="mb-4 rounded-lg p-3"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            <div className="pc-label mb-2">Costi (TCO)</div>
            <div className="grid grid-cols-3 gap-2 text-[12.5px]">
              <div>
                <div className="text-text3">Costo acquisto</div>
                <div className="font-mono font-semibold">{formatCurrency(purchaseCost)}</div>
              </div>
              <div>
                <div className="text-text3">Riparazioni</div>
                <div className="font-mono font-semibold">{formatCurrency(repairCosts)}</div>
                <div className="text-[11px] text-text3">
                  {maintenanceTickets.length} ticket manutenzione con {formatCurrency(repairCosts)}{" "}
                  registrati
                </div>
              </div>
              <div>
                <div className="text-text3">TCO stimato</div>
                <div className="font-mono font-semibold">{formatCurrency(tco)}</div>
              </div>
            </div>
          </div>

          <div
            className="mb-4 rounded-lg p-3"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="pc-label">Checklist associate</div>
              <div className="text-xs text-text3 font-mono">{checklistSummaries.length}</div>
            </div>
            <div className="flex flex-col gap-2">
              {checklistSummaries.map((checklist) => (
                <button
                  key={`${checklist.ticketId}-${checklist.name}`}
                  type="button"
                  className="rounded-md border p-2 text-left hover:bg-background/80"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => openTicketDetail(checklist.ticketId)}
                >
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="font-semibold">{checklist.name}</span>
                    <span className="font-mono text-text3">
                      {checklist.completed}/{checklist.total}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--surface3)" }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${checklist.percent}%`,
                        background: checklist.percent === 100 ? "var(--success)" : "var(--accent)",
                      }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-text3">
                    Ticket {checklist.ticketCode} · ultima esecuzione{" "}
                    {fmtDateTime(checklist.updatedAt)}
                  </div>
                </button>
              ))}
              {!checklistSummaries.length && (
                <div className="py-3 text-center text-sm text-text3">
                  Nessuna checklist associata ai ticket di questo dispositivo.
                </div>
              )}
            </div>
          </div>

          {d.notes !== undefined && (
            <div
              className="flex items-start justify-between gap-2 mb-4 p-3 rounded-lg"
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
                      <span className="text-text3 italic">
                        Nessuna nota tecnica{canEdit ? " — clicca per aggiungere" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "hardware" && (
        <HardwareTab
          device={d}
          draft={hardwareDraft}
          setDraft={setHardwareDraft}
          editing={editingHardware}
          saving={savingHardware}
          canEdit={canEdit}
          systemHealth={systemHealth}
          onEdit={startHardwareEdit}
          onCancel={() => {
            setHardwareDraft(deviceToHardwareDraft(d));
            setEditingHardware(false);
          }}
          onSave={saveHardware}
        />
      )}

      {activeTab === "maintenance" && (
        <div
          className="mb-4 p-3 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <MaintenanceSchedulePanel
            deviceId={d.id}
            currentUserId={session?.user?.id}
            canEdit={canEdit}
          />
        </div>
      )}

      {activeTab === "history" && (
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
                      <span className="font-mono text-[11px] text-text3">
                        {fmtDateTime(item.at)}
                      </span>
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
      )}

      {activeTab === "tickets" && (
        <div
          className="mb-4 p-3 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="pc-label">Ticket collegati</div>
            <div className="text-xs text-text3 font-mono">
              {openTickets.length} ticket aperti · {closedTickets.length} ticket chiusi
            </div>
          </div>
          <OverflowTable className="mt-3">
            <OverflowTable>
              <table className="w-full text-[12px]">
              <thead>
                <tr>
                  {[
                    "Codice",
                    "Titolo",
                    "Stato",
                    "Tecnico",
                    "Data apertura",
                    "Data chiusura",
                    "Costo riparazione",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => {
                  const open = !isClosedTicket(ticket);
                  return (
                    <tr
                      key={ticket.id}
                      className="cursor-pointer border-b hover:bg-background/80"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => openTicketDetail(ticket.id)}
                    >
                      <td className="px-3 py-2 font-mono font-semibold">{ticket.ticket_code}</td>
                      <td className="px-3 py-2">
                        {ticket.notes?.slice(0, 70) ||
                          TICKET_TYPE_LABEL[ticket.ticket_type as TicketType] ||
                          ticket.ticket_type}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            open
                              ? "rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800"
                              : "text-text3"
                          }
                        >
                          {STATUS_META[ticket.status as keyof typeof STATUS_META]?.label ??
                            ticket.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{ticket.assignee?.full_name || "—"}</td>
                      <td className="px-3 py-2">{fmtDateTime(ticket.created_at)}</td>
                      <td className="px-3 py-2">
                        {ticket.closed_at ? fmtDateTime(ticket.closed_at) : "—"}
                      </td>
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        {ticket.ticket_type === "maintenance" ? (
                          <button
                            type="button"
                            className="font-mono text-accent hover:underline"
                            onClick={() => void saveRepairCost(ticket)}
                          >
                            {ticket.repair_cost == null
                              ? "Inserisci"
                              : formatCurrency(ticket.repair_cost)}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!tickets.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text3">
                      Nessun ticket collegato a questo dispositivo.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </OverflowTable>
          </OverflowTable>
        </div>
      )}

      <AlertDialog
        open={confirmStatusOpen}
        onOpenChange={(open) => {
          setConfirmStatusOpen(open);
          if (!open) setPendingStatus(null);
        }}
      >
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

function DeviceStatusPill({ status, large = false }: { status: string; large?: boolean }) {
  const colors: Record<string, { color: string; background: string }> = {
    available: { color: pcReadyColors.success, background: pcReadyColors.successLight },
    assigned: { color: pcReadyColors.primary, background: pcReadyColors.primaryLight },
    maintenance: { color: pcReadyColors.warning, background: pcReadyColors.warningLight },
    retired: { color: pcReadyColors.textSecondary, background: pcReadyColors.slateLight },
  };
  const meta = colors[status] ?? { color: "var(--text2)", background: "var(--surface2)" };
  return (
    <span
      className={`inline-flex rounded-full border font-semibold ${large ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      style={{ color: meta.color, background: meta.background, borderColor: meta.color }}
    >
      {DEVICE_STATUS_LABEL[status as DeviceInventoryStatus] ?? formatDeviceStatus(status)}
    </span>
  );
}

function HardwareTab({
  device,
  draft,
  setDraft,
  editing,
  saving,
  canEdit,
  systemHealth,
  onEdit,
  onCancel,
  onSave,
}: {
  device: DeviceRow;
  draft: HardwareDraft;
  setDraft: Dispatch<SetStateAction<HardwareDraft>>;
  editing: boolean;
  saving: boolean;
  canEdit: boolean;
  systemHealth: ReturnType<typeof computeSystemHealth>;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const update = (key: keyof HardwareDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ background: systemHealth.background, color: systemHealth.color }}
          >
            <Cpu className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Stato sistema: {systemHealth.label}</div>
            <div className="text-xs text-text3">{systemHealth.description}</div>
          </div>
          {canEdit && !editing ? (
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={onEdit}>
              Modifica hardware
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="grid gap-3 md:grid-cols-3">
            <HardwareInput
              label="CPU"
              value={draft.cpu_name}
              onChange={(v) => update("cpu_name", v)}
            />
            <HardwareInput
              label="Frequenza GHz"
              type="number"
              value={draft.cpu_frequency_ghz}
              onChange={(v) => update("cpu_frequency_ghz", v)}
            />
            <HardwareInput
              label="Core"
              type="number"
              value={draft.cpu_cores}
              onChange={(v) => update("cpu_cores", v)}
            />
            <HardwareInput
              label="RAM GB"
              type="number"
              value={draft.ram_gb}
              onChange={(v) => update("ram_gb", v)}
            />
            <HardwareInput
              label="Tipo RAM"
              value={draft.ram_type}
              onChange={(v) => update("ram_type", v)}
            />
            <HardwareInput
              label="Freq. RAM MHz"
              type="number"
              value={draft.ram_frequency_mhz}
              onChange={(v) => update("ram_frequency_mhz", v)}
            />
            <HardwareInput
              label="Storage tipo"
              value={draft.storage_type}
              onChange={(v) => update("storage_type", v)}
            />
            <HardwareInput
              label="Storage GB"
              type="number"
              value={draft.storage_capacity_gb}
              onChange={(v) => update("storage_capacity_gb", v)}
            />
            <HardwareInput
              label="Drive"
              type="number"
              value={draft.storage_drive_count}
              onChange={(v) => update("storage_drive_count", v)}
            />
            <HardwareInput
              label="Sistema operativo"
              value={draft.os}
              onChange={(v) => update("os", v)}
            />
            <HardwareInput
              label="Versione OS"
              value={draft.os_version}
              onChange={(v) => update("os_version", v)}
            />
            <HardwareInput
              label="Architettura"
              value={draft.os_architecture}
              onChange={(v) => update("os_architecture", v)}
            />
            <HardwareInput
              label="Risoluzione"
              value={draft.screen_resolution}
              onChange={(v) => update("screen_resolution", v)}
            />
            <HardwareInput
              label="Dimensione schermo"
              type="number"
              value={draft.screen_size_inches}
              onChange={(v) => update("screen_size_inches", v)}
            />
            <HardwareInput
              label="Tipo schermo"
              value={draft.screen_type}
              onChange={(v) => update("screen_type", v)}
            />
            <HardwareInput label="Wi‑Fi" value={draft.wifi} onChange={(v) => update("wifi", v)} />
            <HardwareInput
              label="Ethernet"
              value={draft.ethernet}
              onChange={(v) => update("ethernet", v)}
            />
            <HardwareInput
              label="Bluetooth"
              value={draft.bluetooth}
              onChange={(v) => update("bluetooth", v)}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={saving} onClick={onSave}>
              <Save className="h-3 w-3" /> {saving ? "Salvataggio..." : "Salva hardware"}
            </button>
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onCancel}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <HardwareSection
            icon={<Cpu className="h-4 w-4" />}
            title="CPU"
            rows={[
              ["Nome", device.cpu_name],
              ["Frequenza", device.cpu_frequency_ghz ? `${device.cpu_frequency_ghz} GHz` : null],
              ["Core", device.cpu_cores],
            ]}
          />
          <HardwareSection
            icon={<Cpu className="h-4 w-4" />}
            title="RAM"
            rows={[
              ["Totale", device.ram_gb ? `${device.ram_gb} GB` : null],
              ["Tipo", device.ram_type],
              ["Frequenza", device.ram_frequency_mhz ? `${device.ram_frequency_mhz} MHz` : null],
            ]}
          />
          <HardwareSection
            icon={<HardDrive className="h-4 w-4" />}
            title="Storage"
            rows={[
              ["Tipo", device.storage_type],
              ["Capacità", device.storage_capacity_gb ? `${device.storage_capacity_gb} GB` : null],
              ["Drive", device.storage_drive_count],
            ]}
          />
          <HardwareSection
            icon={<Monitor className="h-4 w-4" />}
            title="Sistema operativo"
            rows={[
              ["Nome", device.os],
              ["Versione", device.os_version],
              ["Architettura", device.os_architecture],
            ]}
          />
          <HardwareSection
            icon={<Monitor className="h-4 w-4" />}
            title="Schermo"
            rows={[
              ["Risoluzione", device.screen_resolution],
              ["Dimensione", device.screen_size_inches ? `${device.screen_size_inches}"` : null],
              ["Tipo", device.screen_type],
            ]}
          />
          <HardwareSection
            icon={<Network className="h-4 w-4" />}
            title="Connettività"
            rows={[
              ["Wi‑Fi", device.wifi],
              ["Ethernet", device.ethernet],
              ["Bluetooth", device.bluetooth],
            ]}
          />
        </div>
      )}
    </div>
  );
}

function HardwareInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-xs">
      <span className="pc-label">{label}</span>
      <input
        className="pc-input mt-1 w-full"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function HardwareSection({
  icon,
  title,
  rows,
}: {
  icon: ReactNode;
  title: string;
  rows: [string, unknown][];
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="grid gap-1 text-[12.5px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-text3">{label}</span>
            <span className="text-right font-medium">
              {value == null || value === "" ? "—" : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function emptyHardwareDraft(): HardwareDraft {
  return {
    cpu_name: "",
    cpu_frequency_ghz: "",
    cpu_cores: "",
    ram_gb: "",
    ram_type: "",
    ram_frequency_mhz: "",
    storage_type: "",
    storage_capacity_gb: "",
    storage_drive_count: "",
    os: "",
    os_version: "",
    os_architecture: "",
    screen_resolution: "",
    screen_size_inches: "",
    screen_type: "",
    wifi: "",
    ethernet: "",
    bluetooth: "",
  };
}

function deviceToHardwareDraft(device: DeviceRow): HardwareDraft {
  return {
    cpu_name: device.cpu_name ?? "",
    cpu_frequency_ghz: stringifyNumber(device.cpu_frequency_ghz),
    cpu_cores: stringifyNumber(device.cpu_cores),
    ram_gb: stringifyNumber(device.ram_gb),
    ram_type: device.ram_type ?? "",
    ram_frequency_mhz: stringifyNumber(device.ram_frequency_mhz),
    storage_type: device.storage_type ?? "",
    storage_capacity_gb: stringifyNumber(device.storage_capacity_gb),
    storage_drive_count: stringifyNumber(device.storage_drive_count),
    os: device.os ?? "",
    os_version: device.os_version ?? "",
    os_architecture: device.os_architecture ?? "",
    screen_resolution: device.screen_resolution ?? "",
    screen_size_inches: stringifyNumber(device.screen_size_inches),
    screen_type: device.screen_type ?? "",
    wifi: device.wifi ?? "",
    ethernet: device.ethernet ?? "",
    bluetooth: device.bluetooth ?? "",
  };
}

function hardwareDraftToPayload(draft: HardwareDraft) {
  return {
    cpu_name: draft.cpu_name.trim() || null,
    cpu_frequency_ghz: numberOrNull(draft.cpu_frequency_ghz),
    cpu_cores: numberOrNull(draft.cpu_cores),
    ram_gb: numberOrNull(draft.ram_gb),
    ram_type: draft.ram_type.trim() || null,
    ram_frequency_mhz: numberOrNull(draft.ram_frequency_mhz),
    storage_type: draft.storage_type.trim() || null,
    storage_capacity_gb: numberOrNull(draft.storage_capacity_gb),
    storage_drive_count: numberOrNull(draft.storage_drive_count),
    os: draft.os.trim() || null,
    os_version: draft.os_version.trim() || null,
    os_architecture: draft.os_architecture.trim() || null,
    screen_resolution: draft.screen_resolution.trim() || null,
    screen_size_inches: numberOrNull(draft.screen_size_inches),
    screen_type: draft.screen_type.trim() || null,
    wifi: draft.wifi.trim() || null,
    ethernet: draft.ethernet.trim() || null,
    bluetooth: draft.bluetooth.trim() || null,
  };
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stringifyNumber(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function isClosedTicket(ticket: TicketRow) {
  return Boolean(ticket.closed_at) || ["ready", "completed", "archived"].includes(ticket.status);
}

function formatLocation(device: DeviceRow) {
  return (
    [device.location_office, device.location_floor, device.location_desk]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

function buildChecklistSummary(ticket: TicketRow) {
  const structure = parseTicketChecklistStructure(ticket.checklist_structure);
  const state = parseTicketChecklistState(ticket.checklist);
  const progress = structureOverallProgress(state, structure);
  if (!progress.total) return [];
  return [
    {
      ticketId: ticket.id,
      ticketCode: ticket.ticket_code,
      name: ticket.template?.name || `Checklist ${ticket.ticket_code}`,
      completed: progress.done,
      total: progress.total,
      percent: progress.pct,
      updatedAt: ticket.updated_at,
    },
  ];
}

function parseTicketChecklistStructure(raw: unknown): ChecklistStructure {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as ChecklistStructure;
  return DEFAULT_STRUCTURE;
}

function parseTicketChecklistState(raw: unknown): ChecklistState {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as ChecklistState;
  return {};
}

function computeSystemHealth(device: DeviceRow | null, openTickets: TicketRow[]) {
  const hardwareOpen = openTickets.some((ticket) =>
    [ticket.ticket_type, ticket.category, ticket.notes].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes("hardware"),
    ),
  );
  if (hardwareOpen)
    return {
      label: "Critico",
      color: pcReadyColors.danger,
      background: pcReadyColors.dangerLight,
      description: "Ticket hardware aperti o criticità attive.",
    };
  if ((device?.ram_gb ?? 0) > 0 && (device?.ram_gb ?? 0) < 8)
    return {
      label: "Da aggiornare",
      color: pcReadyColors.warning,
      background: pcReadyColors.warningLight,
      description: "Specifiche sotto soglia configurabile: RAM inferiore a 8GB.",
    };
  if (
    (device?.ram_gb ?? 0) >= 16 &&
    String(device?.storage_type || "")
      .toLowerCase()
      .includes("ssd")
  )
    return {
      label: "Ottimo",
      color: pcReadyColors.success,
      background: pcReadyColors.successLight,
      description: "Hardware moderno e nessun ticket hardware recente.",
    };
  return {
    label: "Normale",
    color: pcReadyColors.primary,
    background: pcReadyColors.primaryLight,
    description: "Specifiche standard, nessun segnale critico.",
  };
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
  if (kind === "assignment") return pcReadyColors.primary;
  if (kind === "ticket") return pcReadyColors.purple;
  if (kind === "maintenance") return pcReadyColors.warning;
  if (kind === "note") return pcReadyColors.textSecondary;
  if (kind === "status") return pcReadyColors.success;
  return "var(--accent)";
}

export default DeviceDetailModal;
