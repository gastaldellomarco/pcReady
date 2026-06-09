import { pcReadyColors } from "@/lib/design-system";

/**
 *
 */
export type TicketStatus =
  | "pending"
  | "in-progress"
  | "testing"
  | "ready"
  | "completed"
  | "archived";
/**
 *
 */
export type TicketPriority = "high" | "med" | "low";
/**
 *
 */
export type TicketType = "device" | "support" | "maintenance" | "other";

// SLA limits in hours per priority. `SlaLimits` is kept for backwards compatibility
// and represents the resolution target. New code should use `SlaConfig`.
/**
 *
 */
export type SlaLimits = Record<TicketPriority, number>;
/**
 *
 */
export type SlaPriorityConfig = { responseHours: number; resolutionHours: number };
/**
 *
 */
export type SlaConfig = Record<TicketPriority, SlaPriorityConfig>;

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  high: { responseHours: 1, resolutionHours: 4 },
  med: { responseHours: 4, resolutionHours: 24 },
  low: { responseHours: 24, resolutionHours: 72 },
};

export const DEFAULT_SLA_LIMITS: SlaLimits = {
  high: DEFAULT_SLA_CONFIG.high.resolutionHours,
  med: DEFAULT_SLA_CONFIG.med.resolutionHours,
  low: DEFAULT_SLA_CONFIG.low.resolutionHours,
};

/**
 *
 */
export function slaConfigToLimits(config?: SlaConfig | null): SlaLimits {
  return {
    high: config?.high?.resolutionHours ?? DEFAULT_SLA_LIMITS.high,
    med: config?.med?.resolutionHours ?? DEFAULT_SLA_LIMITS.med,
    low: config?.low?.resolutionHours ?? DEFAULT_SLA_LIMITS.low,
  };
}

export const STATUS_META: Record<
  TicketStatus,
  { label: string; cls: string; next: TicketStatus | null; color: string }
> = {
  pending: {
    label: "In attesa",
    cls: "pc-badge-pending",
    next: "in-progress",
    color: pcReadyColors.warning,
  },
  "in-progress": {
    label: "In lavorazione",
    cls: "pc-badge-inprog",
    next: "testing",
    color: pcReadyColors.primary,
  },
  testing: { label: "Testing", cls: "pc-badge-testing", next: "ready", color: pcReadyColors.info },
  ready: {
    label: "Pronto",
    cls: "pc-badge-ready",
    next: "completed",
    color: pcReadyColors.success,
  },
  completed: {
    label: "Completato",
    cls: "pc-badge-completed",
    next: "archived",
    color: pcReadyColors.success,
  },
  archived: {
    label: "Archiviato",
    cls: "pc-badge-archived",
    next: null,
    color: pcReadyColors.textMuted,
  },
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  high: "Alta",
  med: "Media",
  low: "Bassa",
};

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  device: "Preparazione PC",
  support: "Assistenza tecnica",
  maintenance: "Manutenzione",
  other: "Altro",
};

export const TICKET_TYPE_META: Record<TicketType, { label: string; cls: string; color: string }> = {
  device: {
    label: TICKET_TYPE_LABEL.device,
    cls: "pc-ticket-type-device",
    color: pcReadyColors.primary,
  },
  support: {
    label: TICKET_TYPE_LABEL.support,
    cls: "pc-ticket-type-support",
    color: pcReadyColors.success,
  },
  maintenance: {
    label: TICKET_TYPE_LABEL.maintenance,
    cls: "pc-ticket-type-maintenance",
    color: pcReadyColors.warning,
  },
  other: {
    label: TICKET_TYPE_LABEL.other,
    cls: "pc-ticket-type-other",
    color: pcReadyColors.purple,
  },
};

/** Stati inventario dispositivi (DB enum device_status). */
export type DeviceInventoryStatus = "available" | "assigned" | "maintenance" | "retired";

export const DEVICE_STATUS_LABEL: Record<DeviceInventoryStatus, string> = {
  available: "Disponibile",
  assigned: "Assegnato",
  maintenance: "In manutenzione",
  retired: "Dismesso",
};

/**
 *
 */
export function formatDeviceStatus(status: string): string {
  return DEVICE_STATUS_LABEL[status as DeviceInventoryStatus] ?? status;
}

export const OS_OPTIONS = ["Windows 11 Pro", "Windows 10 Pro", "Ubuntu 22.04 LTS", "macOS (BYOD)"];

