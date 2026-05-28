import OverflowTable from "@/components/ui/overflow-table";

import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Ban,
  CreditCard,
  Download,
  Filter,
  History,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { LoadingSkeleton } from "@/components/RouteHelpers";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { BundleForm, AssignmentForm } from "@/components/bundles/BundleForms";
import {
  BundlePriorityBadge,
  BundleStatusBadge,
  BundleUsageBar,
} from "@/components/bundles/BundleBadges";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";
import {
  BILLING_TYPE_LABEL,
  BUNDLE_STATUS_LABEL,
  formatBundleHours,
  formatBundleMoney,
  formatBundleVisits,

  type AssistanceBundle,
  type BundlePayment,
  type BundleUsageSummary,
  type ClientBundleAssignment,
  useBundleAssignments,
  useBundles,
  useBundleUsageSummaries,
  useCancelBundleAssignmentMutation,
  useCreateBundleAssignmentMutation,
  useCreateBundleMutation,
  useCreateBundlePaymentMutation,
  useDeleteBundleAssignmentMutation,
  useDeleteBundlePaymentMutation,
  useUpdateBundleAssignmentMutation,
  useUpdateBundleMutation,
} from "@/lib/bundles";
import { useAssignmentManager } from "@/hooks/use-assignment-manager";
import { useBundleManager } from "@/hooks/use-bundle-manager";
import { useBillingManager, type PaymentDraft } from "@/hooks/use-billing-manager";
import { useMonthlyUsage } from "@/hooks/use-monthly-usage";
import { errorMessage } from "@/lib/errors";

export const Route = createLazyFileRoute("/_app/bundles")({
  component: BundlesPage,
});

type BundleTab = "catalog" | "assignments" | "usage" | "billing";
type ClientOption = {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
};

