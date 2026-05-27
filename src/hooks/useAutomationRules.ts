import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import queries from "@/lib/queries/automations";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  AutomationRuleSchema,
  AutomationRunLogSchema,
  type AutomationFlow,
  type FlowDefinitionMeta,
  type WizardFlowPayload,
  type ActionDef,
} from "@/types/automation";
import type { AutomationRule, AutomationFlowDefinition } from "@/types/automation";
import {
  getAutomationRunStats,
  runAutomationNow,
  type AutomationDashboardKpis,
  type AutomationRunStats,
} from "@/lib/automation-runs";
import { randomUUID } from "@/lib/random-uuid";
import { createVersion } from "@/lib/versioning";
import {
  validateWizardPayload,
  summarizeErrors,
  groupErrorsBySection,
  getSectionLabel,
} from "@/lib/automations/flow-validation";
import { useAutomationFilters } from "./useAutomationFilters";
import {
  getRuleTriggerType,
  TRIGGER_TYPE_LABELS,
  TRIGGER_TYPE_OPTIONS,
} from "@/lib/automation-constants";
import { useAutomationDialogs } from "./useAutomationDialogs";
import { useAutomationLogs } from "./useAutomationLogs";
import { useAutomationBuilder } from "./useAutomationBuilder";

export type { SortField, SortOrder, ErrorFilterValue } from "./useAutomationFilters";
export { getRuleTriggerType, TRIGGER_TYPE_LABELS, TRIGGER_TYPE_OPTIONS };

/**
 * Hook principale: compone i 4 sub-hook specializzati e gestisce
 * data fetching (rules, runStats, kpis) e operazioni CRUD.
 */
