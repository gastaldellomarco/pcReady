import { useState } from "react";
import { FileText, Search, Download, ChevronDown, ChevronRight, Info, AlertTriangle, XCircle, RefreshCw, Clock, AlertCircle, Calendar, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useAdminAudit, type DatePreset } from "@/hooks/useAdminAudit";
import type { ActivityLogEntry } from "@/lib/audit-log";

// ---- Helpers ----

function getActionBadge(actionType: string | null | undefined): { label: string; color: string } {
  if (!actionType) return { label: "SISTEMA", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" };

  if (actionType.includes("created") || actionType.includes("invited")) return { label: "CREAZIONE", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" };
  if (actionType.includes("deleted") || actionType.includes("revoked") || actionType.includes("disabled")) return { label: "ELIMINAZIONE", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  if (actionType.includes("status_changed") || actionType.includes("assigned") || actionType.includes("updated") || actionType.includes("enabled") || actionType.includes("rotated")) return { label: "MODIFICA", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" };
  if (actionType.includes("login") || actionType.includes("logout") || actionType.includes("link_generated") || actionType.includes("link_revoked")) return { label: "ACCESSO", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" };
  if (actionType.includes("failed") || actionType.includes("error")) return { label: "ERRORE", color: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200" };

  return { label: actionType.toUpperCase(), color: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" };
}

function getSeverityIcon(severity: string | null | undefined) {
  switch (severity) {
    case "critical": return <XCircle className="h-4 w-4 text-red-500" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default: return <Info className="h-4 w-4 text-blue-400" />;
  }
}

function getEntityLabel(entityType: string | null | undefined): string {
  const map: Record<string, string> = {
    ticket: "Ticket",
    client: "Cliente",
    device: "Dispositivo",
    user: "Utente",
    technician: "Tecnico",
    automation: "Automazione",
    system: "Sistema",
    oauth: "OAuth",
    setting: "Impostazione",
    email_template: "Email Template",
  };
  return entityType ? (map[entityType.toLowerCase()] ?? entityType) : "-";
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("it-IT"),
    time: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
}

// ---- KPI Card ----

function KpiCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
        {icon}
      </div>
      <div>
        <div className="text-xs text-text3">{label}</div>
        <div className="text-xl font-bold" style={{ color: accent }}>{value}</div>
      </div>
    </div>
  );
}

// ---- Diff View ----

function DiffView({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  if (!oldValue && !newValue) {
    return <div className="text-sm text-text3 py-2">Nessun dato modifica disponibile</div>;
  }

  const oldObj = oldValue && typeof oldValue === "object" ? oldValue as Record<string, unknown> : null;
  const newObj = newValue && typeof newValue === "object" ? newValue as Record<string, unknown> : null;
  const allKeys = new Set([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);

  if (allKeys.size === 0) {
    return <div className="text-sm text-text3 py-2">Nessun dettaglio modifica disponibile</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
        <div className="font-semibold mb-2 text-red-600 dark:text-red-400">Prima</div>
        <div className="space-y-1 rounded-lg p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
          {Array.from(allKeys).map((key) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium text-text3 w-24 shrink-0">{key}:</span>
              <span className="text-text2">{oldObj ? String(JSON.stringify(oldObj[key]) ?? "-") : "-"}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-semibold mb-2 text-emerald-600 dark:text-emerald-400">Dopo</div>
        <div className="space-y-1 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          {Array.from(allKeys).map((key) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium text-text3 w-24 shrink-0">{key}:</span>
              <span className="text-text2">{newObj ? String(JSON.stringify(newObj[key]) ?? "-") : "-"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Row Detail ----

function RowDetail({ entry }: { entry: ActivityLogEntry }) {
  return (
    <div className="px-6 py-4 space-y-4 bg-surface2/50 rounded-b-xl border-t">
      {/* Diff */}
      {Boolean(entry.old_value || entry.new_value) && (
        <div>
          <div className="text-xs font-semibold mb-2 text-text3 uppercase tracking-wide">Dettaglio modifica</div>
          <DiffView oldValue={entry.old_value} newValue={entry.new_value} />
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {entry.ip_address && (
          <div>
            <span className="text-text3">IP:</span>{" "}
            <span className="font-mono text-text2">{entry.ip_address}</span>
          </div>
        )}
        {entry.session_id && (
          <div>
            <span className="text-text3">Sessione:</span>{" "}
            <span className="font-mono text-text2">{entry.session_id.slice(0, 12)}...</span>
          </div>
        )}
        {entry.entity_type && entry.entity_id && (
          <div>
            <span className="text-text3">Entita:</span>{" "}
            <span className="font-medium text-accent">
              {getEntityLabel(entry.entity_type)} #{entry.entity_id.slice(0, 8)}
            </span>
          </div>
        )}
        <div>
          <span className="text-text3">ID Evento:</span>{" "}
          <span className="font-mono text-text2">{entry.id.slice(0, 12)}...</span>
        </div>
      </div>

      {/* Entity link */}
      {entry.entity_type && entry.entity_id && (
        <div className="pt-1">
          <Button variant="outline" size="sm" className="text-xs gap-1.5">
            <FileText className="h-3 w-3" />
            Apri {getEntityLabel(entry.entity_type)} #{entry.entity_id.slice(0, 8)}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Audit Row ----

function AuditTableRow({ entry, isExpanded, onToggle, index }: { entry: ActivityLogEntry; isExpanded: boolean; onToggle: () => void; index: number }) {
  const badge = getActionBadge(entry.action_type);
  const { time } = formatTimestamp(entry.created_at);
  const sevIcon = getSeverityIcon(entry.severity);
  const entityLabel = getEntityLabel(entry.entity_type);

  return (
    <>
      <TableRow
        onClick={onToggle}
        className={cn(
          "cursor-pointer transition-colors",
          index % 2 === 0 ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/60 dark:bg-zinc-900/40",
          entry.severity === "critical" && "!bg-red-50/60 dark:!bg-red-950/30",
          entry.severity === "warning" && "!bg-amber-50/60 dark:!bg-amber-950/30",
          isExpanded && "!bg-muted/40",
        )}
      >
        <TableCell className="py-3 pl-3 w-[24px]">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </TableCell>
        <TableCell className="py-3 w-[32px]">{sevIcon}</TableCell>
        <TableCell className="py-3 whitespace-nowrap w-[110px]">
          <span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", badge.color)}>
            {badge.label}
          </span>
        </TableCell>
        <TableCell className="py-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium leading-tight">{entry.actor_name || "Sistema"}</span>
            <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{entry.message}</span>
          </div>
        </TableCell>
        <TableCell className="py-3 w-[100px]">
          <span className="text-xs text-muted-foreground">{entityLabel}</span>
        </TableCell>
        <TableCell className="py-3 pr-4 w-[65px]">
          <span className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">{time}</span>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="p-0 border-0">
            <RowDetail entry={entry} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ---- Timeline Entry ----

function TimelineEntry({ entry }: { entry: ActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const badge = getActionBadge(entry.action_type);
  const { time } = formatTimestamp(entry.created_at);

  return (
    <div className="relative pl-8 pb-4 border-l-2 border-border last:border-0">
      <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-accent" />
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="text-xs font-mono text-text3 whitespace-nowrap mt-0.5">{time}</span>
        <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0", badge.color)}>
          {badge.label}
        </span>
        <span className="text-sm text-text2 flex-1">
          <span className="font-medium">{entry.actor_name}</span> — {entry.message}
        </span>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-text3 mt-1 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-text3 mt-1 shrink-0" />}
      </div>
      {expanded && (
        <div className="mt-2 ml-[4.5rem]">
          <RowDetail entry={entry} />
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

export function AdminAuditTab() {
  const { session, isAdmin } = useAuth();
  const accessToken = session?.access_token;
  const {
    auditEntries,
    auditTotal,
    auditPage,
    auditPageSize,
    totalPages,
    auditFilters,
    loadingAudit,
    kpi,
    userOptions,
    viewMode,
    setViewMode,
    datePreset,
    applyDatePreset,
    setAuditFilters,
    loadAudit,
    updateSearch,
    handleExportCsv,
    handleExportPdf,
    resetFilters,
    getTimelineGroups,
    setAuditPageSize,
  } = useAdminAudit({ accessToken, isAdmin });

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    updateSearch(value);
  };

  const setFilter = (key: string, value: string | undefined) => {
    const newFilters = { ...auditFilters, [key]: value || undefined };
    setAuditFilters(newFilters);
    loadAudit(1, newFilters);
  };

  const timelineGroups = getTimelineGroups();

  // Date preset buttons
  const presets: { label: string; value: DatePreset }[] = [
    { label: "Oggi", value: "today" },
    { label: "Ieri", value: "yesterday" },
    { label: "7gg", value: "last7" },
    { label: "30gg", value: "last30" },
  ];

  const actionTypeOptions = [
    { value: "ticket.created", label: "Creazione Ticket" },
    { value: "ticket.status_changed", label: "Modifica Ticket" },
    { value: "ticket.deleted", label: "Eliminazione Ticket" },
    { value: "device.created", label: "Creazione Dispositivo" },
    { value: "device.deleted", label: "Eliminazione Dispositivo" },
    { value: "client.created", label: "Creazione Cliente" },
    { value: "client.deleted", label: "Eliminazione Cliente" },
    { value: "user.invited", label: "Invito Utente" },
    { value: "user.disabled", label: "Disabilitazione Utente" },
  ];

  const entityTypeOptions = [
    { value: "ticket", label: "Ticket" },
    { value: "client", label: "Cliente" },
    { value: "device", label: "Dispositivo" },
    { value: "user", label: "Utente" },
    { value: "automation", label: "Automazione" },
    { value: "system", label: "Sistema" },
    { value: "oauth", label: "OAuth" },
    { value: "setting", label: "Impostazione" },
  ];

  return (
    <TabsContent value="audit" className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Eventi oggi"
          value={kpi.eventsToday}
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          accent="#3b82f6"
        />
        <KpiCard
          label="Ultimi 7 giorni"
          value={kpi.events7d}
          icon={<Calendar className="h-5 w-5 text-purple-500" />}
          accent="#8b5cf6"
        />
        <KpiCard
          label="Errori (24h)"
          value={kpi.recentErrors}
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          accent="#ef4444"
        />
      </div>

      {/* Search + Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                Log di Audit
              </CardTitle>
              <CardDescription>Registro delle attivita amministrative e di sistema</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setViewMode("table")}
                  className={cn("px-3 py-1.5 font-medium transition-colors", viewMode === "table" ? "bg-accent text-white" : "text-text3 hover:text-text2")}
                >
                  Tabella
                </button>
                <button
                  onClick={() => setViewMode("timeline")}
                  className={cn("px-3 py-1.5 font-medium transition-colors", viewMode === "timeline" ? "bg-accent text-white" : "text-text3 hover:text-text2")}
                >
                  Timeline
                </button>
              </div>

              {/* Export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Esporta
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCsv}>
                    <Download className="mr-2 h-4 w-4" />
                    Esporta CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPdf}>
                    <FileText className="mr-2 h-4 w-4" />
                    Report PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="ghost" size="sm" onClick={() => loadAudit(auditPage, auditFilters)} disabled={loadingAudit}>
                <RefreshCw className={cn("h-4 w-4", loadingAudit && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text3" />
              <Input
                placeholder="Cerca per utente, descrizione, ID entita..."
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Action type */}
              <select
                className="pc-input max-w-[180px] text-xs"
                value={auditFilters.actionType || ""}
                onChange={(e) => setFilter("actionType", e.target.value)}
              >
                <option value="">Tipo azione</option>
                {actionTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* User dropdown */}
              <select
                className="pc-input max-w-[160px] text-xs"
                value={auditFilters.user || ""}
                onChange={(e) => setFilter("user", e.target.value)}
              >
                <option value="">Tutti utenti</option>
                {userOptions.map((u) => (
                  <option key={u.actor_name} value={u.actor_name}>{u.actor_name} ({u.count})</option>
                ))}
              </select>

              {/* Entity type */}
              <select
                className="pc-input max-w-[150px] text-xs"
                value={auditFilters.entityType || ""}
                onChange={(e) => setFilter("entityType", e.target.value)}
              >
                <option value="">Tutte entita</option>
                {entityTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* Outcome */}
              <select
                className="pc-input max-w-[140px] text-xs"
                value={auditFilters.outcome || ""}
                onChange={(e) => setFilter("outcome", e.target.value)}
              >
                <option value="">Tutti esiti</option>
                <option value="info">Successo</option>
                <option value="warning">Warning</option>
                <option value="critical">Errore</option>
              </select>

              {/* Date from/to */}
              <Input
                type="date"
                value={auditFilters.dateFrom ? auditFilters.dateFrom.slice(0, 10) : ""}
                onChange={(e) => setFilter("dateFrom", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                className="max-w-[140px] text-xs"
                placeholder="Da"
              />
              <Input
                type="date"
                value={auditFilters.dateTo ? auditFilters.dateTo.slice(0, 10) : ""}
                onChange={(e) => setFilter("dateTo", e.target.value ? new Date(e.target.value + "T23:59:59.999Z").toISOString() : undefined)}
                className="max-w-[140px] text-xs"
                placeholder="A"
              />

              {/* Date presets */}
              <div className="flex gap-1">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => applyDatePreset(p.value)}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] font-medium transition-colors border",
                      datePreset === p.value
                        ? "bg-accent text-white border-accent"
                        : "text-text3 border-border hover:border-accent hover:text-accent",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Reset */}
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-xs">
                <RotateCcw className="h-3 w-3" />
                Azzera
              </Button>
            </div>

            {/* Content */}
            {loadingAudit ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2 text-text3">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Caricamento log...</span>
                </div>
              </div>
            ) : auditEntries.length === 0 ? (
              <div className="text-center py-12 text-text3">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nessuna attivita trovata</p>
                <p className="text-xs mt-1">Prova a modificare i filtri o azzerarli</p>
              </div>
            ) : viewMode === "table" ? (
              <>
                {/* Table View */}
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow className="bg-muted/50 dark:bg-muted/10">
                        <TableHead className="w-[24px] pl-3" />
                        <TableHead className="w-[32px]" />
                        <TableHead className="w-[110px]">Azione</TableHead>
                        <TableHead>Dettaglio</TableHead>
                        <TableHead className="w-[100px]">Entità</TableHead>
                        <TableHead className="w-[65px] pr-4 text-right">Ora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditEntries.map((entry, index) => (
                        <AuditTableRow
                          key={entry.id}
                          index={index}
                          entry={entry}
                          isExpanded={expandedRowId === entry.id}
                          onToggle={() => setExpandedRowId(expandedRowId === entry.id ? null : entry.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <>
                {/* Timeline View */}
                <div className="space-y-6">
                  {Array.from(timelineGroups.entries()).map(([dateLabel, entries]) => (
                    <div key={dateLabel}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-sm font-semibold text-text2 capitalize">{dateLabel}</div>
                        <div className="h-px flex-1 bg-border" />
                        <div className="text-[10px] text-text3 font-mono">{entries.length} eventi</div>
                      </div>
                      {entries.map((entry) => (
                        <TimelineEntry key={entry.id} entry={entry} />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination (only for table view) */}
            {viewMode === "table" && auditEntries.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text3">
                    Pagina {auditPage} di {totalPages} ({auditTotal} totale)
                  </span>
                  <select
                    className="pc-input max-w-[80px] text-xs"
                    value={auditPageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setAuditPageSize(newSize);
                      loadAudit(1, auditFilters);
                    }}
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => loadAudit(1, auditFilters)}
                    disabled={auditPage <= 1}
                    variant="outline"
                    size="sm"
                  >
                    Prima
                  </Button>
                  <Button
                    onClick={() => loadAudit(auditPage - 1, auditFilters)}
                    disabled={auditPage <= 1}
                    variant="outline"
                    size="sm"
                  >
                    Precedente
                  </Button>
                  <Button
                    onClick={() => loadAudit(auditPage + 1, auditFilters)}
                    disabled={auditPage >= totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Successivo
                  </Button>
                  <Button
                    onClick={() => loadAudit(totalPages, auditFilters)}
                    disabled={auditPage >= totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Ultima
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
