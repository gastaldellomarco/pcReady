import { createLazyFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
import { RunConfirmDialog } from "@/components/automations/RunConfirmDialog";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { AutomationRuleCard } from "@/components/automations/AutomationRuleCard";
import type { WizardFlowPayload } from "@/types/automation";
import { AutomationKpiHeader } from "@/components/automations/AutomationKpiHeader";
import { GlobalRunLogsPanel } from "@/components/automations/GlobalRunLogsPanel";
import { AUTOMATION_CATEGORY_OPTIONS } from "@/lib/automations/automation-ui-constants";
import { TRIGGER_TYPE_OPTIONS } from "@/hooks/useAutomationRules";

export const Route = createLazyFileRoute("/_app/automations")({
  component: AutomationsPage,
});

function AutomationsPage() {
  const { t } = useTranslation("automations");
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
    confirmDeleteRuleAction,
    cancelDeleteRule,
    confirmArchiveRuleAction,
    cancelArchiveRule,
    confirmRunRuleAction,
    cancelRunRule,
    confirmRunLoading,
    confirmDeleteRule,
    confirmArchiveRule,
    confirmRunRule,
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
    { value: "all" as const, label: t("filters.all", "Tutte") },
    { value: "active" as const, label: t("filters.active", "Attive") },
    { value: "inactive" as const, label: t("filters.inactive", "Inattive") },
    { value: "errors" as const, label: t("filters.error", "Con errori") },
  ];

  const sortOptions = [
    { value: "created" as const, label: t("sort.createdAt", "Data creazione") },
    { value: "name" as const, label: t("sort.name", "Nome") },
    { value: "last_run" as const, label: t("sort.lastRun", "Ultima esecuzione") },
    { value: "executions" as const, label: t("sort.executions", "N. esecuzioni") },
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
            placeholder={t("search.placeholder", "Cerca regola...")}
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
            title={sortOrder === "asc" ? t("sort.ascending", "Ascendente") : t("sort.descending", "Discendente")}
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
          <option value="">{t("filters.allCategories", "Tutte le categorie")}</option>
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
            {t("logs.button", "Log")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreateDialog}
            disabled={!isAdmin}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {t("newRule", "Nuova regola")}
          </Button>
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {loadingRules && (
          <div className="py-8 text-center text-sm text-text3">
            {t("loading", "Caricamento regole...")}
          </div>
        )}
        {!loadingRules && filteredRules.length === 0 && (
          <div className="py-8 text-center text-sm text-text3">
            {t("empty.noRules", "Nessuna regola trovata.")}{searchQuery ? ' ' + t("empty.trySearch", "Prova a modificare la ricerca.") : ''}
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
        <DialogContent className="max-w-3xl max-h-[95dvh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>
              {editingRule ? t("dialog.editTitle", "Modifica automazione") : t("dialog.newTitle", "Nuova automazione")}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-3 pb-0 flex gap-2 items-center shrink-0 border-b border-border">
            <label
              className={`cursor-pointer px-3 py-2 text-sm rounded-t border-b-2 transition-colors ${
                guidedMode ? "border-accent text-accent font-medium" : "border-transparent text-text3 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="builderMode"
                checked={guidedMode}
                onChange={() => setGuidedMode(true)}
                className="sr-only"
              />
              {t("builder.guided", "Guided mode")}
            </label>
            <label
              className={`cursor-pointer px-3 py-2 text-sm rounded-t border-b-2 transition-colors ${
                !guidedMode ? "border-accent text-accent font-medium" : "border-transparent text-text3 hover:text-foreground"
              }`}
            >
              <input
                type="radio"
                name="builderMode"
                checked={!guidedMode}
                onChange={() => setGuidedMode(false)}
                className="sr-only"
              />
              {t("builder.advanced", "Advanced mode")}
            </label>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
          {guidedMode ? (
            <div className="p-6 pb-2">
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
            <div className="p-6">{t("editor.loading", "Caricamento editor...")}</div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <DryRunDialog
        open={dryRunDialogOpen}
        rule={dryRunRule}
        onOpenChange={setDryRunDialogOpen}
      />

      {/* Delete Confirmation */}
      <DestructiveConfirmDialog
        open={!!confirmDeleteRule}
        title={t("delete.title", "Elimina automazione")}
        description={
          confirmDeleteRule
            ? t("delete.description", 'Sei sicuro di voler eliminare definitivamente "{{name}}"? Questa azione non può essere annullata.', { name: confirmDeleteRule.name })
            : ""
        }
        confirmLabel={t("delete.confirm", "Elimina")}
        onOpenChange={() => void cancelDeleteRule()}
        onConfirm={() => void confirmDeleteRuleAction()}
      />

      {/* Archive Confirmation */}
      <DestructiveConfirmDialog
        open={!!confirmArchiveRule}
        title={t("archive.title", "Archivia automazione")}
        description={
          confirmArchiveRule
            ? t("archive.description", 'Archiviare "{{name}}"? L\'automazione verrà disattivata e nascosta dall\'elenco principale. Puoi sempre ripristinarla dalle versioni.', { name: confirmArchiveRule.name })
            : ""
        }
        confirmLabel={t("archive.confirm", "Archivia")}
        loadingLabel={t("archive.loading", "Archiviazione in corso...")}
        onOpenChange={() => void cancelArchiveRule()}
        onConfirm={() => void confirmArchiveRuleAction()}
      />

      {/* Run Confirmation */}
      <RunConfirmDialog
        open={!!confirmRunRule}
        rule={confirmRunRule}
        onOpenChange={() => void cancelRunRule()}
        onConfirm={() => void confirmRunRuleAction()}
        loading={confirmRunLoading}
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
