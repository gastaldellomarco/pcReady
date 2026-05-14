import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import AutomationWizard from "@/components/automations/AutomationWizard";
import { DryRunDialog } from "@/components/automations/DryRunDialog";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { useAutomationRules } from "@/hooks/useAutomationRules";
import { AutomationRuleCard } from "@/components/automations/AutomationRuleCard";
import { AutomationKpiCard } from "@/components/automations/AutomationKpiCard";
import { AUTOMATION_CATEGORY_OPTIONS } from "@/lib/automations/automation-ui-constants";

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
    openCreateDialog,
    openEditDialog,
    toggleRule,
    saveWizardFlow,
    duplicateRule,
    deleteRule,
    archiveRule,
    toggleLogs,
    runRule,
  } = useAutomationRules();

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
              {AUTOMATION_CATEGORY_OPTIONS.map((c) => (
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
          <AutomationKpiCard
            label="Automazioni attive"
            value={kpis?.activeAutomations ?? rules.filter((r) => r.active).length}
          />
          <AutomationKpiCard
            label="Run oggi"
            value={`${kpis?.runsToday ?? 0} (${kpis?.successToday ?? 0}/${kpis?.errorToday ?? 0})`}
          />
          <AutomationKpiCard label="Successo 7 giorni" value={`${kpis?.successRate7d ?? 100}%`} />
          <AutomationKpiCard label="Errori recenti" value={kpis?.automationsWithRecentErrors ?? 0} />
        </div>

        <div className="pc-card-body space-y-3">
          {loadingRules && <div className="text-sm text-text3">Caricamento regole...</div>}
          {!loadingRules && rules.length === 0 && (
            <div className="text-sm text-text3">Nessuna regola disponibile.</div>
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
