import { pcReadyColors } from "@/lib/design-system";
import {
  DEVICE_STATUS_LABEL,
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
import type { Json } from "@/integrations/supabase/types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DeviceRow {
  id: string;
  asset_tag: string | null;
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
  category: string | null;
  device_type: string | null;
  ip_address: string | null;
  mac_address: string | null;
  location: string | null;
  firmware_version: string | null;
  port_count: number | null;
  poe_supported: boolean | null;
  toner_model: string | null;
  page_count: number | null;
  print_technology: string | null;
  license_expiry: string | null;
  vlan_config: string | null;
  rack_position: string | null;
  server_role: string | null;
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

export interface AssignmentRow {
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

export interface TicketRow {
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

export interface HistoryRow {
  id: string;
  ticket_id: string | null;
  assignment_id: string | null;
  action: string;
  occurred_at: string;
  actor_id: string | null;
  changed_fields: unknown;
  notes: string | null;
}

export interface ActivityRow {
  id: string;
  created_at: string;
  message: string;
  ticket_id: string | null;
  actor_id: string | null;
  type: string;
}

export interface TimelineItem {
  id: string;
  at: string;
  kind: "device" | "assignment" | "ticket" | "status" | "maintenance" | "note";
  title: string;
  detail: string;
  operatorId?: string | null;
  operatorLabel?: string;
  ticketId?: string | null;
}

export const DEVICE_STATUS_OPTIONS: DeviceInventoryStatus[] = [
  "available",
  "assigned",
  "maintenance",
  "retired",
];

export const DEVICE_STATUS_OPTION_SET = new Set<string>(DEVICE_STATUS_OPTIONS);

export type DeviceDetailTab = "info" | "hardware" | "lifecycle" | "software" | "maintenance" | "tickets" | "history";
export type DeviceBarcodeTarget = "asset_tag" | "serial";

export type HardwareDraft = {
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
  ip_address: string;
  mac_address: string;
  firmware_version: string;
  port_count: string;
  poe_supported: string;
  toner_model: string;
  page_count: string;
  print_technology: string;
  vlan_config: string;
  license_expiry: string;
  rack_position: string;
  server_role: string;
};

// ── Identity / barcode helpers ──────────────────────────────────────────────

export function deviceIdentityInputId(target: DeviceBarcodeTarget) {
  return `device-identity-${target}`;
}

// ── Asset metadata ──────────────────────────────────────────────────────────

export function getAssetMetadataRows(device: DeviceRow): [string, string][] {
  const rows: [string, unknown][] = [];
  if (device.ip_address) rows.push(["IP", device.ip_address]);
  if (device.mac_address) rows.push(["MAC", device.mac_address]);
  if (device.location) rows.push(["Posizione", device.location]);
  if (device.firmware_version) rows.push(["Firmware", device.firmware_version]);
  if (device.category === "printing") {
    rows.push(
      ["Tecnologia", device.print_technology],
      ["Toner", device.toner_model],
      ["Contatore pagine", device.page_count],
    );
  }
  if (device.category === "network") {
    rows.push(
      ["Porte", device.port_count],
      ["PoE", device.poe_supported == null ? null : device.poe_supported ? "Sì" : "No"],
      ["VLAN", device.vlan_config],
      ["Scadenza licenza", device.license_expiry ? fmtDate(device.license_expiry) : null],
    );
  }
  if (device.category === "server_infra") {
    rows.push(
      ["Rack", device.rack_position],
      ["Ruolo", device.server_role],
      ["RAM", device.ram_gb ? `${device.ram_gb} GB` : null],
      ["Storage", device.storage_capacity_gb ? `${device.storage_capacity_gb} GB` : null],
    );
  }
  return rows
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => [label, String(value)]);
}

// ── Hardware draft helpers ──────────────────────────────────────────────────

export function emptyHardwareDraft(): HardwareDraft {
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
    ip_address: "",
    mac_address: "",
    firmware_version: "",
    port_count: "",
    poe_supported: "false",
    toner_model: "",
    page_count: "",
    print_technology: "",
    vlan_config: "",
    license_expiry: "",
    rack_position: "",
    server_role: "",
  };
}

export function deviceToHardwareDraft(device: DeviceRow): HardwareDraft {
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
    ip_address: device.ip_address ?? "",
    mac_address: device.mac_address ?? "",
    firmware_version: device.firmware_version ?? "",
    port_count: stringifyNumber(device.port_count),
    poe_supported: device.poe_supported ? "true" : "false",
    toner_model: device.toner_model ?? "",
    page_count: stringifyNumber(device.page_count),
    print_technology: device.print_technology ?? "",
    vlan_config: device.vlan_config ?? "",
    license_expiry: device.license_expiry ?? "",
    rack_position: device.rack_position ?? "",
    server_role: device.server_role ?? "",
  };
}

