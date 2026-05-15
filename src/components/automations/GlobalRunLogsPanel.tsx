import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/pcready";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  FlaskConical,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AutomationRunLog } from "@/lib/automation-runs";
import type { AutomationRule } from "@/types/automation";

interface GlobalLogEntry extends AutomationRunLog {
  automation_flows?: { name: string };
}

export function GlobalRunLogsPanel({
  logs,
  loading,
  rules,
  filters,
  onFilterChange,
  onRefresh,
  onExportCsv,
}: {
  logs: GlobalLogEntry[];
  loading: boolean;
  rules: AutomationRule[];
  filters: { ruleId: string; status: string; dateFrom: string; dateTo: string };
  onFilterChange: (f: typeof filters) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
}) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const ruleMap = new Map(rules.map((r) => [r.id, r]));

  return (
    <div className="rounded-xl border border-border bg-surface2 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Log esecuzioni globali</span>
          {logs.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {logs.length}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={onExportCsv} disabled={logs.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          className="rounded-md border px-2 py-1 text-xs"
          value={filters.ruleId}
          onChange={(e) => onFilterChange({ ...filters, ruleId: e.target.value })}
        >
          <option value="">Tutte le regole</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border px-2 py-1 text-xs"
          value={filters.status}
          onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
        >
          <option value="">Tutti gli esiti</option>
          <option value="success">Successo</option>
          <option value="error">Errore</option>
          <option value="dry_run">Dry-run</option>
          <option value="skipped">Saltato</option>
        </select>
        <DateRangePicker
          from={filters.dateFrom}
          to={filters.dateTo}
          onChange={(from, to) => onFilterChange({ ...filters, dateFrom: from, dateTo: to })}
        />
      </div>

      {loading && (
        <div className="py-6 text-center text-sm text-text3">Caricamento log...</div>
      )}
      {!loading && logs.length === 0 && (
        <div className="py-6 text-center text-sm text-text3">Nessun log trovato</div>
      )}
      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Regola</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Esito</TableHead>
                <TableHead>Durata</TableHead>
                <TableHead>Errore</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const ruleName = log.automation_flows?.name ?? ruleMap.get(log.automation_id)?.name ?? log.automation_id;
                return (
                  <>
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedLogId(expandedLogId === log.id ? null : log.id)
                      }
                    >
                      <TableCell>
                        {expandedLogId === log.id ? (
                          <ChevronDown className="h-4 w-4 text-text3" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-text3" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{ruleName}</TableCell>
                      <TableCell className="text-xs text-text3">
                        {log.triggered_by ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-text3">
                        {timeAgo(log.triggered_at)}
                      </TableCell>
                      <TableCell>
                        <LogStatusBadge status={log.status} isDryRun={log.is_dry_run} />
                      </TableCell>
                      <TableCell className="text-xs font-mono text-text3">
                        {log.duration_ms != null ? `${log.duration_ms} ms` : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-red-600">
                        {log.error_message ?? ""}
                      </TableCell>
                    </TableRow>
                    {expandedLogId === log.id && (
                      <TableRow key={`${log.id}-detail`}>
                        <TableCell colSpan={7}>
                          <div className="rounded-lg border border-border bg-background/60 p-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
                                  Payload trigger
                                </div>
                                <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-100 p-2 font-mono text-[11px]">
                                  {JSON.stringify(log.trigger_payload ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
                                  Dettagli esecuzione
                                </div>
                                <div className="mt-1 space-y-1 text-xs">
                                  <div>
                                    <span className="text-text3">ID:</span>{" "}
                                    <span className="font-mono">{log.id}</span>
                                  </div>
                                  <div>
                                    <span className="text-text3">Automation ID:</span>{" "}
                                    <span className="font-mono">{log.automation_id}</span>
                                  </div>
                                  <div>
                                    <span className="text-text3">Timestamp:</span>{" "}
                                    {log.triggered_at}
                                  </div>
                                  <div>
                                    <span className="text-text3">Dry-run:</span>{" "}
                                    {log.is_dry_run ? "Si" : "No"}
                                  </div>
                                </div>
                              </div>
                            </div>
                            {log.actions_executed && log.actions_executed.length > 0 && (
                              <div className="mt-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
                                  Azioni eseguite
                                </div>
                                <div className="mt-1 space-y-1.5">
                                  {log.actions_executed.map((action, idx) => (
                                    <div
                                      key={idx}
                                      className={cn(
                                        "rounded-md border p-2 text-xs",
                                        action.status === "success" &&
                                          "border-green-200 bg-green-50",
                                        action.status === "error" && "border-red-200 bg-red-50",
                                        action.status === "skipped" &&
                                          "border-slate-200 bg-slate-50",
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">{action.action}</span>
                                        <Badge
                                          className={cn(
                                            "text-[10px] border-transparent",
                                            action.status === "success" &&
                                              "bg-emerald-100 text-emerald-700",
                                            action.status === "error" &&
                                              "bg-red-100 text-red-700",
                                            action.status === "skipped" &&
                                              "bg-slate-100 text-slate-600",
                                          )}
                                        >
                                          {action.status}
                                        </Badge>
                                      </div>
                                      {action.error && (
                                        <div className="mt-1 text-red-700">{action.error}</div>
                                      )}
                                      {action.result !== undefined && (
                                        <pre className="mt-1 max-h-20 overflow-auto rounded bg-slate-100 p-1.5 font-mono text-[11px]">
                                          {JSON.stringify(action.result, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {log.error_message && (
                              <div className="mt-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                                  Errore
                                </div>
                                <div className="mt-1 rounded-md bg-red-50 p-2 text-xs text-red-700">
                                  {log.error_message}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LogStatusBadge({
  status,
  isDryRun,
}: {
  status: string;
  isDryRun?: boolean;
}) {
  const Icon =
    status === "error"
      ? XCircle
      : status === "skipped"
        ? MinusCircle
        : isDryRun || status === "dry_run"
          ? FlaskConical
          : CheckCircle2;
  return (
    <Badge
      className={cn(
        "border-transparent text-[10px]",
        status === "error" && "bg-red-100 text-red-800",
        status === "success" && "bg-emerald-100 text-emerald-800",
        status === "dry_run" && "bg-blue-100 text-blue-800",
        status === "skipped" && "bg-slate-100 text-slate-700",
      )}
    >
      <Icon className="mr-1 h-3 w-3" />
      {status === "dry_run" ? "dry-run" : status === "success" ? "OK" : status}
    </Badge>
  );
}