function BundlesPage() {
  const { t } = useTranslation("bundles");
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const canManageAssignments = profile?.role === "admin" || profile?.role === "tech";
  const [activeTab, setActiveTab] = useState<BundleTab>("catalog");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const bundlesQuery = useBundles(true);
  const assignmentsQuery = useBundleAssignments();
  const usageQuery = useBundleUsageSummaries();

  const monthlyUsage = useMonthlyUsage({
    assignmentsDataUpdatedAt: assignmentsQuery.dataUpdatedAt,
    usageDataUpdatedAt: usageQuery.dataUpdatedAt,
  });
  const createBundleMutation = useCreateBundleMutation();
  const updateBundleMutation = useUpdateBundleMutation();
  const createAssignmentMutation = useCreateBundleAssignmentMutation();
  const updateAssignmentMutation = useUpdateBundleAssignmentMutation();
  const cancelAssignmentMutation = useCancelBundleAssignmentMutation();
  const deleteAssignmentMutation = useDeleteBundleAssignmentMutation();
  const createPaymentMutation = useCreateBundlePaymentMutation();
  const deletePaymentMutation = useDeleteBundlePaymentMutation();

  const bundles = useMemo(() => bundlesQuery.data ?? [], [bundlesQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const filteredAssignments = useMemo(() => {
    const data = assignmentsQuery.data ?? [];
    return showAllAssignments ? data : data.filter((a) => a.status === "active");
  }, [assignmentsQuery.data, showAllAssignments]);
  const usageSummaries = useMemo(() => usageQuery.data ?? [], [usageQuery.data]);

  const assignmentById = useMemo(() => {
    return new Map(assignments.map((assignment) => [assignment.id, assignment]));
  }, [assignments]);

  const bundleManager = useBundleManager({
    isAdmin,
    userId: profile?.id ?? null,
    mutations: {
      create: createBundleMutation,
      update: updateBundleMutation,
    },
  });

  const assignmentManager = useAssignmentManager({
    canManage: canManageAssignments,
    userId: profile?.id ?? null,
    mutations: {
      create: createAssignmentMutation,
      update: updateAssignmentMutation,
      cancel: cancelAssignmentMutation,
      remove: deleteAssignmentMutation,
    },
  });

  const billing = useBillingManager({
    canManage: canManageAssignments,
    userId: profile?.id ?? null,
    assignmentById,
    mutations: {
      create: createPaymentMutation,
      remove: deletePaymentMutation,
    },
  });

  useEffect(() => {
    let active = true;
    setClientLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("id, name, company_name, email")
          .order("name");
        if (error) throw error;
        if (active) setClients((data ?? []) as ClientOption[]);
      } catch (error: unknown) {
        if (active)       toast.error(errorMessage(error, t("errors.loadClients", "Errore caricamento clienti")));
      } finally {
        if (active) setClientLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    billing.refreshPayments();
  }, [assignmentsQuery.dataUpdatedAt, usageQuery.dataUpdatedAt]);

  const stats = useMemo(() => {
    const activeBundles = bundles.filter((bundle) => bundle.active).length;
    const activeAssignments = assignments.filter(
      (assignment) => assignment.status === "active",
    ).length;
    const risky = usageSummaries.filter(
      (summary) => Number(summary.usage_percent ?? 0) >= 80,
    ).length;
    const extraAmount = usageSummaries.reduce(
      (sum, summary) => sum + Number(summary.extra_amount ?? 0),
      0,
    );
    return { activeBundles, activeAssignments, risky, extraAmount };
  }, [assignments, bundles, usageSummaries]);

  function resetAllForms() {
    bundleManager.resetForms();
    assignmentManager.resetForms();
  }

  function exportCsv() {
    const rows = [
      [
        t("clientName", "Cliente"),
        t("catalog.type", "Bundle"),
        t("assignments.table.status", "Stato"),
        t("csv.hoursUsed", "Ore usate"),
        t("csv.hoursIncluded", "Ore incluse"),
        t("csv.hoursRemaining", "Ore residue"),
        t("csv.extraHours", "Extra ore"),
        t("csv.extraAmount", "Extra importo"),
        t("csv.expiry", "Scadenza"),
      ],
      ...usageSummaries.map((summary) => {
        const assignment = assignmentById.get(summary.client_bundle_assignment_id as string);
        return [
          clientName(assignment),
          assignment?.bundle?.name ?? summary.bundle_id,
          assignment?.status ? BUNDLE_STATUS_LABEL[assignment.status] : (summary.status ?? "-"),
          summary.used_hours ?? 0,
          effectiveIncludedHours(summary, assignment) ?? "Illimitate",
          summary.remaining_hours ?? "Illimitate",
          summary.extra_hours ?? 0,
          summary.extra_amount ?? 0,
          assignment?.end_date ?? summary.end_date ?? "",
        ];
      }),
    ];
    downloadCsv(rows, buildDownloadFileName("pcready-bundle-consumi", "csv", { dated: true }));
    toast.success(t("csvExported", "CSV bundle esportato"));
  }

  const loading =
    bundlesQuery.isLoading || assignmentsQuery.isLoading || usageQuery.isLoading || clientLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title flex items-center gap-2">
              <Package className="h-5 w-5 text-accent" /> {t("title", "Bundle assistenza")}
            </div>
            <div className="mt-1 text-sm text-text3">
              {t("pageDescription", "Pacchetti vendibili, SLA, assegnazioni cliente, consumi e fatturazione extra.")}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={() => {
                  resetAllForms();
                  setActiveTab("catalog");
                  bundleManager.startCreate();
                }}
              >
                <Plus className="h-3 w-3" /> {t("newBundle", "Nuovo bundle")}
              </button>
            )}
            {canManageAssignments && (
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={() => {
                  resetAllForms();
                  setActiveTab("assignments");
                  assignmentManager.startCreate();
                }}
              >
                <Plus className="h-3 w-3" /> {t("assignToClient", "Assegna a cliente")}
              </button>
            )}
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={exportCsv}>
              <Download className="h-3 w-3" /> {t("exportCsv", "Export CSV")}
            </button>
          </div>
        </div>
        <div className="pc-card-body grid gap-3 md:grid-cols-4">
          <BundleStat label={t("stats.activeBundles", "Bundle attivi")} value={stats.activeBundles} />
          <BundleStat label={t("stats.activeAssignments", "Assegnazioni attive")} value={stats.activeAssignments} />
          <BundleStat
            label={t("stats.usageAlert", "Alert consumo")}
            value={stats.risky}
            tone={stats.risky ? "warning" : "default"}
          />
          <BundleStat
            label={t("stats.billableExtra", "Extra fatturabili")}
            value={formatBundleMoney(stats.extraAmount)}
            tone="success"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
          {t("tabs.catalog", "Catalogo bundle")}
        </TabButton>
        <TabButton active={activeTab === "assignments"} onClick={() => setActiveTab("assignments")}>
          {t("tabs.assignments", "Assegnazioni clienti")}
        </TabButton>
        <TabButton active={activeTab === "usage"} onClick={() => setActiveTab("usage")}>
          {t("tabs.usage", "Consumi e alert")}
        </TabButton>
        <TabButton active={activeTab === "billing"} onClick={() => setActiveTab("billing")}>
          {t("tabs.billing", "Fatturazione")}
        </TabButton>
      </div>

      {(bundleManager.creating || bundleManager.editing) && activeTab === "catalog" && (
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">
              {bundleManager.editing ? t("editBundle", "Modifica bundle") : t("newBundle", "Nuovo bundle")}
            </div>
          </div>
          <div className="pc-card-body">
            <BundleForm
              initial={bundleManager.editing}
              onSubmit={bundleManager.save}
              onCancel={resetAllForms}
              busy={bundleManager.busy}
            />
          </div>
        </div>
      )}

      {(assignmentManager.creating || assignmentManager.editing) && activeTab === "assignments" && (
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">
              {assignmentManager.editing ? t("editAssignment", "Modifica assegnazione") : t("assignBundle", "Assegna bundle a cliente")}
            </div>
          </div>
          <div className="pc-card-body">
            <AssignmentForm
              bundles={bundles.filter(
                (bundle) => bundle.active || bundle.id === assignmentManager.editing?.bundle_id,
              )}
              clients={clients}
              initial={assignmentManager.editing}
              onSubmit={assignmentManager.save}
              onCancel={() => assignmentManager.resetForms()}
              busy={assignmentManager.busy}
            />
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {activeTab === "catalog" && (
            <CatalogTab
              bundles={bundles}
              isAdmin={isAdmin}
              onEdit={setEditingBundleWithTab}
              onToggle={bundleManager.toggle}
            />
          )}
          {activeTab === "assignments" && (
            <AssignmentsTab
              assignments={filteredAssignments}
              canManage={canManageAssignments}
              onEdit={setEditingAssignmentWithTab}
              onCancel={assignmentManager.cancel}
              onDelete={assignmentManager.remove}
              onViewUsage={() => setActiveTab("usage")}
              busy={assignmentManager.busy}
              showAll={showAllAssignments}
              onToggleShowAll={() => setShowAllAssignments((v) => !v)}
              hasHidden={!showAllAssignments && filteredAssignments.length === 0 && assignments.length > 0}
            />
          )}
          {activeTab === "usage" && usageQuery.isError ? (
            <div className="pc-card p-8 text-center">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
              <p className="text-sm text-text3">
                {t("errors.loadUsageData", "Errore caricamento dati consumi. Ricarica la pagina.")}
              </p>
            </div>
          ) : activeTab === "usage" && (
            <UsageTab
              summaries={usageSummaries}
              assignmentById={assignmentById}
              monthlyUsage={monthlyUsage}
            />
          )}
          {activeTab === "billing" && (
            <BillingTab
              assignments={assignments}
              payments={billing.payments}
              paymentDraft={billing.paymentDraft}
              setPaymentDraft={billing.setPaymentDraft}
              onSavePayment={billing.savePayment}
              onDeletePayment={billing.deletePayment}
              canManage={canManageAssignments}
              extraAmount={stats.extraAmount}
              busy={billing.busy}
            />
          )}
        </>
      )}
    </div>
  );

  function setEditingBundleWithTab(bundle: AssistanceBundle) {
    resetAllForms();
    setActiveTab("catalog");
    bundleManager.startEdit(bundle);
  }

  function setEditingAssignmentWithTab(assignment: ClientBundleAssignment) {
    resetAllForms();
    setActiveTab("assignments");
    assignmentManager.startEdit(assignment);
  }
}

