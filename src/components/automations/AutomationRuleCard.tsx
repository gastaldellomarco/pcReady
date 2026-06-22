import {
  ChevronDown,
  ChevronUp,
  Copy,
  FlaskConical,
  MoreVertical,
  Pencil,
  Play,
  Trash2,
  Archive,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { AutomationDetailTabs } from "@/components/automations/AutomationDetailTabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";
import { getRuleTriggerType, TRIGGER_TYPE_LABELS } from "@/hooks/useAutomationRules";
import {
  computeRiskLevel,
  checkCompleteness,
  RISK_LEVEL_CONFIG,
} from "@/lib/automations/automation-guardrails";
import { timeAgo } from "@/lib/pcready";
import { cn } from "@/lib/utils";
import type { AutomationRunLog, AutomationRunStats, HealthStatus } from "@/lib/automation-runs";
import type { AutomationRule } from "@/types/automation";

const TRIGGER_COLORS: Record<string, string> = {
  ticket_created: "bg-primary-light text-primary border-transparent",
  ticket_updated: "bg-primary-light text-primary border-transparent",
  checklist_completed: "bg-success-light text-success border-transparent",
  sla_warning: "bg-warning-light text-warning border-transparent",
  sla_breached: "bg-danger-light text-danger border-transparent",
  warranty_expiring_soon: "bg-warning-light text-warning border-transparent",
  warranty_expired: "bg-danger-light text-danger border-transparent",
  scheduled: "bg-purple-bg text-purple border-transparent",
  manual: "bg-surface2 text-text-secondary border-transparent",
};

function ErrorIndicator({ health }: { health: HealthStatus }) {
  if (health === "healthy" || health === "never_run") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        <span className="hidden sm:inline">OK</span>
      </span>
    );
  }
  if (health === "degraded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="size-3.5" />
        <span className="hidden sm:inline">Degradato</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <AlertCircle className="size-3.5" />
      <span className="hidden sm:inline">Errori</span>
    </span>
  );
}

/**
 * Per-rule automation card used inside the `/automations` list.
 *
 * Permission model — keep `canManageAutomations` and `canDelete` INDEPENDENT:
 * - `canManageAutomations` (driven by `useAuth().hasPermission(
 *   "can_manage_automations")`) gates the toggle switch, edit button,
 *   run-now button, AND the non-destructive dropdown items (dry-run,
 *   duplicate, archive, versions). The dropdown **trigger** is also
 *   disabled when this is false, so the menu cannot even be opened.
 * - `canDelete?: boolean` (optional, falls back to `useAuth().isAdmin`
 *   when omitted — see prop JSDoc) gates the destructive Trash2
 *   dropdown item that calls `onDelete`. **Deleting an automation
 *   rule requires admin privileges.** The dropdown separator
 *   immediately preceding this item is hidden along with the item so
 *   the menu doesn't end with a dangling divider.
 * - `isAdmin?: boolean` is a coarse admin override exposed for tests,
 *   read-only previews, and mock contexts; the fine-grained gate is
 *   `canDelete`. When `isAdmin` is omitted the panel falls back to
 *   `useAuth().isAdmin`.
 *
 * The two flags are independent: a non-admin with `canManageAutomations`
 * may toggle / edit / run / archive / version rules but cannot delete
 * them; an admin without `canManageAutomations` cannot toggle or edit.
 * The destructive dropdown item is hidden when `!canDelete` and the
 * underlying server mutation is guarded by RLS — the UI gate is a UX
 * safeguard, never the source of truth.
 */
