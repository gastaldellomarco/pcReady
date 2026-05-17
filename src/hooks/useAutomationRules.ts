import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import queries from "@/lib/queries/automations";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  AutomationRuleSchema,
  AutomationRunLogSchema,
  type AutomationRule,
  type AutomationFlow,
  type AutomationFlowDefinition,
  type WizardFlowPayload,
  type ActionDef,
  type FlowDefinitionMeta,
} from "@/types/automation";
import {
  getAutomationRunStats,
  listAutomationRunLogs,
  listAllAutomationRunLogs,
  runAutomationNow,
  type AutomationDashboardKpis,
  type AutomationRunLog,
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

function ruleLifecycleStatus(rule: AutomationRule): string {
  const meta = rule.flow_definition?.meta ?? {};
  if (meta.archived) return "archived";
  if (meta.paused) return "paused";
  if (rule.active) return "active";
  if (rule.version && rule.version === 1) return "draft";
  return "validated";
}

/** Extract trigger type from a rule's flow_definition wizard data */
export function getRuleTriggerType(rule: AutomationRule): string {
  const wizard = rule.flow_definition?.meta?.wizard as Record<string, unknown> | undefined;
  if (wizard?.trigger_definition && typeof wizard.trigger_definition === "object") {
    const td = wizard.trigger_definition as Record<string, unknown>;
    return (td.type as string) || "manual";
  }
  return "manual";
}

/** Human-readable label for trigger type */
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  ticket_created: "Ticket creato",
  ticket_updated: "Ticket aggiornato",
  checklist_completed: "Checklist completata",
  sla_warning: "SLA in scadenza",
  sla_breached: "SLA violato",
  warranty_expiring_soon: "Garanzia in scadenza",
  warranty_expired: "Garanzia scaduta",
  scheduled: "Schedulato",
  manual: "Manuale",
};

export const TRIGGER_TYPE_OPTIONS = [
  { value: "", label: "Tutti i trigger" },
  { value: "ticket_created", label: "Ticket creato" },
  { value: "ticket_updated", label: "Ticket aggiornato" },
  { value: "checklist_completed", label: "Checklist completata" },
  { value: "sla_warning", label: "SLA in scadenza" },
  { value: "sla_breached", label: "SLA violato" },
  { value: "warranty_expiring_soon", label: "Garanzia in scadenza" },
  { value: "warranty_expired", label: "Garanzia scaduta" },
  { value: "scheduled", label: "Schedulato" },
  { value: "manual", label: "Manuale" },
];

export type SortField = "name" | "last_run" | "executions" | "created";
export type SortOrder = "asc" | "desc";
export type ErrorFilterValue = "all" | "active" | "inactive" | "errors";

