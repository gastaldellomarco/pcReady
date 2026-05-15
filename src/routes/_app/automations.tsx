import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ScrollText, Search, ArrowUpDown } from "lucide-react";
import AutomationWizard from "@/components/automations/AutomationWizard";
import { DryRunDialog } from "@/components/automations/DryRunDialog";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { AutomationRuleCard } from "@/components/automations/AutomationRuleCard";
import type { WizardFlowPayload } from "@/types/automation";
import { AutomationKpiHeader } from "@/components/automations/AutomationKpiHeader";
import { GlobalRunLogsPanel } from "@/components/automations/GlobalRunLogsPanel";
import { AUTOMATION_CATEGORY_OPTIONS } from "@/lib/automations/automation-ui-constants";
import { TRIGGER_TYPE_OPTIONS } from "@/hooks/useAutomationRules";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automazioni — PCReady" }] }),
  component: AutomationsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

function AutomationsPage() {
  const {
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
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
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
    openCreateDialog,
    openEditDialog,
    toggleRule,
    saveWizardFlow,
    duplicateRule,
    deleteRule,
    archiveRule,
    toggleLogs,
    runRule,
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
  } = useAutomationRules();

  // Quick filter pills config
  const errorFilterOptions = [
    { value: "all" as const, label: "Tutte" },
    { value: "active" as const, label: "Attive" },
    { value: "inactive" as const, label: "Inattive" },
    { value: "errors" as const, label: "Con errori" },
  ];

  const sortOptions = [
    { value: "created" as const, label: "Data creazione" },
    { value: "name" as const, label: "Nome" },
    { value: "last_run" as const, label: "Ultima esecuzione" },
    { value: "executions" as const, label: "N. esecuzioni" },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Header */}
      <AutomationKpiHeader rules={rules} kpis={kpis} />

      {/* Search + Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface2 p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text3" />
          <input
            placeholder="Cerca regola..."
            className="w-full rounded-md border border-border pl-8 pr-3 py-1.5 text-sm bg-background"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Quick filters */}
        <div className="flex items-center gap-1">
          {errorFilterOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setErrorFilter(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                errorFilter === opt.value
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface3 text-text3 hover:bg-surface3/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Trigger type filter */}
        <select
          className="rounded-md border border-border px-2 py-1.5 text-xs bg-background"
          value={triggerTypeFilter}
          onChange={(e) => setTriggerTypeFilter(e.target.value)}
        >
          {TRIGGER_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3.5 w-3.5 text-text3" />
          <select
            className="rounded-md border border-border px-2 py-1.5 text-xs bg-background"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="rounded-md border border-border px-1.5 py-1.5 text-xs bg-background hover:bg-surface3"
            title={sortOrder === "asc" ? "Ascendente" : "Discendente"}
          >
            {sortOrder === "asc" ? "\u2191" : "\u2193"}
          </button>
        </div>

        {/* Category filter */}
        <select
          className="rounded-md border border-border px-2 py-1.5 text-xs bg-background"
          value={categoryFilter ?? ""}
          onChange={(e) => setCategoryFilter(e.target.value || null)}
        >
          <option value="">Tutte le categorie</option>
          {AUTOMATION_CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGlobalLogsOpen(!globalLogsOpen)}
            className="gap-1.5"
          >
            <ScrollText className="h-4 w-4" />
            Log
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreateDialog}
            disabled={!isAdmin}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nuova regola
          </Button>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {loadingRules && (
          <div className="py-8 text-center text-sm text-text3">
            Caricamento regole...
          </div>
        )}
        {!loadingRules && filteredRules.length === 0 && (
          <div className="py-8 text-center text-sm text-text3">
            Nessuna regola trovata.{searchQuery ? ' Prova a modificare la ricerca.' : ''}
          </div>
        )}
        {!loadingRules &&
          filteredRules.map((rule) => (
            <AutomationRuleCard
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
              onExpandToggle={() =>
                setExpandedRuleId((current) => (current === rule.id ? null : rule.id))
              }
              onToggleLogs={() => void toggleLogs(rule)}
              onOpenVersions={() => setVersionHistoryRuleId(rule.id)}
              onRunNow={() => void runRule(rule, false)}
              onDryRun={() => void runRule(rule, true)}
              onDuplicate={() => void duplicateRule(rule)}
              onDelete={() => void deleteRule(rule)}
              onArchive={() => void archiveRule(rule)}
            />
          ))}
      </div>

      {/* Global Logs Panel */}
      {globalLogsOpen && (
        <GlobalRunLogsPanel
          logs={globalLogs}
          loading={globalLogsLoading}
          rules={rules}
          filters={globalLogsFilter}
          onFilterChange={setGlobalLogsFilter}
          onRefresh={() => void loadGlobalLogs()}
          onExportCsv={exportLogsCsv}
        />
      )}

      {/* Builder/Wizard Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Modifica automazione" : "Nuova automazione"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-2 flex gap-2 items-center">
            <label
              className={`cursor-pointer px-2 py-1 rounded ${
                guidedMode ? "bg-slate-100" : ""
              }`}
            >
              <input
                type="radio"
                name="builderMode"
                checked={guidedMode}
                onChange={() => setGuidedMode(true)}
                className="sr-only"
              />{" "}
              Modalita guidata
            </label>
            <label
              className={`cursor-pointer px-2 py-1 rounded ${
                !guidedMode ? "bg-slate-100" : ""
              }`}
            >
              <input
                type="radio"
                name="builderMode"
                checked={!guidedMode}
                onChange={() => setGuidedMode(false)}
                className="sr-only"
              />{" "}
              Modalita avanzata
            </label>
          </div>

          {guidedMode ? (
            <div className="p-4">
              <AutomationWizard
                initial={
                  editingRule
                    ? ({
                        ...editingRule,
                        ...(editingRule.flow_definition?.meta?.wizard ?? {}),
                      } as WizardFlowPayload & { version?: number })
                    : undefined
                }
                onSave={saveWizardFlow}
                onCancel={() => setBuilderOpen(false)}
                onTest={
                  editingRule
                    ? () => void runRule(editingRule, true)
                    : undefined
                }
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

      <DryRunDialog
        open={dryRunDialogOpen}
        rule={dryRunRule}
        onOpenChange={setDryRunDialogOpen}
      />
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
