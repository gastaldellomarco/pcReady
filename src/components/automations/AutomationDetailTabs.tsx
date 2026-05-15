import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RunLogDrawer } from "@/components/automations/RunLogDrawer";
import { cn } from "@/lib/utils";
import type { AutomationRule } from "@/types/automation";
import type { AutomationRunLog, AutomationRunStats } from "@/lib/automation-runs";
import { TRIGGER_TYPE_LABELS } from "@/hooks/useAutomationRules";
import { timeAgo } from "@/lib/pcready";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  FlaskConical,
  ArrowRight,
  Activity,
  Zap,
} from "lucide-react";

export function AutomationDetailTabs({
  rule,
  stats,
  logs,
  logsLoading,
  logsOpen,
  onToggleLogs,
}: {
  rule: AutomationRule;
  stats?: AutomationRunStats;
  logs: AutomationRunLog[];
  logsLoading: boolean;
  logsOpen: boolean;
  onToggleLogs: () => void;
}) {
  const wizard = rule.flow_definition?.meta?.wizard;
  const triggerDef = wizard?.trigger_definition;
  const conditionsDef = wizard?.conditions_definition ?? [];
  const actionsDef = wizard?.actions_definition ?? [];
  const scheduleDef = wizard?.schedule_definition;

  const actionLabels: Record<string, string> = {
    send_email: "Invia email",
    update_ticket_status: "Aggiorna stato ticket",
    create_notification: "Notifica in-app",
    update_device_status: "Aggiorna stato dispositivo",
    assign_ticket: "Assegna ticket",
  };

  const conditionLabels: Record<string, string> = {
    field_equals: "Campo uguale a",
    priority_high: "Priorita alta",
    tag_contains: "Tag contiene",
  };

  return (
    <Tabs defaultValue="config" className="w-full">
      <TabsList className="w-full justify-start rounded-lg bg-muted/50 p-1">
        <TabsTrigger value="config" className="text-xs">
          Configurazione
        </TabsTrigger>
        <TabsTrigger value="logs" className="text-xs">
          Log esecuzioni
        </TabsTrigger>
        <TabsTrigger value="stats" className="text-xs">
          Statistiche
        </TabsTrigger>
      </TabsList>

      {/* Config tab */}
      <TabsContent value="config" className="mt-3 space-y-3">
        {rule.description && (
          <div className="rounded-lg border border-border bg-background/60 p-3 text-sm text-muted-foreground">
            {rule.description}
          </div>
        )}

        {/* Trigger card */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Trigger</span>
          </div>
          <p className="mt-1 text-sm text-blue-700">
            {triggerDef?.type
              ? TRIGGER_TYPE_LABELS[triggerDef.type] ?? triggerDef.type
              : "Non configurato"}
          </p>
          {triggerDef?.config &&
            Object.keys(triggerDef.config).length > 0 && (
              <pre className="mt-1 max-h-20 overflow-auto rounded bg-blue-100/50 p-1.5 text-[11px] font-mono text-blue-800">
                {JSON.stringify(triggerDef.config, null, 2)}
              </pre>
            )}
        </div>

        {/* Conditions */}
        {conditionsDef.length > 0 && (
          <div className="space-y-1.5">
            <ArrowRight className="mx-auto h-4 w-4 text-text3" />
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Condizioni</span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {conditionsDef.map((c, i) => (
                  <li key={c.id ?? i} className="text-sm text-amber-700">
                    {conditionLabels[c.type ?? ""] ?? c.type}
                    {c.config &&
                      Object.keys(c.config).length > 0 &&
                      `: ${JSON.stringify(c.config)}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions */}
        {actionsDef.length > 0 && (
          <div className="space-y-1.5">
            <ArrowRight className="mx-auto h-4 w-4 text-text3" />
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Azioni</span>
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {actionsDef.map((a, i) => (
                  <li key={a.id ?? i} className="text-sm text-emerald-700">
                    <span className="font-medium">
                      {actionLabels[a.type ?? ""] ?? a.type}
                    </span>
                    {a.config &&
                      Object.keys(a.config).length > 0 && (
                        <pre className="mt-0.5 max-h-20 overflow-auto rounded bg-emerald-100/50 p-1.5 text-[11px] font-mono text-emerald-800">
                          {JSON.stringify(a.config, null, 2)}
                        </pre>
                      )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Schedule */}
        {scheduleDef && scheduleDef.type && scheduleDef.type !== "none" && (
          <div className="space-y-1.5">
            <ArrowRight className="mx-auto h-4 w-4 text-text3" />
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">Schedule</span>
              </div>
              <p className="mt-1 text-sm text-purple-700">
                {scheduleDef.type === "cron"
                  ? `Cron: ${scheduleDef.cron ?? "-"}`
                  : scheduleDef.type}
              </p>
            </div>
          </div>
        )}

        {!triggerDef && actionsDef.length === 0 && (
          <div className="py-4 text-center text-sm text-text3">
            Nessuna configurazione disponibile. Apri la regola con l&apos;editor per configurarla.
          </div>
        )}
      </TabsContent>

      {/* Logs tab */}
      <TabsContent value="logs" className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-text3">Ultime esecuzioni</span>
          <button
            type="button"
            onClick={onToggleLogs}
            className="text-xs text-accent hover:underline"
          >
            {logsOpen ? "Nascondi" : "Mostra tutto"}
          </button>
        </div>
        {logsOpen ? (
          <RunLogDrawer logs={logs} loading={logsLoading} />
        ) : logs.length > 0 ? (
          <div className="space-y-1.5">
            {logs.slice(0, 3).map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/60 p-2 text-xs"
              >
                {log.status === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : log.status === "error" ? (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                ) : (
                  <MinusCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <span className="text-text3">{timeAgo(log.triggered_at)}</span>
                <Badge
                  className={cn(
                    "text-[10px] border-transparent",
                    log.status === "success" && "bg-emerald-100 text-emerald-700",
                    log.status === "error" && "bg-red-100 text-red-700",
                    log.status === "dry_run" && "bg-blue-100 text-blue-700",
                    log.status === "skipped" && "bg-slate-100 text-slate-600",
                  )}
                >
                  {log.is_dry_run ? "dry-run" : log.status}
                </Badge>
                {log.duration_ms != null && (
                  <span className="ml-auto font-mono text-text3">
                    {log.duration_ms} ms
                  </span>
                )}
              </div>
            ))}
            {logs.length > 3 && (
              <button
                type="button"
                onClick={onToggleLogs}
                className="w-full text-center text-xs text-accent hover:underline"
              >
                Mostra tutti ({logs.length})
              </button>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-text3">
            Nessuna esecuzione registrata
          </div>
        )}
      </TabsContent>

      {/* Stats tab */}
      <TabsContent value="stats" className="mt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-background/60 p-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
              Successi
            </div>
            <div className="mt-1 text-xl font-bold text-emerald-600">
              {stats?.success ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
              Errori
            </div>
            <div className="mt-1 text-xl font-bold text-red-600">
              {stats?.error ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
              Dry-run
            </div>
            <div className="mt-1 text-xl font-bold text-blue-600">
              {stats?.dry_run ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
              Saltate
            </div>
            <div className="mt-1 text-xl font-bold text-slate-600">
              {stats?.skipped ?? 0}
            </div>
          </div>
        </div>

        {/* Health indicator */}
        <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">
            Stato salute
          </div>
          <div className="mt-1 flex items-center gap-2">
            {stats?.health === "healthy" && (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  Tutto ok — nessun errore nelle ultime esecuzioni
                </span>
              </>
            )}
            {stats?.health === "degraded" && (
              <>
                <FlaskConical className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Degradato — alcuni errori recenti
                </span>
              </>
            )}
            {stats?.health === "failing" && (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-700">
              In errore — la regola non funziona correttamente
                </span>
              </>
            )}
            {(!stats || stats.health === "never_run") && (
              <>
                <MinusCircle className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  Mai eseguita
                </span>
              </>
            )}
          </div>
        </div>

        {/* Recent executions timeline */}
        {stats?.recent && stats.recent.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text3">
              Ultime esecuzioni
            </div>
            <div className="flex gap-1">
              {stats.recent.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded-full",
                    r.status === "success" && "bg-emerald-400",
                    r.status === "error" && "bg-red-400",
                    r.status === "dry_run" && "bg-blue-400",
                    r.status === "skipped" && "bg-slate-300",
                  )}
                  title={r.status}
                />
              ))}
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