function CatalogTab({
  bundles,
  isAdmin,
  onEdit,
  onToggle,
}: {
  bundles: AssistanceBundle[];
  isAdmin: boolean;
  onEdit: (bundle: AssistanceBundle) => void;
  onToggle: (bundle: AssistanceBundle) => void;
}) {
  const { t } = useTranslation("bundles");
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {bundles.map((bundle) => (
        <div key={bundle.id} className="pc-card">
          <div className="pc-card-hd">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="pc-card-title">{bundle.name}</div>
                <span
                  className={
                    bundle.active ? "pc-badge pc-badge-ready" : "pc-badge pc-badge-archived"
                  }
                >
                  {bundle.active ? t("catalog.active", "Attivo") : t("catalog.inactive", "Disattivato")}
                </span>
                <BundlePriorityBadge priority={bundle.ticket_priority} />
              </div>
              {bundle.description && (
                <div className="mt-1 text-sm text-text3">{bundle.description}</div>
              )}
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => onEdit(bundle)}>
                  <Pencil className="h-3 w-3" /> {t("catalog.edit", "Modifica")}
                </button>
                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => onToggle(bundle)}>
                  {bundle.active ? <Ban className="h-3 w-3" /> : <RefreshCcw className="h-3 w-3" />}
                  {bundle.active ? t("catalog.deactivate", "Disattiva") : t("catalog.reactivate", "Riattiva")}
                </button>
              </div>
            )}
          </div>
          <div className="pc-card-body grid gap-3 md:grid-cols-4">
            <Metric label={t("catalog.fee", "Canone")} value={formatBundleMoney(bundle.fee, bundle.currency)} />
            <Metric label={t("catalog.type", "Tipo")} value={BILLING_TYPE_LABEL[bundle.billing_type]} />
            <Metric label={t("catalog.includedHours", "Ore incluse")} value={formatBundleHours(bundle.included_hours)} />
            <Metric
              label={t("catalog.extraRate", "Tariffa extra")}
              value={formatBundleMoney(bundle.extra_hourly_rate, bundle.currency)}
            />
            <Metric label={t("catalog.slaResponse", "SLA risposta")} value={`${bundle.sla_response_hours} h`} />
            <Metric label={t("catalog.slaResolution", "SLA risoluzione")} value={`${bundle.sla_resolution_hours} h`} />
            <Metric label={t("catalog.onsite", "On-site")} value={formatBundleVisits(bundle.included_onsite_visits)} />
            <Metric label={t("catalog.remoteSupport", "Supporto remoto")} value={bundle.remote_support ? t("catalog.included", "Incluso") : t("catalog.no", "No")} />
          </div>
        </div>
      ))}
      {!bundles.length && (
        <div className="pc-card p-6 text-sm text-text3">{t("catalog.empty", "Nessun bundle configurato.")}</div>
      )}
    </div>
  );
}

