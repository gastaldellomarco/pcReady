import { AlertCircle, CheckCircle2, CircleDashed, FlaskConical } from "lucide-react";
import { fmtDateTime } from "@/lib/pcready";
import type { AutomationRunLog, RunLogStatus } from "@/lib/automation-runs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RunLogDrawerProps {
  logs: AutomationRunLog[];
  loading?: boolean;
}

export function RunLogDrawer({ logs, loading }: RunLogDrawerProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Storico run</div>
        <div className="text-xs text-text3">Ultime 20 esecuzioni</div>
      </div>
      {loading && <div className="py-6 text-center text-sm text-text3">Caricamento run...</div>}
      {!loading && !(Array.isArray(logs) ? logs : []).length && (
        <div className="py-6 text-center text-sm text-text3">Nessuna run registrata</div>
      )}
      <div className="space-y-2">
        {(Array.isArray(logs) ? logs : []).map((log) => (
          <details key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center gap-2">
                <RunStatusBadge status={log.status} isDryRun={log.is_dry_run} />
                <span className="text-sm font-medium">{fmtDateTime(log.triggered_at)}</span>
                <span className="ml-auto text-xs font-mono text-text3">
                  {log.duration_ms ?? 0} ms
                </span>
              </div>
              {log.error_message && (
                <div className="mt-2 text-xs text-red-700">{log.error_message}</div>
              )}
            </summary>
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
              <JsonBlock label="Trigger payload" value={log.trigger_payload} />
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text3">
                  Azioni eseguite
                </div>
                <div className="space-y-1.5">
                  {(log.actions_executed ?? []).map((action, index) => (
                    <div key={`${action.action}-${index}`} className="rounded-md bg-white p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{action.action}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 font-mono",
                            action.status === "success" && "bg-emerald-100 text-emerald-700",
                            action.status === "error" && "bg-red-100 text-red-700",
                            action.status === "skipped" && "bg-slate-100 text-slate-600",
                          )}
                        >
                          {action.status}
                        </span>
                      </div>
                      {action.error && <div className="mt-1 text-red-700">{action.error}</div>}
                      {action.result !== undefined && (
                        <pre className="mt-1 max-h-28 overflow-auto rounded bg-slate-100 p-2 font-mono text-[11px]">
                          {JSON.stringify(action.result, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function RunStatusBadge({
  status,
  isDryRun,
}: {
  status: RunLogStatus;
  isDryRun?: boolean;
}) {
  const Icon =
    status === "error"
      ? AlertCircle
      : status === "skipped"
        ? CircleDashed
        : isDryRun || status === "dry_run"
          ? FlaskConical
          : CheckCircle2;
  return (
    <Badge
      className={cn(
        "border-transparent",
        status === "error" && "bg-red-100 text-red-800",
        status === "success" && "bg-emerald-100 text-emerald-800",
        status === "dry_run" && "bg-blue-100 text-blue-800",
        status === "skipped" && "bg-slate-100 text-slate-700",
      )}
    >
      <Icon className="mr-1 h-3 w-3" />
      {status === "dry_run" ? "dry-run" : status}
    </Badge>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text3">{label}</div>
      <pre className="max-h-32 overflow-auto rounded bg-slate-100 p-2 font-mono text-[11px]">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}
