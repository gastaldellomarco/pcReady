import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = join(root, "src");
const localesDir = join(srcDir, "i18n", "locales");

function loadJson(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); }
  catch { return {}; }
}

function flattenKeys(obj, prefix = "") {
  const result = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      for (const sub of flattenKeys(v, path)) result.add(sub);
    } else {
      result.add(path);
    }
  }
  return result;
}

function setNested(obj, path, value) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Walk source files to extract used keys per namespace
import { readFileSync as rfs, readdirSync as rds, statSync } from "fs";

function walkDir(dir) {
  const results = [];
  for (const entry of rds(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(srcDir);
const usedKeys = {};

for (const file of files) {
  const content = readFileSync(file, "utf8");
  let defaultNs = null;
  const utMatch = content.match(/useTranslation\(\s*["']([^"']+)["']\s*\)/);
  if (utMatch) defaultNs = utMatch[1];
  
  const tCalls = content.matchAll(/\bt\(\s*["']([^"']+)["']/g);
  for (const match of tCalls) {
    let key = match[1];
    let ns = defaultNs;
    if (key.includes(":")) {
      const parts = key.split(":");
      ns = parts[0];
      key = parts.slice(1).join(":");
    }
    if (!ns) continue;
    if (!usedKeys[ns]) usedKeys[ns] = new Set();
    usedKeys[ns].add(key);
  }
}

// Load existing translation files
const enDir = join(localesDir, "en");
const itDir = join(localesDir, "it");
const enFiles = {};
const itFiles = {};

for (const f of readdirSync(enDir).filter(f => f.endsWith(".json"))) {
  const ns = f.replace(".json", "");
  enFiles[ns] = loadJson(join(enDir, f));
}
for (const f of readdirSync(itDir).filter(f => f.endsWith(".json"))) {
  const ns = f.replace(".json", "");
  itFiles[ns] = loadJson(join(itDir, f));
}

// Smart English key generation from key path
function keyToEnglish(key) {
  // Handle special cases first
  const specialCases = {
    "status.": "Status",
    "priority.": "Priority",
    "type.": "Type",
    "nav.": "Nav",
    "pageTitle.": "Page Title",
    "search.label": "Search",
    "loading": "Loading...",
    "loadingMore": "Loading more...",
    "allLoaded": "All loaded",
    "archiveTableLabel": "Archive",
    "oauth.appName": "App name",
    // Tickets
    "sla.breached": "SLA Breached",
    "sla.ok": "SLA OK",
    "status.expiring": "Expiring",
    "addDevice.activityAdded": "Activity added",
    "device.warranty.notSet": "Not set",
    "device.warranty.expiredDays": "Expired {{count}} days ago",
    "device.warranty.expiresToday": "Expires today",
    "device.warranty.expiresInDays": "Expires in {{count}} days",
    "device.toasts.identityUpdated": "Identity updated",
    "device.toasts.identitySaveError": "Error saving identity",
    "device.toasts.repairCostError": "Error saving repair cost",
    "device.info.unassignedClient": "Unassigned",
    "device.os": "OS",
    "device.codes": "Codes",
    "device.codesHint": "Enter serial or asset tag",
    "device.assetTag": "Asset tag",
    "device.serial": "Serial",
    "device.serialPlaceholder": "Enter serial",
    "device.brand": "Brand",
    "device.category": "Category",
    "device.location": "Location",
    "device.created": "Created",
    "device.lastEvent": "Last event",
    "device.renewWarranty": "Renew warranty",
    "device.purchaseDate": "Purchase date",
    "device.warrantyExpiry": "Warranty expiry",
    "device.warrantyType": "Warranty type",
    "device.warrantyProvider": "Warranty provider",
    "device.warrantyProviderPlaceholder": "Provider name or URL",
    "device.warrantyNotes": "Warranty notes",
    "device.warrantyNotesPlaceholder": "Contract details...",
    "device.warrantyLink": "Warranty link",
    "device.coverageProgress": "Coverage progress",
    "detail.checklistTemplateLabel": "Template",
    "detail.statusLabel": "Status",
    "detail.assigneeLabel": "Assignee",
    "detail.relative.loading": "Loading...",
    "notes.noteLabel": "Note",
    "relations.typeLabel": "Type",
    "timeTracking.descriptionLabel": "Description",
    "timeTracking.activityLabel": "Activity",
    "toasts.adminOnly": "Admin only",
    "toasts.unauthorized": "Unauthorized",
    "history.assignedTo": "Assigned to",
    "bulk.others": "+{{count}} others",
    "meta.updateButton": "Update",
    "meta.dateFrom": "From",
    "meta.dateTo": "To",
    "meta.of": "of",
    "meta.history": "History",
    "meta.selected": "selected",
    "bulk.changeStatus": "Change status",
    "bulk.reassign": "Reassign",
    "bulk.changePriority": "Change priority",
    "bulk.pendingDays": "Pending days",
    // Inventory
    "filters.warranty": "Warranty",
    "filters.withoutTicket": "Without ticket",
    "filters.notUpdatedX": "Not updated",
    "filters.statusLabel": "Status",
    "filters.osLabel": "OS",
    "filters.categoryLabel": "Category",
    "filters.typeLabel": "Type",
    "filters.searchLabel": "Search",
    "filters.updatedLabel": "Updated",
    "filters.warrantyLabel": "Warranty",
    "counts.selected": "{{count}} selected",
    "loading.more": "Loading more...",
    "counts.allLoaded": "All loaded",
    "bulkStatus.statusLabel": "Status",
    "bulkClient.clientLabel": "Client",
    "counts.interventions": "{{count}} interventions",
    // Dashboard
    "widgets.loadError": "Error loading widgets",
    "widgets.kanbanWip.title": "Kanban WIP",
    "widgets.kanbanWip.totalTickets": "Total tickets",
    "widgets.refresh": "Refresh",
    "widgets.refreshLabel": "Refresh",
    "widgets.kanbanWip.limitLabel": "Limit",
    "widgets.kanbanWip.overLimit": "Over limit",
    "widgets.kanbanWip.noLimit": "No limit",
    "widgets.kanbanWip.noTickets": "No tickets",
    "widgets.kanbanWip.openKanban": "Open kanban",
    "widgets.teamActivityError": "Error loading team activity",
    "widgets.activeTooltipAria": "Active",
    "widgets.activeTooltip": "Active",
    "heatmap.error": "Error loading heatmap",
    "radar.error": "Error loading radar",
    "technicians.statsError": "Error loading stats",
    "technicians.activeTooltipAria": "Active",
    "technicians.activeTooltip": "Active",
    "widgets.kanban-wip-limits.label": "Kanban WIP limits",
    "widgets.kanban-wip-limits.desc": "Configure work-in-progress limits per column",
    "widgets.closePanel": "Close",
  };

  if (specialCases[key]) return specialCases[key];

  // Auto-generate from last path segment
  const last = key.split(".").pop();
  if (!last) return key;
  
  // Convert camelCase/PascalCase to words
  const words = last
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  
  // Capitalize first letter for labels
  if (words.length > 0) {
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return last;
}

// Smart Italian key generation
function keyToItalian(key, enValue) {
  const specialCases = {
    "status.": "Stato",
    "priority.": "Priorità",
    "type.": "Tipo",
    "nav.": "Navigazione",
    "pageTitle.": "Titolo pagina",
    "search.label": "Cerca",
    "loading": "Caricamento...",
    "loadingMore": "Caricamento...",
    "allLoaded": "Tutto caricato",
    "archiveTableLabel": "Archivio",
    "oauth.appName": "Nome app",
    // Tickets
    "sla.breached": "SLA Violato",
    "sla.ok": "SLA OK",
    "status.expiring": "In scadenza",
    "addDevice.activityAdded": "Attività aggiunta",
    "device.warranty.notSet": "Non impostata",
    "device.warranty.expiredDays": "Scaduta {{count}} giorni fa",
    "device.warranty.expiresToday": "Scade oggi",
    "device.warranty.expiresInDays": "Scade tra {{count}} giorni",
    "device.toasts.identityUpdated": "Identità aggiornata",
    "device.toasts.identitySaveError": "Errore salvataggio identità",
    "device.toasts.repairCostError": "Errore salvataggio costo riparazione",
    "device.info.unassignedClient": "Non assegnato",
    "device.os": "OS",
    "device.codes": "Codici",
    "device.codesHint": "Inserisci seriale o asset tag",
    "device.assetTag": "Asset tag",
    "device.serial": "Seriale",
    "device.serialPlaceholder": "Inserisci seriale",
    "device.brand": "Marca",
    "device.category": "Categoria",
    "device.location": "Posizione",
    "device.created": "Creato",
    "device.lastEvent": "Ultimo evento",
    "device.renewWarranty": "Rinnova garanzia",
    "device.purchaseDate": "Data acquisto",
    "device.warrantyExpiry": "Scadenza garanzia",
    "device.warrantyType": "Tipo garanzia",
    "device.warrantyProvider": "Fornitore garanzia",
    "device.warrantyProviderPlaceholder": "Nome fornitore o URL",
    "device.warrantyNotes": "Note garanzia",
    "device.warrantyNotesPlaceholder": "Dettagli contratto...",
    "device.warrantyLink": "Link garanzia",
    "device.coverageProgress": "Avanzamento copertura",
    "detail.checklistTemplateLabel": "Template",
    "detail.statusLabel": "Stato",
    "detail.assigneeLabel": "Assegnatario",
    "detail.relative.loading": "Caricamento...",
    "notes.noteLabel": "Nota",
    "relations.typeLabel": "Tipo",
    "timeTracking.descriptionLabel": "Descrizione",
    "timeTracking.activityLabel": "Attività",
    "toasts.adminOnly": "Solo admin",
    "toasts.unauthorized": "Non autorizzato",
    "history.assignedTo": "Assegnato a",
    "bulk.others": "+{{count}} altri",
    "meta.updateButton": "Aggiorna",
    "meta.dateFrom": "Da",
    "meta.dateTo": "A",
    "meta.of": "di",
    "meta.history": "Storico",
    "meta.selected": "selezionati",
    "bulk.changeStatus": "Cambia stato",
    "bulk.reassign": "Riassegna",
    "bulk.changePriority": "Cambia priorità",
    "bulk.pendingDays": "Giorni in attesa",
    // Inventory
    "filters.warranty": "Garanzia",
    "filters.withoutTicket": "Senza ticket",
    "filters.notUpdatedX": "Non aggiornato",
    "filters.statusLabel": "Stato",
    "filters.osLabel": "OS",
    "filters.categoryLabel": "Categoria",
    "filters.typeLabel": "Tipo",
    "filters.searchLabel": "Cerca",
    "filters.updatedLabel": "Aggiornato",
    "filters.warrantyLabel": "Garanzia",
    "counts.selected": "{{count}} selezionati",
    "loading.more": "Caricamento...",
    "counts.allLoaded": "Tutto caricato",
    "bulkStatus.statusLabel": "Stato",
    "bulkClient.clientLabel": "Cliente",
    "counts.interventions": "{{count}} interventi",
    // Dashboard
    "widgets.loadError": "Errore caricamento widget",
    "widgets.kanbanWip.title": "Kanban WIP",
    "widgets.kanbanWip.totalTickets": "Ticket totali",
    "widgets.refresh": "Aggiorna",
    "widgets.refreshLabel": "Aggiorna",
    "widgets.kanbanWip.limitLabel": "Limite",
    "widgets.kanbanWip.overLimit": "Sopra il limite",
    "widgets.kanbanWip.noLimit": "Nessun limite",
    "widgets.kanbanWip.noTickets": "Nessun ticket",
    "widgets.kanbanWip.openKanban": "Apri kanban",
    "widgets.teamActivityError": "Errore caricamento attività team",
    "widgets.activeTooltipAria": "Attivo",
    "widgets.activeTooltip": "Attivo",
    "heatmap.error": "Errore caricamento mappa calore",
    "radar.error": "Errore caricamento radar",
    "technicians.statsError": "Errore caricamento statistiche",
    "technicians.activeTooltipAria": "Attivo",
    "technicians.activeTooltip": "Attivo",
    "widgets.kanban-wip-limits.label": "Limiti WIP Kanban",
    "widgets.kanban-wip-limits.desc": "Configura limiti work-in-progress per colonna",
    "widgets.closePanel": "Chiudi",
  };

  if (specialCases[key]) return specialCases[key];

  // For Italian, use the English value as fallback if no Italian translation exists
  return enValue;
}

// Process each namespace
let totalFixed = 0;

for (const [ns, keys] of Object.entries(usedKeys).sort()) {
  const enObj = enFiles[ns];
  const itObj = itFiles[ns] || {};
  
  if (!enObj) {
    console.log(`[${ns}] No EN file — skipping`);
    continue;
  }
  
  const enSet = flattenKeys(enObj);
  const itSet = flattenKeys(itObj);
  
  const missingEn = [...keys].filter(k => !enSet.has(k));
  const missingIt = [...keys].filter(k => !itSet.has(k));
  
  if (missingEn.length === 0 && missingIt.length === 0) {
    continue;
  }
  
  console.log(`\n[${ns}] Adding ${missingEn.length} EN + ${missingIt.length} IT keys`);
  
  // Add missing EN keys
  for (const key of missingEn) {
    const enVal = keyToEnglish(key);
    setNested(enObj, key, enVal);
  }
  
  // Add missing IT keys
  for (const key of missingIt) {
    const enVal = keyToEnglish(key);
    const itVal = keyToItalian(key, enVal);
    setNested(itObj, key, itVal);
  }
  
  totalFixed += missingEn.length + missingIt.length;
}

// Write back all modified files
for (const [ns, obj] of Object.entries(enFiles)) {
  writeFileSync(join(enDir, `${ns}.json`), JSON.stringify(obj, null, 2) + "\n");
}
for (const [ns, obj] of Object.entries(itFiles)) {
  writeFileSync(join(itDir, `${ns}.json`), JSON.stringify(obj, null, 2) + "\n");
}

console.log(`\nDone. Total keys added: ${totalFixed}`);