function AssignmentsTab({
  assignments,
  canManage,
  busy,
  onEdit,
  onCancel,
  onDelete,
  onViewUsage,
  showAll,
  onToggleShowAll,
  hasHidden,
}: {
  assignments: ClientBundleAssignment[];
  canManage: boolean;
  busy: boolean;
  onEdit: (assignment: ClientBundleAssignment) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onViewUsage: (assignment: ClientBundleAssignment) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
  hasHidden: boolean;
}) {
  const { t } = useTranslation("bundles");
  return (      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">{t("assignments.title", "Storico bundle assegnati")}</div>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={onToggleShowAll}
            title={showAll ? t("assignments.showActiveOnly", "Mostra solo attivi") : t("assignments.showAll", "Mostra tutti")}
          >
            <Filter className="h-3 w-3" />
            {showAll ? t("assignments.showActiveOnly", "Solo attivi") : t("assignments.showAll", "Mostra tutti")}
          </button>
        </div>

        {/* Mobile card view */}
        <div className="md:hidden flex flex-col gap-3 p-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{clientName(assignment)}</div>
                  <div className="text-xs text-text3">{assignment.bundle?.name ?? "-"}</div>
                </div>
                <BundleStatusBadge status={assignment.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-text3">{t("assignments.table.period", "Periodo")}:</span> <span className="font-mono">{assignment.start_date} → {assignment.end_date ?? t("assignments.noExpiry", "senza scadenza")}</span></div>
                <div><span className="text-text3">{t("assignments.table.renewal", "Rinnovo")}:</span> <span>{assignment.auto_renew ? t("assignments.autoRenew", "Automatico") : t("assignments.manualRenew", "Manuale")}</span></div>
                <div><span className="text-text3">{t("assignments.table.fee", "Canone")}:</span> <span className="font-mono">{formatBundleMoney(assignment.custom_fee ?? assignment.bundle?.fee ?? 0, assignment.bundle?.currency ?? "EUR")}</span></div>
                {assignment.notes && <div className="col-span-2"><span className="text-text3">{t("assignments.table.notes", "Note")}:</span> <span className="text-text2">{assignment.notes}</span></div>}
              </div>
              {canManage && (
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <button className="pc-btn pc-btn-ghost pc-btn-xs" onClick={() => onEdit(assignment)} title={t("assignments.edit", "Modifica assegnazione")}>
                    <Pencil className="h-3 w-3" /> {t("assignments.edit", "Modifica")}
                  </button>
                  <button className="pc-btn pc-btn-ghost pc-btn-xs" onClick={() => onViewUsage(assignment)} title={t("assignments.viewUsage", "Storico consumo")}>
                    <History className="h-3 w-3" /> {t("assignments.viewUsage", "Consumo")}
                  </button>
                  {assignment.status === "active" && (
                    <button className="pc-btn pc-btn-ghost pc-btn-xs" onClick={() => onCancel(assignment.id)} title={t("assignments.cancel", "Annulla assegnazione")}>
                      <Ban className="h-3 w-3" /> {t("assignments.cancel", "Annulla")}
                    </button>
                  )}
                  {assignment.status !== "active" && (
                    <button className="pc-btn pc-btn-ghost pc-btn-xs text-destructive" onClick={() => onDelete(assignment.id)} disabled={busy} title={t("assignments.delete", "Elimina")}>
                      <Trash2 className="h-3 w-3" /> {t("assignments.delete", "Elimina")}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {!assignments.length && (
            <div className="py-8 text-center text-sm text-text3">
              {hasHidden ? t("assignments.emptyActive", "Nessuna assegnazione attiva.") : t("assignments.empty", "Nessuna assegnazione.")}
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <OverflowTable>
            <table className="w-full min-w-[980px] text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {[t("assignments.table.client", "Cliente"), t("assignments.table.bundle", "Bundle"), t("assignments.table.status", "Stato"), t("assignments.table.period", "Periodo"), t("assignments.table.renewal", "Rinnovo"), t("assignments.table.fee", "Canone"), t("assignments.table.notes", "Note"), t("assignments.table.actions", "Azioni")].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-semibold">{clientName(assignment)}</td>
                <td className="px-3 py-2">{assignment.bundle?.name ?? "-"}</td>
                <td className="px-3 py-2">
                  <BundleStatusBadge status={assignment.status} />
                </td>
                <td className="px-3 py-2 font-mono">
                  {assignment.start_date} → {assignment.end_date ?? t("assignments.noExpiry", "senza scadenza")}
                </td>
                <td className="px-3 py-2">{assignment.auto_renew ? t("assignments.autoRenew", "Automatico") : t("assignments.manualRenew", "Manuale")}</td>
                <td className="px-3 py-2 font-mono">
                  {formatBundleMoney(
                    assignment.custom_fee ?? assignment.bundle?.fee ?? 0,
                    assignment.bundle?.currency ?? "EUR",
                  )}
                </td>
                <td className="px-3 py-2 max-w-xs truncate">{assignment.notes ?? "-"}</td>
                <td className="px-3 py-2">
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-sm"
                        onClick={() => onEdit(assignment)}
                        title={t("assignments.edit", "Modifica assegnazione")}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-sm"
                        onClick={() => onViewUsage(assignment)}
                        title={t("assignments.viewUsage", "Storico consumo")}
                      >
                        <History className="h-3 w-3" />
                      </button>
                      {assignment.status === "active" && (
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-sm"
                          onClick={() => onCancel(assignment.id)}
                          title={t("assignments.cancel", "Annulla assegnazione")}
                        >
                          <Ban className="h-3 w-3" />
                        </button>
                      )}
                      {assignment.status !== "active" && (
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-xs text-destructive"
                          onClick={() => onDelete(assignment.id)}
                          disabled={busy}
                          title={t("assignments.delete", "Elimina")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!assignments.length && (
              <tr>
                <td className="px-3 py-8 text-center text-text3" colSpan={8}>
                  {hasHidden
                    ? t("assignments.emptyActive", "Nessuna assegnazione attiva.")
                    : t("assignments.empty", "Nessuna assegnazione.")}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </OverflowTable>
      </div>
    </div>
  );
}

function UsageTab({
  summaries,
  assignmentById,
  monthlyUsage,
}: {
  summaries: BundleUsageSummary[];
  assignmentById: Map<string, ClientBundleAssignment>;
  monthlyUsage: any[];
}) {
  const { t } = useTranslation("bundles");
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">

      {/* Desktop table */}
      <div className="hidden md:block pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">{t("usage.title", "Consumi bundle e alert")}</div>
        </div>
        <div className="overflow-x-auto">
          <OverflowTable>
            <table className="w-full min-w-[1060px] text-[12.5px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                {[t("usage.table.client", "Cliente"), t("usage.table.bundle", "Bundle"), t("usage.table.hours", "Ore"), t("usage.table.onsite", "On-site"), t("usage.table.extra", "Extra"), t("usage.table.expiry", "Scadenza"), t("usage.table.alert", "Alert")].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => {
                const assignment = assignmentById.get(
                  summary.client_bundle_assignment_id as string,
                );
                const included = effectiveIncludedHours(summary, assignment);
                const days = daysUntil(assignment?.end_date ?? summary.end_date ?? null);
                const usagePercent = Number(summary.usage_percent ?? 0);
                const hasAlert = usagePercent >= 80 || (days != null && days <= 30);
                return (
                  <tr
                    key={summary.client_bundle_assignment_id as string}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-3 py-2 font-semibold">{clientName(assignment)}</td>
                    <td className="px-3 py-2">
                      {assignment?.bundle?.name ?? String(summary.bundle_id)}
                    </td>
                    <td className="px-3 py-2 min-w-64">
                      <BundleUsageBar used={summary.used_hours} total={included} label={t("usage.table.hours", "Ore")} />
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {summary.onsite_visits ?? 0} /{" "}
                      {formatBundleVisits(
                        assignment?.custom_included_onsite_visits ??
                          assignment?.bundle?.included_onsite_visits,
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {formatBundleHours(summary.extra_hours)} ·{" "}
                      {formatBundleMoney(
                        summary.extra_amount,
                        assignment?.bundle?.currency ?? "EUR",
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{assignment?.end_date ?? "-"}</td>
                    <td className="px-3 py-2">
                      {hasAlert ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> {t("usage.warning", "Attenzione")}
                        </span>
                      ) : (
                        <span className="text-text3">{t("usage.ok", "OK")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!summaries.length && (
                <tr>
                  <td className="px-3 py-8 text-center text-text3" colSpan={7}>
                    {t("usage.empty", "Nessun consumo registrato.")}
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </OverflowTable>
        </div>
      </div>
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">{t("usage.monthlyReport", "Report mensile")}</div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <OverflowTable>
            <table className="w-full text-[12px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                <th className="px-3 py-2 text-left">{t("usage.monthly.month", "Mese")}</th>
                <th className="px-3 py-2 text-right">{t("usage.monthly.hours", "Ore")}</th>
                <th className="px-3 py-2 text-right">{t("usage.monthly.extra", "Extra")}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyUsage.slice(0, 12).map((row) => (
                <tr
                  key={`${row.client_bundle_assignment_id}-${row.usage_month}`}
                  className="border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-3 py-2 font-mono">{row.usage_month}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatBundleHours(row.used_hours)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatBundleMoney(row.extra_amount)}
                  </td>
                </tr>
              ))}
              {!monthlyUsage.length && (
                <tr>
                  <td className="px-3 py-6 text-center text-text3" colSpan={3}>
                    {t("usage.noData", "Nessun dato mensile.")}
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </OverflowTable>
        </div>
      </div>
    </div>
  );
}

function BillingTab({
  assignments,
  payments,
  paymentDraft,
  setPaymentDraft,
  onSavePayment,
  onDeletePayment,
  canManage,
  extraAmount,
  busy,
}: {
  assignments: ClientBundleAssignment[];
  payments: BundlePayment[];
  paymentDraft: PaymentDraft;
  setPaymentDraft: React.Dispatch<React.SetStateAction<PaymentDraft>>;
  onSavePayment: () => void;
  onDeletePayment: (id: string) => void;
  canManage: boolean;
  extraAmount: number;
  busy: boolean;
}) {
  const { t } = useTranslation("bundles");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function validatePaymentDraft(): boolean {
    const errs: Record<string, string | null> = {};
    if (!paymentDraft.client_bundle_assignment_id) {
      errs.client_bundle_assignment_id = t("billing.validation.assignmentRequired", "Seleziona un'assegnazione");
    }
    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      errs.amount = t("billing.validation.amountPositive", "L'importo deve essere > 0");
    }
    setErrors(errs);
    setTouched({ client_bundle_assignment_id: true, amount: true });
    return Object.keys(errs).length === 0;
  }

  function clearFieldError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function touchField(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  // Reset inline errors when the parent clears the form after a successful save
  useEffect(() => {
    if (!paymentDraft.client_bundle_assignment_id && paymentDraft.amount === "0") {
      setErrors({});
      setTouched({});
    }
  }, [paymentDraft.client_bundle_assignment_id, paymentDraft.amount]);

  function handleSavePayment() {
    if (!validatePaymentDraft()) return;
    onSavePayment();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div className="pc-card-title flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> {t("billing.title", "Canoni e fatturazione")}
          </div>
        </div>
        <div className="pc-card-body space-y-3">
          <Metric label={t("billing.billableExtraHours", "Ore extra fatturabili")} value={formatBundleMoney(extraAmount)} />
          {canManage && (
            <div className="space-y-2">
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("billing.assignmentLabel", "Assegnazione")}
                <select
                  className="pc-input"
                  value={paymentDraft.client_bundle_assignment_id}
                  onBlur={() => touchField("client_bundle_assignment_id")}
                  onChange={(e) => {
                    clearFieldError("client_bundle_assignment_id");
                    setPaymentDraft((v) => ({ ...v, client_bundle_assignment_id: e.target.value }));
                  }}
                >
                  <option value="" disabled>
                    {t("billing.selectAssignment", "Seleziona assegnazione...")}
                  </option>
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {clientName(assignment)} · {assignment.bundle?.name}
                    </option>
                  ))}
                </select>
                {touched.client_bundle_assignment_id && errors.client_bundle_assignment_id && (
                  <p className="text-xs" style={{ color: "var(--destructive)" }}>
                    {errors.client_bundle_assignment_id}
                  </p>
                )}
              </label>
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("billing.amountLabel", "Importo (€)")}
                <input
                  className="pc-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentDraft.amount}
                  onBlur={() => touchField("amount")}
                  onChange={(e) => {
                    clearFieldError("amount");
                    setPaymentDraft((v) => ({ ...v, amount: e.target.value }));
                  }}
                  placeholder={t("billing.amountPlaceholder", "0")}
                />
                {touched.amount && errors.amount && (
                  <p className="text-xs" style={{ color: "var(--destructive)" }}>
                    {errors.amount}
                  </p>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("billing.periodStartLabel", "Inizio periodo")}
                  <DatePickerInput
                    value={paymentDraft.period_start}
                    onChange={(v) => setPaymentDraft((prev) => ({ ...prev, period_start: v }))}
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("billing.periodEndLabel", "Fine periodo")}
                  <DatePickerInput
                    value={paymentDraft.period_end}
                    onChange={(v) => setPaymentDraft((prev) => ({ ...prev, period_end: v }))}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("billing.paidAtLabel", "Data pagamento")}
                  <DatePickerInput
                    value={paymentDraft.paid_at}
                    onChange={(v) => setPaymentDraft((prev) => ({ ...prev, paid_at: v }))}
                  />
                </label>
                <select
                  className="pc-input"
                  value={paymentDraft.status}
                  onChange={(e) =>
                    setPaymentDraft((v) => ({
                      ...v,
                      status: e.target.value as PaymentDraft["status"],
                    }))
                  }
                >
                  <option value="pending">{t("billing.status.pending", "In attesa")}</option>
                  <option value="paid">{t("billing.status.paid", "Pagato")}</option>
                  <option value="overdue">{t("billing.status.overdue", "Scaduto")}</option>
                  <option value="cancelled">{t("billing.status.cancelled", "Annullato")}</option>
                </select>
              </div>
              <textarea
                className="pc-input min-h-20"
                value={paymentDraft.notes}
                onChange={(e) => setPaymentDraft((v) => ({ ...v, notes: e.target.value }))}
                placeholder={t("billing.notesPlaceholder", "Note pagamento...")}
              />
              <button
                className="pc-btn pc-btn-primary pc-btn-sm w-full"
                disabled={busy || !paymentDraft.client_bundle_assignment_id}
                onClick={handleSavePayment}
              >
                {t("billing.registerPayment", "Registra pagamento")}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">{t("billing.paymentHistory", "Storico canoni pagati")}</div>
        </div>
        <OverflowTable>
          <table className="w-full text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {[t("billing.table.client", "Cliente"), t("billing.table.bundle", "Bundle"), t("billing.table.period", "Periodo"), t("billing.table.amount", "Importo"), t("billing.table.status", "Stato"), t("billing.table.actions", "Azioni")].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2">{clientName(payment.assignment ?? undefined)}</td>
                <td className="px-3 py-2">{payment.assignment?.bundle?.name ?? "-"}</td>
                <td className="px-3 py-2 font-mono">
                  {payment.period_start ?? "-"} → {payment.period_end ?? "-"}
                </td>
                <td className="px-3 py-2 font-mono">
                  {formatBundleMoney(payment.amount, payment.currency)}
                </td>
                <td className="px-3 py-2">{t(`billing.status.${payment.status}`, payment.status)}</td>
                <td className="px-3 py-2">
                  {canManage && (
                    <button
                      className="pc-btn pc-btn-ghost pc-btn-xs text-destructive"
                      onClick={() => onDeletePayment(payment.id)}
                      disabled={busy}
                      title={t("billing.delete", "Elimina")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td className="px-3 py-8 text-center text-text3" colSpan={6}>
                  {t("billing.empty", "Nessun pagamento registrato.")}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </OverflowTable>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={active ? "pc-btn pc-btn-primary pc-btn-sm" : "pc-btn pc-btn-ghost pc-btn-sm"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BundleStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wide text-text3">{label}</div>
      <div
        className="mt-2 text-xl font-bold"
        style={{
          color:
            tone === "warning"
              ? "var(--warning)"
              : tone === "success"
                ? "var(--success)"
                : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-surface2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-text3">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold">{value}</div>
    </div>
  );
}

function clientName(assignment?: ClientBundleAssignment | null) {
  if (!assignment?.client) return "Cliente";
  return (
    assignment.client.company_name || assignment.client.name || assignment.client.email || "Cliente"
  );
}

function effectiveIncludedHours(
  summary: BundleUsageSummary,
  assignment?: ClientBundleAssignment | null,
) {
  return (
    summary.effective_included_hours ??
    assignment?.custom_included_hours ??
    assignment?.bundle?.included_hours ??
    null
  );
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const end = new Date(`${date}T23:59:59`).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}