export function useAutomationRules() {
  const { isAdmin, session } = useAuth();
  const loadRunStats = useServerFn(getAutomationRunStats);
  const executeRun = useServerFn(runAutomationNow);

  const {
    useAutomationFlows,
    useCreateAutomation,
    useUpdateAutomation,
    useDeleteAutomation,
    useDuplicateAutomation,
    useArchiveAutomation,
    useToggleAutomation,
  } = queries;
  const listQuery = useAutomationFlows();
  const createMut = useCreateAutomation();
  const updateMut = useUpdateAutomation();
  const deleteMut = useDeleteAutomation();
  const duplicateMut = useDuplicateAutomation();
  const archiveMut = useArchiveAutomation();
  const toggleMut = useToggleAutomation();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runStats, setRunStats] = useState<Record<string, AutomationRunStats>>({});
  const [kpis, setKpis] = useState<AutomationDashboardKpis | null>(null);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [versionHistoryRuleId, setVersionHistoryRuleId] = useState<string | null>(null);
  const [_runningRuleId, _setRunningRuleId] = useState<string | null>(null);
  const runningRuleId = _runningRuleId;

  // Sub-hooks
  const filters = useAutomationFilters(rules, runStats);
  const dialogs = useAutomationDialogs();
  const logs = useAutomationLogs(session);
  const builder = useAutomationBuilder();

  const loadingRules = listQuery.isLoading;

  const loadStats = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await loadRunStats({ data: { accessToken: session.access_token } });
      setRunStats(data.stats ?? {});
      setKpis(data.kpis ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore statistiche run");
    }
  }, [loadRunStats, session?.access_token]);

  useEffect(() => {
    if (listQuery.data) {
      try {
        const parsed = AutomationRuleSchema.array().parse(listQuery.data ?? []);
        setRules(parsed);
      } catch (err) {
        console.error("Failed to parse automation rules", err);
        setRules([]);
      }
    }
    void loadStats();
  }, [listQuery.data, loadStats]);

  async function toggleRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      await toggleMut.mutateAsync({ id: rule.id, active: !rule.active });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore toggle automazione");
    }
  }

  async function duplicateRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      const newId = await duplicateMut.mutateAsync({
        id: rule.id,
        name: `${rule.name} (Copia)`,
      });
      if (newId) {
        await createVersion(
          "automation_flows",
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
          "Automazione duplicata",
          "create",
        );
      }
      toast.success("Automazione duplicata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore duplicazione");
    }
  }

  // ── Delete flow ──────────────────────────────────────────────

  async function deleteRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    dialogs.setConfirmDeleteRule(rule);
  }

  async function confirmDeleteRuleAction() {
    if (!dialogs.confirmDeleteRule) return;
    try {
      await deleteMut.mutateAsync(dialogs.confirmDeleteRule.id);
      dialogs.setConfirmDeleteRule(null);
      toast.success("Automazione eliminata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore eliminazione");
    }
  }

  // ── Archive flow ─────────────────────────────────────────────

  async function archiveRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    dialogs.setConfirmArchiveRule(rule);
  }

  async function confirmArchiveRuleAction() {
    if (!dialogs.confirmArchiveRule) return;
    try {
      const { data: fdata } = await supabase
        .from("automation_flows")
        .select("flow_definition")
        .eq("id", dialogs.confirmArchiveRule.id)
        .single();
      const fd: AutomationFlowDefinition =
        (fdata?.flow_definition as AutomationFlowDefinition) ?? {};
      const meta: FlowDefinitionMeta = (fd.meta as FlowDefinitionMeta) ?? {};
      meta.archived = true;
      meta.archived_at = new Date().toISOString();
      fd.meta = meta;
      await archiveMut.mutateAsync({ id: dialogs.confirmArchiveRule.id, fd });
      await createVersion(
        "automation_flows",
        dialogs.confirmArchiveRule.id,
        { ...dialogs.confirmArchiveRule, active: false, flow_definition: fd },
        {
          active: { from: dialogs.confirmArchiveRule.active, to: false },
          flow_definition: { from: dialogs.confirmArchiveRule.flow_definition, to: fd },
        },
        "Automazione archiviata",
        "update",
      );
      dialogs.setConfirmArchiveRule(null);
      toast.success("Automazione archiviata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore archivio");
    }
  }

  // ── Run flow ─────────────────────────────────────────────────

  async function runRule(rule: AutomationRule, isDryRun: boolean) {
    if (!session?.access_token) return;
    if (isDryRun) {
      dialogs.setDryRunRule(rule);
      dialogs.setDryRunDialogOpen(true);
      return;
    }
    dialogs.setConfirmRunRule(rule);
  }

  async function confirmRunRuleAction() {
    if (!dialogs.confirmRunRule || !session?.access_token) return;
    dialogs.setConfirmRunLoading(true);
    try {
      const log = await executeRun({
        data: {
          accessToken: session.access_token,
          automationId: dialogs.confirmRunRule.id,
          isDryRun: false,
          triggerPayload: { source: "manual_run" },
        },
      });
      const runLog = AutomationRunLogSchema.parse(log);
      logs.setLogsByRule((current) => {
        const prev = Array.isArray(current[dialogs.confirmRunRule!.id])
          ? current[dialogs.confirmRunRule!.id]
          : [];
        return { ...current, [dialogs.confirmRunRule!.id]: [runLog, ...prev].slice(0, 20) };
      });
      logs.setLogsOpenRuleId(dialogs.confirmRunRule.id);
      await loadStats();
      await listQuery.refetch();
      dialogs.setConfirmRunRule(null);
      toast.success("Run manuale completata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run non riuscita");
    } finally {
      dialogs.setConfirmRunLoading(false);
    }
  }

  // ── Save wizard flow ─────────────────────────────────────────

  async function saveWizardFlow(flow: WizardFlowPayload) {
    if (!isAdmin) return toast.error("Solo amministratori");

    const validation = validateWizardPayload(flow);
    if (!validation.valid) {
      const sections = groupErrorsBySection(validation.errors);
      const lines: string[] = [];
      for (const [section, errs] of Object.entries(sections)) {
        const label = getSectionLabel(section);
        for (const err of errs) {
          lines.push(`- ${label}: ${err.message}`);
        }
      }
      const summary = summarizeErrors(validation.errors);
      toast.error(`Validazione fallita (${summary}):\n${lines.join("\n")}`, {
        duration: 8000,
        richColors: true,
      });
      return;
    }

    function uid() {
      return randomUUID();
    }

    function buildFlowDefinition(flowObj: WizardFlowPayload) {
      const triggerId = `trigger-${uid()}`;
      const actionNodes = (flowObj.actions_definition || []).map((a: ActionDef, idx: number) => ({
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
      const edges = actionNodes.map((an: { id: string }) => ({
        id: `e-${triggerId}-${an.id}`,
        source: triggerId,
        target: an.id,
      }));
      const meta: FlowDefinitionMeta = {
        wizard: flowObj,
        summary: flowObj.summary,
        migrated_at: new Date().toISOString(),
      };
      return { nodes, edges, meta };
    }

    const { data: currentUserData } = await supabase.auth.getUser();
    const currentUserId = currentUserData?.user?.id ?? null;

    const payload: Partial<AutomationFlow> = {
      name: flow.name || "Nuova automazione",
      description: flow.description ?? null,
      category: flow.category ?? null,
      active: false,
      version: (builder.editingRule?.version ?? 0) + 1,
      flow_definition: buildFlowDefinition(flow),
      created_by: currentUserId,
      updated_by: currentUserId,
    };

    try {
      if (builder.editingRule) {
        const previousSnapshot = builder.editingRule;
        const data = await updateMut.mutateAsync({
          id: builder.editingRule.id,
          payload: payload as Partial<AutomationFlow>,
        });
        await createVersion(
          "automation_flows",
          builder.editingRule.id,
          data as unknown as Record<string, unknown>,
          {
            name: { from: previousSnapshot.name, to: payload.name ?? "" },
            description: { from: previousSnapshot.description, to: payload.description ?? null },
            category: { from: previousSnapshot.category, to: payload.category ?? null },
            version: { from: previousSnapshot.version, to: payload.version ?? 1 },
            flow_definition: {
              from: previousSnapshot.flow_definition,
              to: payload.flow_definition,
            },
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
      builder.setBuilderOpen(false);
    } catch (err) {
      console.error("Save wizard flow failed:", err);
      const userMsg =
        err && typeof err === "object" && err !== null
          ? String(
              (err as Record<string, unknown>).message ||
                (err as Record<string, unknown>).error ||
                (err as Record<string, unknown>).details ||
                "",
            )
          : err instanceof Error
            ? err.message
            : String(err);
      toast.error(userMsg || "Errore salvataggio");
    }
  }

  return {
    // Data
    rules,
    filteredRules: filters.filteredRules,
    runStats,
    kpis,
    listQuery,
    loadingRules,

    // Auth
    isAdmin,
    session,

    // Filters / sort
    categoryFilter: filters.categoryFilter,
    setCategoryFilter: filters.setCategoryFilter,
    statusFilter: filters.statusFilter,
    setStatusFilter: filters.setStatusFilter,
    searchQuery: filters.searchQuery,
    setSearchQuery: filters.setSearchQuery,
    triggerTypeFilter: filters.triggerTypeFilter,
    setTriggerTypeFilter: filters.setTriggerTypeFilter,
    errorFilter: filters.errorFilter,
    setErrorFilter: filters.setErrorFilter,
    sortBy: filters.sortBy,
    setSortBy: filters.setSortBy,
    sortOrder: filters.sortOrder,
    setSortOrder: filters.setSortOrder,

    // Logs (per-rule)
    logsByRule: logs.logsByRule,
    logsOpenRuleId: logs.logsOpenRuleId,
    loadingLogsRuleId: logs.loadingLogsRuleId,
    toggleLogs: logs.toggleLogs,

    // Global logs
    globalLogsOpen: logs.globalLogsOpen,
    setGlobalLogsOpen: logs.setGlobalLogsOpen,
    globalLogs: logs.globalLogs,
    globalLogsLoading: logs.globalLogsLoading,
    globalLogsFilter: logs.globalLogsFilter,
    setGlobalLogsFilter: logs.setGlobalLogsFilter,
    loadGlobalLogs: logs.loadGlobalLogs,
    exportLogsCsv: logs.exportLogsCsv,

    // Dialogs (delete)
    confirmDeleteRule: dialogs.confirmDeleteRule,
    setConfirmDeleteRule: dialogs.setConfirmDeleteRule,
    cancelDeleteRule: dialogs.cancelDeleteRule,

    // Dialogs (archive)
    confirmArchiveRule: dialogs.confirmArchiveRule,
    setConfirmArchiveRule: dialogs.setConfirmArchiveRule,
    cancelArchiveRule: dialogs.cancelArchiveRule,

    // Dialogs (run)
    confirmRunRule: dialogs.confirmRunRule,
    confirmRunLoading: dialogs.confirmRunLoading,
    cancelRunRule: dialogs.cancelRunRule,

    // Dry run
    dryRunRule: dialogs.dryRunRule,
    dryRunDialogOpen: dialogs.dryRunDialogOpen,
    setDryRunDialogOpen: dialogs.setDryRunDialogOpen,

    // Builder
    builderOpen: builder.builderOpen,
    setBuilderOpen: builder.setBuilderOpen,
    editingRule: builder.editingRule,
    AutomationBuilderComp: builder.AutomationBuilderComp,
    guidedMode: builder.guidedMode,
    setGuidedMode: builder.setGuidedMode,
    openCreateDialog: builder.openCreateDialog,
    openEditDialog: builder.openEditDialog,

    // UI state
    expandedRuleId,
    setExpandedRuleId,
    versionHistoryRuleId,
    setVersionHistoryRuleId,
    runningRuleId,

    // Actions
    toggleRule,
    duplicateRule,
    deleteRule,
    confirmDeleteRuleAction,
    archiveRule,
    confirmArchiveRuleAction,
    runRule,
    confirmRunRuleAction,
    saveWizardFlow,
  };
}
