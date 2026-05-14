import { fmtDateTime } from "@/lib/pcready";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  History,
  MoreVertical,
  Pencil,
  Play,
} from "lucide-react";
import { RunLogDrawer } from "@/components/automations/RunLogDrawer";
import type { AutomationRule } from "@/types/automation";
import type { AutomationRunLog, AutomationRunStats, HealthStatus } from "@/lib/automation-runs";
import { VersionBadge } from "@/components/pcready/VersionBadge";

function HealthBadge({ health, onClick }: { health: HealthStatus; onClick?: () => void }) {
  const cls =
    health === "healthy"
      ? "bg-emerald-100 text-emerald-800"
      : health === "degraded"
        ? "bg-amber-100 text-amber-800"
        : health === "failing"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-700";
  const label =
    health === "healthy"
      ? "healthy"
      : health === "degraded"
        ? "degraded"
        : health === "failing"
          ? "failing"
          : "never run";
  const badge = <Badge className={`${cls} border-transparent`}>{label}</Badge>;
  if ((health === "degraded" || health === "failing") && onClick) {
    return (
      <button type="button" onClick={onClick} title="Apri ultimo errore">
        {badge}
      </button>
    );
  }
  return badge;
}

export function AutomationRuleCard({
  rule,
  isAdmin,
  expanded,
  stats,
  logsOpen,
  logs,
  logsLoading,
  running,
  onToggle,
  onEdit,
  onExpandToggle,
  onToggleLogs,
  onOpenVersions,
  onRunNow,
  onDryRun,
  onDuplicate,
  onDelete,
  onArchive,
}: {
  rule: AutomationRule;
  isAdmin: boolean;
  expanded: boolean;
  stats?: AutomationRunStats;
  logsOpen: boolean;
  logs: AutomationRunLog[];
  logsLoading: boolean;
  running: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onExpandToggle: () => void;
  onToggleLogs: () => void;
  onOpenVersions: () => void;
  onRunNow: () => void;
  onDryRun: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="rounded-2xl border border-input bg-surface2 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              AUTOMAZIONE
            </Badge>
            <HealthBadge health={stats?.health ?? "never_run"} onClick={onToggleLogs} />
            <div className="text-sm font-semibold text-foreground">{rule.name}</div>
            <VersionBadge entityType="automation_flows" entityId={rule.id} />
          </div>

          {rule.description && (
            <div className="rounded-2xl border border-border bg-background/80 p-3 text-sm text-muted-foreground">
              {rule.description}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary" className="bg-slate-100 text-slate-900 border-transparent">
              {rule.category}
            </Badge>
            <Badge
              className={
                rule.active
                  ? "bg-emerald-100 text-emerald-800 border-transparent"
                  : "bg-slate-100 text-slate-600 border-transparent"
              }
            >
              {rule.active ? "Attiva" : "Spenta"}
            </Badge>
            <span className="text-xs text-text3 font-mono">
              {rule.last_run_at
                ? `Ultima esecuzione ${fmtDateTime(rule.last_run_at)}`
                : rule.updated_at
                  ? `Aggiornata ${fmtDateTime(rule.updated_at)}`
                  : `Versione ${rule.version}`}
            </span>
            <span className="text-xs text-text3 font-mono">
              ok {stats?.success ?? 0} / err {stats?.error ?? 0}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-sm text-text3">
            <button
              type="button"
              onClick={onExpandToggle}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Nascondi dettagli" : "Mostra dettagli"}
            </button>
            <button
              type="button"
              onClick={onToggleLogs}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
            >
              <History className="h-4 w-4" />
              Storico
            </button>
            <button
              type="button"
              onClick={onOpenVersions}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
            >
              <History className="h-4 w-4" />
              Versioni
            </button>
          </div>

          {expanded && rule.description && (
            <div className="rounded-2xl border border-border bg-background/80 p-3 text-sm text-muted-foreground">
              {rule.description}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 items-start sm:items-end">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} disabled={!isAdmin}>
              <Pencil className="h-4 w-4" />
              Apri editor
            </Button>
            <Button variant="secondary" size="sm" onClick={onRunNow} disabled={!isAdmin || running}>
              <Play className="h-4 w-4" />
              {running ? "Esecuzione..." : "Esegui ora"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!isAdmin}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDryRun} disabled={running}>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Dry Run
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>Duplica</DropdownMenuItem>
                <DropdownMenuItem onClick={onArchive}>Archivia</DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  Elimina
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-slate-100 disabled:cursor-not-allowed">
            <input
              type="checkbox"
              checked={rule.active}
              disabled={!isAdmin}
              onChange={onToggle}
              className="sr-only"
            />
            <span
              className="inline-flex h-5 w-9 items-center rounded-full bg-slate-300 p-[3px] transition-all"
              style={{ background: rule.active ? "#a7f3d0" : "#e2e8f0" }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-background transition-transform"
                style={{ transform: rule.active ? "translateX(14px)" : "none" }}
              />
            </span>
            {rule.active ? "Attiva" : "Spenta"}
          </label>
        </div>
      </div>
      {logsOpen && (
        <div className="mt-4">
          <RunLogDrawer logs={logs} loading={logsLoading} />
        </div>
      )}
    </div>
  );
}
