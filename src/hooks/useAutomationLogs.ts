import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listAutomationRunLogs,
  listAllAutomationRunLogs,
  type AutomationRunLog,
} from "@/lib/automation-runs";
import { AutomationRunLogSchema } from "@/types/automation";
import type { AutomationRule } from "@/types/automation";

/**
 * Hook specializzato: gestisce logs per singola regola, logs globali,
 * e export CSV.
 */
export function useAutomationLogs(session: { access_token?: string } | null) {
  const loadRunLogs = useServerFn(listAutomationRunLogs);
  const loadAllRunLogs = useServerFn(listAllAutomationRunLogs);

  const [logsByRule, setLogsByRule] = useState<Record<string, AutomationRunLog[]>>({});
  const [logsOpenRuleId, setLogsOpenRuleId] = useState<string | null>(null);
  const [loadingLogsRuleId, setLoadingLogsRuleId] = useState<string | null>(null);

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

  return {
    logsByRule,
    setLogsByRule,
    logsOpenRuleId,
    setLogsOpenRuleId,
    loadingLogsRuleId,
    setLoadingLogsRuleId,
    globalLogsOpen,
    setGlobalLogsOpen,
    globalLogs,
    setGlobalLogs,
    globalLogsLoading,
    setGlobalLogsLoading,
    globalLogsFilter,
    setGlobalLogsFilter,
    loadGlobalLogs,
    exportLogsCsv,
    toggleLogs,
  };
}