export const CHECKLIST_TEMPLATE = {
  os: [
    { id: "os1", text: "Formattazione disco e partizionamento" },
    { id: "os2", text: "Installazione OS (immagine gold)" },
    { id: "os3", text: "Attivazione licenza Windows/macOS" },
    { id: "os4", text: "Driver chipset, display, audio aggiornati" },
    { id: "os5", text: "Windows Update completati" },
    { id: "os6", text: "Hostname e dominio configurati" },
    { id: "os7", text: "Account utente locale e AD creati" },
  ],
  software: [
    { id: "sw1", text: "Microsoft 365 installato e attivato" },
    { id: "sw2", text: "Browser aziendale configurato" },
    { id: "sw3", text: "Teams e comunicazione installati" },
    { id: "sw4", text: "Software specifici richiesti installati" },
    { id: "sw5", text: "PDF reader aziendale" },
    { id: "sw6", text: "VPN client configurato" },
  ],
  security: [
    { id: "sec1", text: "Antivirus installato e aggiornato" },
    { id: "sec2", text: "BitLocker / FileVault abilitato" },
    { id: "sec3", text: "Policy sicurezza applicate via GPO/MDM" },
    { id: "sec4", text: "Firewall Windows attivo" },
    { id: "sec5", text: "2FA configurato per account aziendali" },
  ],
  network: [
    { id: "net1", text: "Connettività LAN verificata" },
    { id: "net2", text: "WiFi aziendale configurato" },
    { id: "net3", text: "VPN testata e funzionante" },
    { id: "net4", text: "Stampanti e drive di rete mappati" },
    { id: "net5", text: "Email aziendale configurata e testata" },
  ],
} as const;

/**
 *
 */
export type ChecklistKey = keyof typeof CHECKLIST_TEMPLATE;
export const CHECKLIST_TABS: { key: ChecklistKey; label: string }[] = [
  { key: "os", label: "Setup OS" },
  { key: "software", label: "Software" },
  { key: "security", label: "Sicurezza" },
  { key: "network", label: "Rete" },
];

// --- Checklist personalizzate (dinamiche) ----------------------------------
/**
 *
 */
export interface ChecklistItemDef {
  id: string;
  text: string;
  type?: "checkbox" | "text" | "number";
  required?: boolean;
}
/**
 *
 */
export interface ChecklistSection {
  label: string;
  items: ChecklistItemDef[];
  assigned_to?: string | null;
}
/**
 *
 */
export interface ChecklistGroup {
  label: string;
  collapsed?: boolean;
  sections: Record<string, ChecklistSection>;
}
/**
 *
 */
export type ChecklistStructure = Record<string, ChecklistGroup>;

// Keep ChecklistTabDef as alias for backward compat with older references
/**
 *
 */
export type ChecklistTabDef = ChecklistSection;

export const DEFAULT_STRUCTURE: ChecklistStructure = {
  default_group: {
    label: "Generale",
    sections: Object.fromEntries(
      CHECKLIST_TABS.map((t) => [
        t.key,
        { label: t.label, items: [...CHECKLIST_TEMPLATE[t.key]] as ChecklistItemDef[] },
      ]),
    ),
  },
};

/**
 *
 */