export function useAutomationRules() {
  const { isAdmin, session } = useAuth();
  const loadRunLogs = useServerFn(listAutomationRunLogs);
  const loadAllRunLogs = useServerFn(listAllAutomationRunLogs);
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
  const [_runningRuleId, _setRunningRuleId] = useState<string | null>(null);
  const runningRuleId = _runningRuleId;

  // Confirmation dialog states
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<AutomationRule | null>(null);
  const [confirmArchiveRule, setConfirmArchiveRule] = useState<AutomationRule | null>(null);
  const [confirmRunRule, setConfirmRunRule] = useState<AutomationRule | null>(null);
  const [confirmRunLoading, setConfirmRunLoading] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [AutomationBuilderComp, setAutomationBuilderComp] = useState<React.ComponentType<{
    initialFlow?: { id: string } | undefined;
    onSave?: () => void;
    onCancel?: () => void;
  }> | null>(null);
  const [guidedMode, setGuidedMode] = useState(true);
  const [versionHistoryRuleId, setVersionHistoryRuleId] = useState<string | null>(null);

  // NEW: sorting, trigger filter, error filter
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<string>("");
  const [errorFilter, setErrorFilter] = useState<ErrorFilterValue>("all");
  const [sortBy, setSortBy] = useState<SortField>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // NEW: global logs
  const [globalLogsOpen, setGlobalLogsOpen] = useState(false);
  const [globalLogs, setGlobalLogs] = useState<
    (AutomationRunLog & { automation_flows?: { name: string } })[]
  >([]);
  const [globalLogsLoading, setGlobalLogsLoading] = useState(false);
  const [globalLogsFilter, setGlobalLogsFilter] = useState<{
    ruleId: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  }>({ ruleId: "", status: "", dateFrom: "", dateTo: "" });

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

  function openCreateDialog() {
    setEditingRule(null);
    setBuilderOpen(true);
  }

  function openEditDialog(rule: AutomationRule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

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

  async function saveWizardFlow(flow: WizardFlowPayload) {
    if (!isAdmin) return toast.error("Solo amministratori");

    // Validate flow before saving
    const validation = validateWizardPayload(flow);
    if (!validation.valid) {
      const sections = groupErrorsBySection(validation.errors);
      // Build detailed error message
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
      version: (editingRule?.version ?? 0) + 1,
      flow_definition: buildFlowDefinition(flow),
      created_by: currentUserId,
      updated_by: currentUserId,
    };

    try {
      if (editingRule) {
        const previousSnapshot = editingRule;
        const data = await updateMut.mutateAsync({
          id: editingRule.id,
          payload: payload as Partial<AutomationFlow>,
        });
        await createVersion(
          "automation_flows",
          editingRule.id,
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
      setBuilderOpen(false);
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

  async function deleteRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    setConfirmDeleteRule(rule);
  }

  async function confirmDeleteRuleAction() {
    if (!confirmDeleteRule) return;
    try {
      await deleteMut.mutateAsync(confirmDeleteRule.id);
      setConfirmDeleteRule(null);
      toast.success("Automazione eliminata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore eliminazione");
    }
  }

  async function cancelDeleteRule() {
    setConfirmDeleteRule(null);
  }

  async function archiveRule(rule: AutomationRule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    setConfirmArchiveRule(rule);
  }

  async function confirmArchiveRuleAction() {
    if (!confirmArchiveRule) return;
    try {
      const { data: fdata } = await supabase
        .from("automation_flows")
        .select("flow_definition")
        .eq("id", confirmArchiveRule.id)
        .single();
      const fd: AutomationFlowDefinition =
        (fdata?.flow_definition as AutomationFlowDefinition) ?? {};
      const meta: FlowDefinitionMeta = (fd.meta as FlowDefinitionMeta) ?? {};
      meta.archived = true;
      meta.archived_at = new Date().toISOString();
      fd.meta = meta;
      await archiveMut.mutateAsync({ id: confirmArchiveRule.id, fd });
      await createVersion(
        "automation_flows",
        confirmArchiveRule.id,
        { ...confirmArchiveRule, active: false, flow_definition: fd },
        {
          active: { from: confirmArchiveRule.active, to: false },
          flow_definition: { from: confirmArchiveRule.flow_definition, to: fd },
        },
        "Automazione archiviata",
        "update",
      );
      setConfirmArchiveRule(null);
      toast.success("Automazione archiviata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore archivio");
    }
  }

  async function cancelArchiveRule() {
    setConfirmArchiveRule(null);
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
    // Open confirmation dialog for real runs
    setConfirmRunRule(rule);
  }

  async function confirmRunRuleAction() {
    if (!confirmRunRule || !session?.access_token) return;
    setConfirmRunLoading(true);
    try {
      const log = await executeRun({
        data: {
          accessToken: session.access_token,
          automationId: confirmRunRule.id,
          isDryRun: false,
          triggerPayload: { source: "manual_run" },
        },
      });
      const runLog = AutomationRunLogSchema.parse(log);
      setLogsByRule((current) => {
        const prev = Array.isArray(current[confirmRunRule.id]) ? current[confirmRunRule.id] : [];
        return { ...current, [confirmRunRule.id]: [runLog, ...prev].slice(0, 20) };
      });
      setLogsOpenRuleId(confirmRunRule.id);
      await loadStats();
      await listQuery.refetch();
      setConfirmRunRule(null);
      toast.success("Run manuale completata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run non riuscita");
    } finally {
      setConfirmRunLoading(false);
    }
  }

  async function cancelRunRule() {
    setConfirmRunRule(null);
  }

  // NEW: global logs
  const loadGlobalLogs = useCallback(async () => {
    if (!session?.access_token) return;
    setGlobalLogsLoading(true);
    try {
      const logs = await loadAllRunLogs({
        data: {
          accessToken: session.access_token,
          automationId: globalLogsFilter.ruleId || undefined,
          status: globalLogsFilter.status || undefined,
          dateFrom: globalLogsFilter.dateFrom || undefined,
          dateTo: globalLogsFilter.dateTo || undefined,
        },
      });
      setGlobalLogs(logs ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento log globali");
    } finally {
      setGlobalLogsLoading(false);
    }
  }, [globalLogsFilter, loadAllRunLogs, session?.access_token]);

  useEffect(() => {
    if (globalLogsOpen && session?.access_token) {
      void loadGlobalLogs();
    }
  }, [globalLogsOpen, loadGlobalLogs, session?.access_token]);

  // NEW: export logs CSV
  function exportLogsCsv() {
    if (globalLogs.length === 0) {
      toast.error("Nessun log da esportare");
      return;
    }
    const headers = ["Regola", "Trigger", "Timestamp", "Esito", "Durata (ms)", "Errore"];
    const rows = globalLogs.map((log) => [
      log.automation_flows?.name ?? log.automation_id,
      log.triggered_by ?? "-",
      log.triggered_at,
      log.is_dry_run ? "dry_run" : log.status,
      log.duration_ms?.toString() ?? "-",
      log.error_message ?? "",
    ]);
    const csv =
      "\uFEFF" +
      headers.join(";") +
      "\n" +
      rows
        .map((row) => row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(";"))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automation-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Log esportati");
  }

  const filteredRules = useMemo(() => {
    const filtered = rules.filter((rule) => {
      if (categoryFilter && rule.category !== categoryFilter) return false;
      const status = ruleLifecycleStatus(rule);
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
      // trigger type filter
      if (triggerTypeFilter) {
        const ruleTrigger = getRuleTriggerType(rule);
        if (ruleTrigger !== triggerTypeFilter) return false;
      }
      // error filter
      if (errorFilter === "errors") {
        const stats = runStats[rule.id];
        if (!stats || stats.health === "healthy" || stats.health === "never_run") return false;
      }
      if (errorFilter === "active") {
        if (!rule.active) return false;
      }
      if (errorFilter === "inactive") {
        if (rule.active) return false;
      }
      return true;
    });

    // sorting
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = (a.name || "").localeCompare(b.name || "");
      } else if (sortBy === "last_run") {
        const aTime = a.last_run_at ? new Date(a.last_run_at).getTime() : 0;
        const bTime = b.last_run_at ? new Date(b.last_run_at).getTime() : 0;
        cmp = aTime - bTime;
      } else if (sortBy === "executions") {
        const aCount = runStats[a.id]?.success ?? 0;
        const bCount = runStats[b.id]?.success ?? 0;
        cmp = aCount - bCount;
      } else {
        // created — use updated_at as proxy
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        cmp = aTime - bTime;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [
    rules,
    categoryFilter,
    statusFilter,
    searchQuery,
    triggerTypeFilter,
    errorFilter,
    sortBy,
    sortOrder,
    runStats,
  ]);

  return {
    rules,
    filteredRules,
    runStats,
    kpis,
    logsByRule,
    logsOpenRuleId,
    loadingLogsRuleId,
    dryRunRule,
    dryRunDialogOpen,
    setDryRunDialogOpen,
    runningRuleId,
    // Confirmation states
    confirmDeleteRule,
    setConfirmDeleteRule,
    confirmArchiveRule,
    setConfirmArchiveRule,
    confirmRunRule,
    confirmRunLoading,
    builderOpen,
    setBuilderOpen,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    expandedRuleId,
    setExpandedRuleId,
    editingRule,
    AutomationBuilderComp,
    guidedMode,
    setGuidedMode,
    versionHistoryRuleId,
    setVersionHistoryRuleId,
    loadingRules,
    listQuery,
    isAdmin,
    session,
    openCreateDialog,
    openEditDialog,
    saveWizardFlow,
    duplicateRule,
    deleteRule,
    confirmDeleteRuleAction,
    cancelDeleteRule,
    archiveRule,
    confirmArchiveRuleAction,
    cancelArchiveRule,
    toggleLogs,
    runRule,
    confirmRunRuleAction,
    cancelRunRule,
    toggleRule,
    // NEW exports
    triggerTypeFilter,
    setTriggerTypeFilter,
    errorFilter,
    setErrorFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    globalLogsOpen,
    setGlobalLogsOpen,
    globalLogs,
    globalLogsLoading,
    globalLogsFilter,
    setGlobalLogsFilter,
    loadGlobalLogs,
    exportLogsCsv,
  };
}