export function AutomationRuleCard({
  rule,
  canManageAutomations,
  isAdmin: isAdminProp,
  canDelete: canDeleteProp,
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
  canManageAutomations: boolean;
  /**
   * Coarse admin override. When omitted, falls back to
   * `useAuth().isAdmin`. Used by tests / previews / mock contexts to
   * pin the gate without touching the global auth context.
   */
  isAdmin?: boolean;
  /**
   * Fine-grained gate for the destructive Trash2 dropdown item.
   * Defaults to `isAdmin` when omitted. **Deleting an automation
   * rule requires admin privileges.**
   */
  canDelete?: boolean;
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
  const { isAdmin: authIsAdmin } = useAuth();
  const isAdmin = isAdminProp ?? authIsAdmin;
  const canDelete = canDeleteProp ?? isAdmin;

  const triggerType = getRuleTriggerType(rule);
  const triggerLabel = TRIGGER_TYPE_LABELS[triggerType] ?? triggerType;
  const health = stats?.health ?? "never_run";
  const totalExecutions = (stats?.success ?? 0) + (stats?.error ?? 0);
  const riskLevel = computeRiskLevel(rule);
  const completeness = checkCompleteness(rule);
  const riskCfg = RISK_LEVEL_CONFIG[riskLevel];

  // Extract summary from wizard
  const wizard = rule.flow_definition?.meta?.wizard;
  const triggerDef = wizard?.trigger_definition;
  const conditionsDef = wizard?.conditions_definition ?? [];
  const actionsDef = wizard?.actions_definition ?? [];

  const actionLabels: Record<string, string> = {
    send_email: "Invia email",
    update_ticket_status: "Aggiorna ticket",
    create_notification: "Notifica",
    update_device_status: "Aggiorna dispositivo",
    assign_ticket: "Assegna ticket",
  };

  const summaryParts: string[] = [];
  if (triggerDef?.type) {
    summaryParts.push(`Trigger: ${TRIGGER_TYPE_LABELS[triggerDef.type] ?? triggerDef.type}`);
  }
  if (conditionsDef.length > 0) {
    summaryParts.push(`Condizioni: ${conditionsDef.length}`);
  }
  if (actionsDef.length > 0) {
    summaryParts.push(
      `Azioni: ${actionsDef.map((a) => actionLabels[a.type ?? ""] ?? a.type).join(", ")}`,
    );
  }
  const summary = summaryParts.join(" · ");

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        expanded ? "border-accent/40 shadow-md" : "border-border shadow-sm hover:shadow-md",
        "bg-surface2",
      )}
    >
      <div className="p-4">
        {/* Top row: Toggle + Name + Badges + Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            checked={rule.active}
            disabled={!canManageAutomations}
            onCheckedChange={onToggle}
            className={cn(
              "h-6 w-11 [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5",
              rule.active
                ? "data-[state=checked]:bg-emerald-500"
                : "data-[state=unchecked]:bg-slate-300",
            )}
          />
          <button
            type="button"
            onClick={onExpandToggle}
            className="flex items-center gap-1.5 text-left"
          >
            <span className="text-base font-bold text-foreground">{rule.name}</span>
            {expanded ? (
              <ChevronUp className="size-4 shrink-0 text-text3" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-text3" />
            )}
          </button>
          <Badge
            className={cn(
              "text-[10px] uppercase",
              TRIGGER_COLORS[triggerType] ?? TRIGGER_COLORS.manual,
            )}
          >
            {triggerLabel}
          </Badge>
          {/* Risk Level Badge */}
          <Badge
            className={cn("text-[10px] uppercase border-transparent", riskCfg.bg, riskCfg.color)}
          >
            <ShieldAlert className="mr-0.5 size-3" />
            {riskCfg.label}
          </Badge>
          {/* Incomplete Warning */}
          {!completeness.complete && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 cursor-help">
                    <AlertTriangle className="size-3.5" />
                    <span className="hidden sm:inline">Incompleta</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  <p className="font-medium mb-1">Regola incompleta:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {completeness.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {totalExecutions > 0 && <ErrorIndicator health={health} />}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onEdit} disabled={!canManageAutomations}>
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">Modifica</span>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRunNow}
                      disabled={!canManageAutomations || running || !completeness.complete}
                      className="gap-1"
                    >
                      <Play className="size-3.5" />
                      {running ? "..." : "Esegui"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!completeness.complete && (
                  <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                    <p>Completa la configurazione della regola prima di eseguirla.</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!canManageAutomations}>
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDryRun} disabled={running}>
                  <FlaskConical className="mr-2 size-4" />
                  Test (dry-run)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 size-4" />
                  Duplica
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="mr-2 size-4" />
                  Archivia
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenVersions}>
                  <Clock className="mr-2 size-4" />
                  Versioni
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      <Trash2 className="mr-2 size-4" />
                      Elimina
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Middle row: Summary */}
        {summary && (
          <div className="mt-2.5 text-sm text-text3 leading-relaxed line-clamp-1">{summary}</div>
        )}

        {/* Bottom row: Stats */}
        <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-text3">
          {rule.last_run_at && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {timeAgo(rule.last_run_at)}
            </span>
          )}
          <span>
            Eseguita <strong>{totalExecutions}</strong>
            {totalExecutions === 1 ? " volta" : " volte"}
          </span>
          {stats && <span className="text-emerald-600">✓ {stats.success} succ.</span>}
          {stats && stats.error > 0 && <span className="text-red-600">✗ {stats.error} err.</span>}
          {rule.category && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-slate-100 text-slate-700 border-transparent"
            >
              {rule.category}
            </Badge>
          )}
          {expanded && (
            <button
              type="button"
              onClick={onToggleLogs}
              className="ml-auto text-accent hover:underline"
            >
              {logsOpen ? "Nascondi log" : "Mostra log"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <AutomationDetailTabs
            rule={rule}
            stats={stats}
            logs={logs}
            logsLoading={logsLoading}
            logsOpen={logsOpen}
            onToggleLogs={onToggleLogs}
          />
        </div>
      )}
    </div>
  );
}
