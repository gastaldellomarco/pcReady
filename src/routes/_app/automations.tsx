import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import queries from "@/lib/queries/automations";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// AutomationBuilder is dynamically imported to avoid build-time crawling issues
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  History,
  MoreVertical,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import AutomationWizard from "@/components/automations/AutomationWizard";
import { RunLogDrawer } from "@/components/automations/RunLogDrawer";
import { DryRunDialog } from "@/components/automations/DryRunDialog";
import {
  AutomationRuleSchema,
  AutomationRunLogSchema,
  type AutomationRule,
} from "@/types/automation";
import {
  getAutomationRunStats,
  listAutomationRunLogs,
  runAutomationNow,
  type AutomationDashboardKpis,
  type AutomationRunLog,
  type AutomationRunStats,
  type HealthStatus,
} from "@/lib/automation-runs";
import { VersionBadge } from "@/components/pcready/VersionBadge";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { createVersion } from "@/lib/versioning";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automazioni — PCReady" }] }),
  component: AutomationsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

const CATEGORY_OPTIONS = ["Generale", "Notifica", "Stato", "Schedulazione"];

function getShortSummary(rule: AutomationRule) {
  return `${rule.name}${rule.category ? ` — ${rule.category}` : ""}`;
}

function RuleCard({
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
            <HealthBadge health={stats?.health ?? "never_run"} />
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

function AutomationsPage() {
  const { isAdmin, session } = useAuth();
  const loadRunLogs = useServerFn(listAutomationRunLogs);
  const executeRun = useServerFn(runAutomationNow);
  const loadRunStats = useServerFn(getAutomationRunStats);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runStats, setRunStats] = useState<Record<string, AutomationRunStats>>({});
  const [kpis, setKpis] = useState<AutomationDashboardKpis | null>(null);
  const [logsByRule, setLogsByRule] = useState<Record<string, AutomationRunLog[]>>({});
  const [logsOpenRuleId, setLogsOpenRuleId] = useState<string | null>(null);
  const [loadingLogsRuleId, setLoadingLogsRuleId] = useState<string | null>(null);
  const [dryRunRule, setDryRunRule] = useState<AutomationRule | null>(null);
  const [dryRunDialogOpen, setDryRunDialogOpen] = useState(false);
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [AutomationBuilderComp, setAutomationBuilderComp] = useState<any>(null);
  const [guidedMode, setGuidedMode] = useState(true);
  const [versionHistoryRuleId, setVersionHistoryRuleId] = useState<string | null>(null);

  const { useAutomationFlows, useCreateAutomation, useUpdateAutomation, useDeleteAutomation, useDuplicateAutomation, useArchiveAutomation, useToggleAutomation } = queries as any;
  const listQuery = useAutomationFlows();
  const createMut = useCreateAutomation();
  const updateMut = useUpdateAutomation();
  const deleteMut = useDeleteAutomation();
  const duplicateMut = useDuplicateAutomation();
  const archiveMut = useArchiveAutomation();
  const toggleMut = useToggleAutomation();

  useEffect(() => {
    if (listQuery.data) {
      try {
        const parsed = AutomationRuleSchema.array().parse(listQuery.data ?? []);
        setRules(parsed);
      } catch (err) {
        console.error('Failed to parse automation rules', err);
        setRules([]);
      }
    }
    void loadStats();
  }, [listQuery.data]);

  async function loadStats() {
    if (!session?.access_token) return;
    try {
      const data = await loadRunStats({ data: { accessToken: session.access_token } });
      setRunStats(data.stats ?? {});
      setKpis(data.kpis ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore statistiche run");
    }
  }

  async function toggleRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      await toggleMut.mutateAsync({ id: rule.id, active: !rule.active });
      await createVersion(
        "automation_flows",
        rule.id,
        { ...rule, active: !rule.active },
        { active: { from: rule.active, to: !rule.active } },
        rule.active ? "Automazione disattivata" : "Automazione attivata",
        "update",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore toggle automazione");
    }
  }

  function openCreateDialog() {
    setEditingRule(null);
    setBuilderOpen(true);
  }

  function openEditDialog(rule: AutomationRule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

  // dynamically import builder only when opening (prevents static crawlers from loading heavy libs)
  useEffect(() => {
    let mounted = true;
    if (builderOpen && !AutomationBuilderComp) {
      void import("@/components/pcready/automation/AutomationBuilder")
        .then((mod) => {
          if (!mounted) return;
          setAutomationBuilderComp(() => mod.default);
        })
        .catch((err) => {
          console.error("Failed to load AutomationBuilder", err);
          toast.error("Errore caricamento editor");
        });
    }
    return () => {
      mounted = false;
    };
  }, [builderOpen, AutomationBuilderComp]);

  // Builder save will be handled by AutomationBuilder component via callback

  async function saveWizardFlow(flow: any) {
    if (!isAdmin) return toast.error("Solo amministratori");
    setSaving(true);
    try {
      function uid(prefix = "n") {
        if (typeof crypto !== "undefined" && (crypto as any).randomUUID)
          return (crypto as any).randomUUID();
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      }

      function buildFlowDefinition(flowObj: any) {
        // create trigger node with default position so advanced editor (ReactFlow) won't crash
        const triggerId = `trigger-${uid()}`;
        const actionNodes = (flowObj.actions_definition || []).map((a: any, idx: number) => ({
          id: `action-${uid()}`,
          type: "action",
          data: { label: a.type, config: a.config },
          position: { x: 300, y: idx * 120 },
        }));
        const nodes = [
          {
            id: triggerId,
            type: "trigger",
            data: { label: flowObj.trigger_definition?.type || "trigger" },
            position: { x: 0, y: 0 },
          },
          ...actionNodes,
        ];
        const edges = actionNodes.map((an: any) => ({
          id: `e-${triggerId}-${an.id}`,
          source: triggerId,
          target: an.id,
        }));
        const meta = {
          wizard: flowObj,
          summary: flowObj.summary,
          migrated_at: new Date().toISOString(),
        };
        return { nodes, edges, meta };
      }

      // attach current user as created_by to satisfy RLS policies that require ownership
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUserId = currentUserData?.user?.id ?? null;

      const payload = {
        name: flow.name || "Nuova automazione",
        description: flow.description || null,
        category: flow.category || null,
        active: false,
        version: (editingRule?.version ?? 0) + 1,
        flow_definition: buildFlowDefinition(flow),
        created_by: currentUserId,
        updated_by: currentUserId,
      } as any;

      try {
        if (editingRule) {
          const previousSnapshot = editingRule as unknown as Record<string, unknown>;
          const data = await updateMut.mutateAsync({ id: editingRule.id, payload });
          await createVersion(
            "automation_flows",
            editingRule.id,
            data as unknown as Record<string, unknown>,
            {
              name: { from: previousSnapshot.name, to: payload.name },
              description: { from: previousSnapshot.description, to: payload.description },
              category: { from: previousSnapshot.category, to: payload.category },
              version: { from: previousSnapshot.version, to: payload.version },
              flow_definition: { from: previousSnapshot.flow_definition, to: payload.flow_definition },
            },
            flow.changeNote || "Automazione aggiornata",
            "update",
          );
          toast.success("Automazione aggiornata");
        } else {
          const data = await createMut.mutateAsync(payload);
          await createVersion(
            "automation_flows",
            data.id,
            data as unknown as Record<string, unknown>,
            undefined,
            flow.changeNote || "Automazione creata",
            "create",
          );
          toast.success("Automazione creata");
        }
        setBuilderOpen(false);
      } catch (err) {
        console.error('Save wizard flow failed:', err);
        const e = err as any;
        const userMsg =
          e && typeof e === 'object' && (e.message || e.error || e.details)
            ? e.message || e.error || e.details
            : err instanceof Error
              ? err.message
              : JSON.stringify(err);
        toast.error(userMsg || 'Errore salvataggio');
      }
    } catch (err) {
      // handled above
    } finally {
      setSaving(false);
    }
  }

  async function duplicateRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      const newId = await duplicateMut.mutateAsync({ id: rule.id, name: `${rule.name} (Copia)` });
      if (newId) {
        await createVersion(
          'automation_flows',
          newId,
          {
            name: `${rule.name} (Copia)`,
            description: rule.description,
            category: rule.category,
            active: false,
            version: 1,
            flow_definition: undefined,
          },
          undefined,
          'Automazione duplicata',
          'create',
        );
      }
      toast.success('Automazione duplicata');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore duplicazione");
    }
  }

  async function deleteRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      await deleteMut.mutateAsync(rule.id);
      toast.success('Automazione eliminata');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore eliminazione');
    }
  }

  async function archiveRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      // fetch current flow_definition
      const { data: fdata } = await supabase.from('automation_flows').select('flow_definition').eq('id', rule.id).single();
      const fd: any = fdata?.flow_definition ?? {};
      const meta: any = fd.meta ?? {};
      meta.archived = true;
      fd.meta = meta;
      await archiveMut.mutateAsync({ id: rule.id, fd });
      await createVersion(
        'automation_flows',
        rule.id,
        { ...rule, active: false, flow_definition: fd },
        {
          active: { from: rule.active, to: false },
          flow_definition: { from: rule.flow_definition, to: fd },
        },
        'Automazione archiviata',
        'update',
      );
      toast.success('Automazione archiviata');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore archivio');
    }
  }

  async function toggleLogs(rule: AutomationRule) {
    const next = logsOpenRuleId === rule.id ? null : rule.id;
    setLogsOpenRuleId(next);
    if (!next || logsByRule[rule.id] || !session?.access_token) return;
    setLoadingLogsRuleId(rule.id);
    try {
      const logs = await loadRunLogs({
        data: { accessToken: session.access_token, automationId: rule.id },
      });
      const parsedLogs = AutomationRunLogSchema.array().parse(logs ?? []);
      setLogsByRule((current) => ({ ...current, [rule.id]: parsedLogs }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento storico");
    } finally {
      setLoadingLogsRuleId(null);
    }
  }

  async function runRule(rule: AutomationRule, isDryRun: boolean) {
    if (!session?.access_token) return;
    if (isDryRun) {
      setDryRunRule(rule);
      setDryRunDialogOpen(true);
      return;
    }
    setRunningRuleId(rule.id);
    try {
      const log = await executeRun({
        data: {
          accessToken: session.access_token,
          automationId: rule.id,
          isDryRun,
          triggerPayload: { source: isDryRun ? "manual_dry_run" : "manual_run" },
        },
      });
      const runLog = AutomationRunLogSchema.parse(log);
      setLogsByRule((current) => {
        const prev = Array.isArray(current[rule.id]) ? current[rule.id] : [];
        return { ...current, [rule.id]: [runLog, ...prev].slice(0, 20) };
      });
      setLogsOpenRuleId(rule.id);
      await loadStats();
      await listQuery.refetch();
      toast.success(isDryRun ? "Dry-run completato" : "Run manuale completata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run non riuscita");
    } finally {
      setRunningRuleId(null);
    }
  }

  // No export/logs on this page anymore

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="pc-card-title">Regole automatiche</span>
            <p className="text-sm text-text3 mt-1">
              Gestisci le condizioni, le azioni e le categorie delle regole.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-100 text-slate-800 border-transparent">
              {rules.filter((r) => r.active).length}/{rules.length} attive
            </Badge>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={categoryFilter ?? ""}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
            >
              <option value="">Tutte le categorie</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={statusFilter ?? ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
            >
              <option value="">Tutti gli stati</option>
              <option value="draft">Draft</option>
              <option value="validated">Validated</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
            <input
              placeholder="Cerca..."
              className="rounded-md border px-2 py-1 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={openCreateDialog} disabled={!isAdmin}>
              <Plus className="h-4 w-4" />
              Aggiungi regola
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 pt-4 md:grid-cols-4">
          <KpiCard
            label="Automazioni attive"
            value={kpis?.activeAutomations ?? rules.filter((r) => r.active).length}
          />
          <KpiCard
            label="Run oggi"
            value={`${kpis?.runsToday ?? 0} (${kpis?.successToday ?? 0}/${kpis?.errorToday ?? 0})`}
          />
          <KpiCard label="Successo 7 giorni" value={`${kpis?.successRate7d ?? 100}%`} />
          <KpiCard label="Errori recenti" value={kpis?.automationsWithRecentErrors ?? 0} />
        </div>

        <div className="pc-card-body space-y-3">
          {loadingRules && <div className="text-sm text-text3">Caricamento regole...</div>}
          {!loadingRules && rules.length === 0 && (
            <div className="text-sm text-text3">Nessuna regola disponibile.</div>
          )}
          {!loadingRules &&
            rules
              .filter((rule) => {
                if (categoryFilter && rule.category !== categoryFilter) return false;
                // status derivation
                const status = (() => {
                  const meta = rule.flow_definition?.meta ?? {};
                  if (meta.archived) return "archived";
                  if (meta.paused) return "paused";
                  if (rule.active) return "active";
                  if (rule.version && rule.version === 1) return "draft";
                  return "validated";
                })();
                if (statusFilter && status !== statusFilter) return false;
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (
                    !(
                      (rule.name || "").toLowerCase().includes(q) ||
                      (rule.summary || "").toLowerCase().includes(q)
                    )
                  )
                    return false;
                }
                return true;
              })
              .map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isAdmin={isAdmin}
                  expanded={expandedRuleId === rule.id}
                  stats={(runStats ?? {})[rule.id]}
                  logsOpen={logsOpenRuleId === rule.id}
                  logs={logsByRule[rule.id] ?? []}
                  logsLoading={loadingLogsRuleId === rule.id}
                  running={runningRuleId === rule.id}
                  onToggle={() => void toggleRule(rule)}
                  onEdit={() => openEditDialog(rule)}
                  onToggleLogs={() => void toggleLogs(rule)}
                  onOpenVersions={() => setVersionHistoryRuleId(rule.id)}
                  onRunNow={() => void runRule(rule, false)}
                  onDryRun={() => void runRule(rule, true)}
                  onDuplicate={() => void duplicateRule(rule)}
                  onDelete={() => void deleteRule(rule)}
                  onArchive={() => void archiveRule(rule)}
                  onExpandToggle={() =>
                    setExpandedRuleId((current) => (current === rule.id ? null : rule.id))
                  }
                />
              ))}
        </div>
      </div>

      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="pc-card-title">Automation Builder</span>
            <p className="text-sm text-text3 mt-1">
              Crea e modifica workflow visuali a blocchi. Usa blocchi predefiniti per trigger,
              condizioni e azioni.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBuilderOpen(true)}
              disabled={!isAdmin}
            >
              <Plus className="h-4 w-4" />
              Apri builder
            </Button>
          </div>
        </div>

        <div className="pc-card-body">
          <div className="text-sm text-text3">
            Apri il builder per costruire automazioni a blocchi.
          </div>
        </div>
      </div>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Modifica automazione" : "Nuova automazione"}</DialogTitle>
          </DialogHeader>
          <div className="p-2 flex gap-2 items-center">
            <label
              className={`cursor-pointer px-2 py-1 rounded ${guidedMode ? "bg-slate-100" : ""}`}
            >
              <input
                type="radio"
                name="builderMode"
                checked={guidedMode}
                onChange={() => setGuidedMode(true)}
                className="sr-only"
              />{" "}
              Modalità guidata
            </label>
            <label
              className={`cursor-pointer px-2 py-1 rounded ${!guidedMode ? "bg-slate-100" : ""}`}
            >
              <input
                type="radio"
                name="builderMode"
                checked={!guidedMode}
                onChange={() => setGuidedMode(false)}
                className="sr-only"
              />{" "}
              Modalità avanzata
            </label>
          </div>

          {guidedMode ? (
            <div className="p-4">
              <AutomationWizard
                initial={
                  editingRule
                    ? { ...editingRule, ...(editingRule.flow_definition?.wizard ?? {}) }
                    : undefined
                }
                onSave={saveWizardFlow}
                onCancel={() => setBuilderOpen(false)}
              />
            </div>
          ) : AutomationBuilderComp ? (
            <AutomationBuilderComp
              initialFlow={editingRule ? { id: editingRule.id } : undefined}
              onSave={() => {
                setBuilderOpen(false);
                void listQuery.refetch();
              }}
              onCancel={() => setBuilderOpen(false)}
            />
          ) : (
            <div className="p-6">Caricamento editor...</div>
          )}
        </DialogContent>
      </Dialog>
      <DryRunDialog open={dryRunDialogOpen} rule={dryRunRule} onOpenChange={setDryRunDialogOpen} />
      <VersionHistoryDrawer
        entityType="automation_flows"
        entityId={versionHistoryRuleId || ""}
        open={!!versionHistoryRuleId}
        onClose={() => setVersionHistoryRuleId(null)}
        onRestored={() => void listQuery.refetch()}
      />
    </div>
  );
}

function HealthBadge({ health }: { health: HealthStatus }) {
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
  return <Badge className={`${cls} border-transparent`}>{label}</Badge>;
}

function KpiCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
