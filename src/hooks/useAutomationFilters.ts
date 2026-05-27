import { useMemo, useState } from "react";
import type { AutomationRule } from "@/types/automation";
import type { AutomationRunStats } from "@/lib/automation-runs";
import { getRuleTriggerType } from "./automation-constants";

export type SortField = "name" | "last_run" | "executions" | "created";
export type SortOrder = "asc" | "desc";
export type ErrorFilterValue = "all" | "active" | "inactive" | "errors";

function ruleLifecycleStatus(rule: AutomationRule): string {
  const meta = rule.flow_definition?.meta ?? {};
  if (meta.archived) return "archived";
  if (meta.paused) return "paused";
  if (rule.active) return "active";
  if (rule.version && rule.version === 1) return "draft";
  return "validated";
}

/**
 * Hook specializzato: gestisce stato filtri, sorting e filteredRules.
 * Dipende da rules e runStats (passati dall'hook padre).
 */
export function useAutomationFilters(
  rules: AutomationRule[],
  runStats: Record<string, AutomationRunStats>,
) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<string>("");
  const [errorFilter, setErrorFilter] = useState<ErrorFilterValue>("all");
  const [sortBy, setSortBy] = useState<SortField>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

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
      if (triggerTypeFilter) {
        const ruleTrigger = getRuleTriggerType(rule);
        if (ruleTrigger !== triggerTypeFilter) return false;
      }
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
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        cmp = aTime - bTime;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [rules, categoryFilter, statusFilter, searchQuery, triggerTypeFilter, errorFilter, sortBy, sortOrder, runStats]);

  return {
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    triggerTypeFilter,
    setTriggerTypeFilter,
    errorFilter,
    setErrorFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    filteredRules,
  };
}