export function hardwareDraftToPayload(draft: HardwareDraft) {
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
    ip_address: draft.ip_address.trim() || null,
    mac_address: draft.mac_address.trim() || null,
    firmware_version: draft.firmware_version.trim() || null,
    port_count: numberOrNull(draft.port_count),
    poe_supported: draft.poe_supported === "true",
    toner_model: draft.toner_model.trim() || null,
    page_count: numberOrNull(draft.page_count),
    print_technology: draft.print_technology.trim() || null,
    vlan_config: draft.vlan_config.trim() || null,
    license_expiry: draft.license_expiry.trim() || null,
    rack_position: draft.rack_position.trim() || null,
    server_role: draft.server_role.trim() || null,
  };
}

export function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function stringifyNumber(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

// ── Ticket helpers ──────────────────────────────────────────────────────────

export function isClosedTicket(ticket: TicketRow) {
  return Boolean(ticket.closed_at) || ["ready", "completed", "archived"].includes(ticket.status);
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function formatLocation(device: DeviceRow) {
  return (
    [device.location_office, device.location_floor, device.location_desk]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

// ── Device status ───────────────────────────────────────────────────────────

export function isDeviceInventoryStatus(value: string): value is DeviceInventoryStatus {
  return DEVICE_STATUS_OPTION_SET.has(value);
}

export function getDeviceStatusOptions(currentStatus?: string | null) {
  const options = DEVICE_STATUS_OPTIONS.map((value) => ({
    value,
    label: DEVICE_STATUS_LABEL[value],
    legacy: false,
  }));

  if (currentStatus && !isDeviceInventoryStatus(currentStatus)) {
    return [
      {
        value: currentStatus,
        label: `${formatDeviceStatus(currentStatus)} (legacy)`,
        legacy: true,
      },
      ...options,
    ];
  }

  return options;
}

// ── Checklist summaries ─────────────────────────────────────────────────────

export function buildChecklistSummary(ticket: TicketRow) {
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

export function parseTicketChecklistStructure(raw: unknown): ChecklistStructure {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as ChecklistStructure;
  return DEFAULT_STRUCTURE;
}

export function parseTicketChecklistState(raw: unknown): ChecklistState {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as ChecklistState;
  return {};
}

// ── System health ───────────────────────────────────────────────────────────

export function computeSystemHealth(device: DeviceRow | null, openTickets: TicketRow[]) {
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

// ── Timeline helpers ────────────────────────────────────────────────────────

export function timelineKindLabel(kind: TimelineItem["kind"]): string {
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

export function timelineColor(kind: TimelineItem["kind"]) {
  if (kind === "assignment") return pcReadyColors.primary;
  if (kind === "ticket") return pcReadyColors.purple;
  if (kind === "maintenance") return pcReadyColors.warning;
  if (kind === "note") return pcReadyColors.textSecondary;
  if (kind === "status") return pcReadyColors.success;
  return "var(--accent)";
}

export function buildDeviceTimeline(input: {
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
    detail: `${device.model}${device.asset_tag ? ` · asset ${device.asset_tag}` : ""}${
      device.serial ? ` · S/N ${device.serial}` : ""
    }`,
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
        title: "Ticket collegato all'asset",
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

export function dedupeTimeline(items: TimelineItem[]): TimelineItem[] {
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

export function historyKind(action: string, entry: HistoryRow): TimelineItem["kind"] {
  if (action === "replaced") return "assignment";
  if (action === "deleted") return "assignment";
  if (action === "unassigned") return "assignment";
  if (action === "assigned") return "assignment";
  const msg = `${entry.notes ?? ""} ${JSON.stringify(entry.changed_fields ?? "")}`;
  if (/maintenance/i.test(msg)) return "maintenance";
  return "assignment";
}

export function historyTitle(action: string) {
  if (action === "assigned") return "Asset assegnato a un ticket";
  if (action === "unassigned") return "Assegnazione asset a ticket chiusa";
  if (action === "replaced") return "Sostituzione dispositivo sul ticket";
  if (action === "deleted") return "Assegnazione rimossa (record eliminato)";
  return action.replace(/_/g, " ");
}

export function historyDetail(entry: HistoryRow, ticketCodeById: Map<string, string>) {
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

export function activityKind(message: string, type: string): TimelineItem["kind"] {
  const m = message.toLowerCase();
  if (m.includes("stato") || m.includes("kanban")) return "status";
  if (m.includes("manutenzione") || type === "auto") return "status";
  if (m.includes("creato")) return "ticket";
  return "ticket";
}
