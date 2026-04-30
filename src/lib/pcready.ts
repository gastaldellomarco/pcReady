export type TicketStatus = "pending" | "in-progress" | "testing" | "ready";
export type TicketPriority = "high" | "med" | "low";

export const STATUS_META: Record<TicketStatus, { label: string; cls: string; next: TicketStatus | null; color: string }> = {
  "pending":     { label: "In attesa",      cls: "pc-badge-pending", next: "in-progress", color: "#EF9827" },
  "in-progress": { label: "In lavorazione", cls: "pc-badge-inprog",  next: "testing",     color: "#1B4FD8" },
  "testing":     { label: "Testing",        cls: "pc-badge-testing", next: "ready",       color: "#7C3AED" },
  "ready":       { label: "Pronto",         cls: "pc-badge-ready",   next: null,          color: "#16A34A" },
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  high: "Alta", med: "Media", low: "Bassa",
};

export const CLIENTS = ["Azienda Alpha", "Beta S.r.l.", "Gamma Consulting", "Delta Tech"];
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

export type ChecklistKey = keyof typeof CHECKLIST_TEMPLATE;
export const CHECKLIST_TABS: { key: ChecklistKey; label: string }[] = [
  { key: "os", label: "Setup OS" },
  { key: "software", label: "Software" },
  { key: "security", label: "Sicurezza" },
  { key: "network", label: "Rete" },
];

// --- Checklist personalizzate (dinamiche) ----------------------------------
export interface ChecklistItemDef { id: string; text: string }
export interface ChecklistTabDef { label: string; items: ChecklistItemDef[] }
export type ChecklistStructure = Record<string, ChecklistTabDef>;

export const DEFAULT_STRUCTURE: ChecklistStructure = Object.fromEntries(
  CHECKLIST_TABS.map(t => [t.key, { label: t.label, items: [...CHECKLIST_TEMPLATE[t.key]] as ChecklistItemDef[] }])
);

export function structureProgress(state: ChecklistState, struct: ChecklistStructure, key: string) {
  const items = struct[key]?.items ?? [];
  const done = items.filter(i => state[key]?.[i.id]).length;
  const total = items.length || 1;
  return { done, total: items.length, pct: Math.round((done / total) * 100) };
}

export function structureOverallProgress(state: ChecklistState, struct: ChecklistStructure) {
  let done = 0, total = 0;
  for (const k of Object.keys(struct)) {
    const items = struct[k].items;
    total += items.length;
    done += items.filter(i => state[k]?.[i.id]).length;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function avatarColors(initials: string): { bg: string; fg: string } {
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
  for (let i = 0; i < initials.length; i++) h = (h * 31 + initials.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function fmtDate(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function fmtDateTime(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Oggi ${time}`;
  if (isYest) return `Ieri ${time}`;
  return `${fmtDate(d)} ${time}`;
}

export interface ChecklistState {
  [tab: string]: { [itemId: string]: boolean };
}

export function checklistProgress(state: ChecklistState, key: ChecklistKey): { done: number; total: number; pct: number } {
  const items = CHECKLIST_TEMPLATE[key];
  const done = items.filter(i => state[key]?.[i.id]).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
}

export function generatePrepScript(t: { model: string; serial?: string | null; os?: string | null; software?: string | null }): string {
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
${(t.software || "")
  .split(/[,;\n]/)
  .map(s => s.trim()).filter(Boolean)
  .map(sw => `winget install --silent --accept-package-agreements --accept-source-agreements "${sw}"`)
  .join("\n") || "# Nessun software specificato"}

Write-Host "▶ Configurazione policy di sicurezza..."
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly -SkipHardwareTest -ErrorAction SilentlyContinue
Set-MpPreference -DisableRealtimeMonitoring $false

Write-Host "✔ Preparazione completata. Riavvio consigliato."
`;
}