export function structureProgress(
  state: ChecklistState,
  struct: ChecklistStructure,
  groupKey: string,
) {
  const group = struct[groupKey];
  if (!group?.sections) return { done: 0, total: 1, pct: 0 };
  let done = 0,
    total = 0;
  for (const secKey of Object.keys(group.sections)) {
    const items = group.sections[secKey].items;
    total += items.length;
    done += items.filter((i) => state[secKey]?.[i.id]).length;
  }
  return { done, total: total || 1, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 *
 */
export function structureOverallProgress(state: ChecklistState, struct: ChecklistStructure) {
  let done = 0,
    total = 0;
  for (const groupKey of Object.keys(struct)) {
    const group = struct[groupKey];
    if (!group?.sections) continue;
    for (const secKey of Object.keys(group.sections)) {
      const items = group.sections[secKey].items;
      total += items.length;
      done += items.filter((i) => state[secKey]?.[i.id]).length;
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 *
 */
export function avatarColors(initials?: string | null): { bg: string; fg: string } {
  // deterministic palette
  const palette = [
    { bg: "#DDD6FE", fg: "#4C1D95" },
    { bg: "#FEE2E2", fg: "#991B1B" },
    { bg: "#D1FAE5", fg: "#065F46" },
    { bg: "#FEF3C7", fg: "#92400E" },
    { bg: "#DBEAFE", fg: "#1E3A8A" },
    { bg: "#FCE7F3", fg: "#9D174D" },
  ];
  let h = 0;
  const chars = initials || "U";
  for (let i = 0; i < chars.length; i++) h = (h * 31 + chars.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/**
 *
 */
export function fmtDate(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

/**
 *
 */
export function fmtDateTime(s?: string | Date | null): string {
  if (!s) return "-";
  const d = typeof s === "string" ? new Date(s) : s;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "-";
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  // Respect application default timezone if set in client cache
  const clientSettings = (globalThis as any).__APP_SETTINGS__ as
    | { default_timezone?: string }
    | undefined;
  const timeZone = clientSettings?.default_timezone || undefined;
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone });
  if (isToday) return `Oggi ${time}`;
  if (isYest) return `Ieri ${time}`;
  // For full date, pass timezone to locale formatting where possible
  const dateStr = d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", timeZone });
  return `${dateStr} ${time}`;
}

/**
 *
 */
export interface ChecklistState {
  [tab: string]: { [itemId: string]: boolean };
}

/**
 *
 */
export function checklistProgress(
  state: ChecklistState,
  key: ChecklistKey,
): { done: number; total: number; pct: number } {
  const items = CHECKLIST_TEMPLATE[key];
  const done = items.filter((i) => state[key]?.[i.id]).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

/**
 *
 */
export function generatePrepScript(t: {
  model: string;
  serial?: string | null;
  os?: string | null;
  software?: string | null;
}): string {
  return `# PCReady — Script preparazione PC
# Modello: ${t.model}
# Seriale: ${t.serial || "—"}
# OS:      ${t.os || "—"}

Set-ExecutionPolicy -Scope Process Bypass -Force

Write-Host "▶ Verifica connettività..."
Test-Connection -ComputerName 8.8.8.8 -Count 2

Write-Host "▶ Aggiornamento Windows..."
Install-Module PSWindowsUpdate -Force -ErrorAction SilentlyContinue
Get-WindowsUpdate -AcceptAll -Install -AutoReboot

Write-Host "▶ Installazione software richiesti..."
${
  (t.software || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (sw) =>
        `winget install --silent --accept-package-agreements --accept-source-agreements "${sw}"`,
    )
    .join("\n") || "# Nessun software specificato"
}

Write-Host "▶ Configurazione policy di sicurezza..."
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly -SkipHardwareTest -ErrorAction SilentlyContinue
Set-MpPreference -DisableRealtimeMonitoring $false

Write-Host "✔ Preparazione completata. Riavvio consigliato."
`;
}

/**
 *
 */
export type SlaStatus = "ok" | "warning" | "overdue";

/**
 *
 */
export function computeSlaStatus(
  createdAt: string | Date,
  priority: TicketPriority,
  slaLimits?: SlaLimits,
  deadline?: string | Date | null,
  breached?: boolean | null,
): { status: SlaStatus; limitHours: number; deadline: Date; remainingMs: number } {
  const limits = slaLimits ?? DEFAULT_SLA_LIMITS;
  const limitHours = limits[priority] ?? DEFAULT_SLA_LIMITS[priority];
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const due = deadline
    ? typeof deadline === "string"
      ? new Date(deadline)
      : deadline
    : new Date(created.getTime() + limitHours * 60 * 60 * 1000);
  const now = new Date();
  const totalMs = Math.max(1, due.getTime() - created.getTime());
  const remainingMs = due.getTime() - now.getTime();

  if (breached || remainingMs <= 0) {
    return { status: "overdue", limitHours, deadline: due, remainingMs };
  }
  if (remainingMs <= totalMs * 0.2) {
    return { status: "warning", limitHours, deadline: due, remainingMs };
  }
  return { status: "ok", limitHours, deadline: due, remainingMs };
}

/**
 *
 */
export function formatSlaCountdown(deadline?: string | Date | null): string {
  if (!deadline) return "SLA non impostato";
  const due = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (!(due instanceof Date) || Number.isNaN(due.getTime())) return "SLA non valido";
  const diffMs = due.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(0, Math.floor(absMs / (1000 * 60)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts =
    days > 0 ? `${days}g ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diffMs >= 0 ? `Scade tra ${parts}` : `Scaduto da ${parts}`;
}

/**
 *
 */
export function formatOpenDuration(s?: string | Date | null): string {
  if (!s) return "-";
  const d = typeof s === "string" ? new Date(s) : s;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "-";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours < 1) return `${minutes}m`;
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}g ${remHours}h`;
}

/**
 *
 */
export function timeAgo(s?: string | Date | null): string {
  if (!s) return "-";
  const d = typeof s === "string" ? new Date(s) : s;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "-";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "pochi secondi fa";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} giorni fa`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} settimane fa`;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}
