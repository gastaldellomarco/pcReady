import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import queries from "@/lib/queries/automations";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
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
} from "@/lib/automation-runs";
import { randomUUID } from "@/lib/random-uuid";
import { createVersion } from "@/lib/versioning";

function ruleLifecycleStatus(rule: AutomationRule): string {
  const meta = rule.flow_definition?.meta ?? {};
  if (meta.archived) return "archived";
  if (meta.paused) return "paused";
  if (rule.active) return "active";
  if (rule.version && rule.version === 1) return "draft";
  return "validated";
}

export function useAutomationRules() {
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
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [AutomationBuilderComp, setAutomationBuilderComp] = useState<any>(null);
  const [guidedMode, setGuidedMode] = useState(true);
  const [versionHistoryRuleId, setVersionHistoryRuleId] = useState<string | null>(null);

  const {
    useAutomationFlows,
    useCreateAutomation,
    useUpdateAutomation,
    useDeleteAutomation,
    useDuplicateAutomation,
    useArchiveAutomation,
    useToggleAutomation,
  } = queries as any;
  const listQuery = useAutomationFlows();
  const createMut = useCreateAutomation();
  const updateMut = useUpdateAutomation();
  const deleteMut = useDeleteAutomation();
  const duplicateMut = useDuplicateAutomation();
  const archiveMut = useArchiveAutomation();
  const toggleMut = useToggleAutomation();
  const loadingRules = listQuery.isLoading;

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
  }, [listQuery.data]);

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

  async function saveWizardFlow(flow: any) {
      if (!isAdmin) return toast.error("Solo amministratori");
      function uid() {
        return randomUUID();
      }

      function buildFlowDefinition(flowObj: any) {
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
        const e = err as any;
        const userMsg =
          e && typeof e === "object" && (e.message || e.error || e.details)
            ? e.message || e.error || e.details
            : err instanceof Error
              ? err.message
              : JSON.stringify(err);
        toast.error(userMsg || "Errore salvataggio");
      }
  }

  async function duplicateRule(rule: AutomationRule) {
      if (!isAdmin) return toast.error("Solo amministratori");
      try {
        const newId = await duplicateMut.mutateAsync({ id: rule.id, name: `${rule.name} (Copia)` });
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
      try {
        await deleteMut.mutateAsync(rule.id);
        toast.success("Automazione eliminata");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore eliminazione");
      }
  }

  async function archiveRule(rule: AutomationRule) {
      if (!isAdmin) return toast.error("Solo amministratori");
      try {
        const { data: fdata } = await supabase
          .from("automation_flows")
          .select("flow_definition")
          .eq("id", rule.id)
          .single();
        const fd: any = fdata?.flow_definition ?? {};
        const meta: any = fd.meta ?? {};
        meta.archived = true;
        fd.meta = meta;
        await archiveMut.mutateAsync({ id: rule.id, fd });
        await createVersion(
          "automation_flows",
          rule.id,
          { ...rule, active: false, flow_definition: fd },
          {
            active: { from: rule.active, to: false },
            flow_definition: { from: rule.flow_definition, to: fd },
          },
          "Automazione archiviata",
          "update",
        );
        toast.success("Automazione archiviata");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Errore archivio");
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

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
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
      return true;
    });
  }, [rules, categoryFilter, statusFilter, searchQuery]);

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
    toggleRule,
    saveWizardFlow,
    duplicateRule,
    deleteRule,
    archiveRule,
    toggleLogs,
    runRule,
  };
}
