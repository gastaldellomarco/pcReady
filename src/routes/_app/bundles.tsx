import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CreditCard,
  Download,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
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
  listBundleMonthlyUsage,
  listBundlePayments,
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
  useUpdateBundleAssignmentMutation,
  useUpdateBundleMutation,
} from "@/lib/bundles";

export const Route = createFileRoute("/_app/bundles")({
  head: () => ({
    meta: [
      { title: "Bundle assistenza - PCReady" },
      {
        name: "description",
        content: "Pacchetti assistenza, assegnazioni clienti e consumi",
      },
    ],
  }),
  component: BundlesPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

type BundleTab = "catalog" | "assignments" | "usage" | "billing";
type ClientOption = {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
};
type PaymentDraft = {
  client_bundle_assignment_id: string;
  amount: string;
  currency: string;
  period_start: string;
  period_end: string;
  paid_at: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  notes: string;
};

const emptyPaymentDraft: PaymentDraft = {
  client_bundle_assignment_id: "",
  amount: "0",
  currency: "EUR",
  period_start: "",
  period_end: "",
  paid_at: "",
  status: "pending",
  notes: "",
};

function BundlesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const canManageAssignments = profile?.role === "admin" || profile?.role === "tech";
  const [activeTab, setActiveTab] = useState<BundleTab>("catalog");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [creatingBundle, setCreatingBundle] = useState(false);
  const [editingBundle, setEditingBundle] = useState<AssistanceBundle | null>(null);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ClientBundleAssignment | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<any[]>([]);
  const [payments, setPayments] = useState<BundlePayment[]>([]);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);

  const bundlesQuery = useBundles(true);
  const assignmentsQuery = useBundleAssignments();
  const usageQuery = useBundleUsageSummaries();
  const createBundleMutation = useCreateBundleMutation();
  const updateBundleMutation = useUpdateBundleMutation();
  const createAssignmentMutation = useCreateBundleAssignmentMutation();
  const updateAssignmentMutation = useUpdateBundleAssignmentMutation();
  const cancelAssignmentMutation = useCancelBundleAssignmentMutation();
  const createPaymentMutation = useCreateBundlePaymentMutation();

  const bundles = useMemo(() => bundlesQuery.data ?? [], [bundlesQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const usageSummaries = useMemo(() => usageQuery.data ?? [], [usageQuery.data]);

  const assignmentById = useMemo(() => {
    return new Map(assignments.map((assignment) => [assignment.id, assignment]));
  }, [assignments]);

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
        if (active) toast.error(errorMessage(error, "Errore caricamento clienti"));
      } finally {
        if (active) setClientLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Promise.all([listBundleMonthlyUsage(), listBundlePayments()])
      .then(([usage, feePayments]) => {
        setMonthlyUsage(usage as any[]);
        setPayments(feePayments);
      })
      .catch(() => {
        setMonthlyUsage([]);
        setPayments([]);
      });
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

  function resetForms() {
    setCreatingBundle(false);
    setEditingBundle(null);
    setCreatingAssignment(false);
    setEditingAssignment(null);
  }

  async function saveBundle(data: Partial<AssistanceBundle>) {
    if (!isAdmin) {
      toast.error("Solo gli admin possono gestire i bundle");
      return;
    }
    try {
      if (editingBundle) await updateBundleMutation.mutateAsync({ id: editingBundle.id, data });
      else await createBundleMutation.mutateAsync({ ...data, created_by: profile?.id ?? null });
      resetForms();
      toast.success("Bundle salvato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore salvataggio bundle"));
    }
  }

  async function toggleBundle(bundle: AssistanceBundle) {
    if (!isAdmin) {
      toast.error("Solo gli admin possono modificare i bundle");
      return;
    }
    try {
      await updateBundleMutation.mutateAsync({ id: bundle.id, data: { active: !bundle.active } });
      toast.success(bundle.active ? "Bundle disattivato" : "Bundle riattivato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore aggiornamento bundle"));
    }
  }

  async function saveAssignment(data: Partial<ClientBundleAssignment>) {
    if (!canManageAssignments) {
      toast.error("Permessi insufficienti");
      return;
    }
    try {
      if (editingAssignment) {
        await updateAssignmentMutation.mutateAsync({ id: editingAssignment.id, data });
      } else {
        await createAssignmentMutation.mutateAsync({
          ...data,
          status: "active",
          created_by: profile?.id ?? null,
        });
      }
      resetForms();
      toast.success("Assegnazione salvata");
    } catch (error) {
      toast.error(errorMessage(error, "Errore salvataggio assegnazione"));
    }
  }

  async function cancelAssignment(id: string) {
    if (!canManageAssignments) {
      toast.error("Permessi insufficienti");
      return;
    }
    try {
      await cancelAssignmentMutation.mutateAsync(id);
      toast.success("Assegnazione annullata");
    } catch (error) {
      toast.error(errorMessage(error, "Errore annullamento assegnazione"));
    }
  }

  async function savePayment() {
    if (!canManageAssignments) {
      toast.error("Permessi insufficienti");
      return;
    }
    const assignment = assignmentById.get(paymentDraft.client_bundle_assignment_id);
    if (!assignment) {
      toast.error("Seleziona un'assegnazione valida");
      return;
    }
    try {
      await createPaymentMutation.mutateAsync({
        client_bundle_assignment_id: assignment.id,
        client_id: assignment.client_id,
        amount: numberValue(paymentDraft.amount),
        currency: paymentDraft.currency || "EUR",
        period_start: paymentDraft.period_start || null,
        period_end: paymentDraft.period_end || null,
        paid_at: paymentDraft.paid_at || null,
        status: paymentDraft.status,
        notes: paymentDraft.notes.trim() || null,
        created_by: profile?.id ?? null,
      });
      setPaymentDraft(emptyPaymentDraft);
      const feePayments = await listBundlePayments();
      setPayments(feePayments);
      toast.success("Pagamento registrato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore salvataggio pagamento"));
    }
  }

  function exportCsv() {
    const rows = [
      [
        "Cliente",
        "Bundle",
        "Stato",
        "Ore usate",
        "Ore incluse",
        "Ore residue",
        "Extra ore",
        "Extra importo",
        "Scadenza",
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
    toast.success("CSV bundle esportato");
  }

  const loading =
    bundlesQuery.isLoading || assignmentsQuery.isLoading || usageQuery.isLoading || clientLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title flex items-center gap-2">
              <Package className="h-5 w-5 text-accent" /> Bundle assistenza
            </div>
            <div className="mt-1 text-sm text-text3">
              Pacchetti vendibili, SLA, assegnazioni cliente, consumi e fatturazione extra.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={() => {
                  resetForms();
                  setActiveTab("catalog");
                  setCreatingBundle(true);
                }}
              >
                <Plus className="h-3 w-3" /> Nuovo bundle
              </button>
            )}
            {canManageAssignments && (
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={() => {
                  resetForms();
                  setActiveTab("assignments");
                  setCreatingAssignment(true);
                }}
              >
                <Plus className="h-3 w-3" /> Assegna a cliente
              </button>
            )}
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={exportCsv}>
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>
        </div>
        <div className="pc-card-body grid gap-3 md:grid-cols-4">
          <BundleStat label="Bundle attivi" value={stats.activeBundles} />
          <BundleStat label="Assegnazioni attive" value={stats.activeAssignments} />
          <BundleStat
            label="Alert consumo"
            value={stats.risky}
            tone={stats.risky ? "warning" : "default"}
          />
          <BundleStat
            label="Extra fatturabili"
            value={formatBundleMoney(stats.extraAmount)}
            tone="success"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "catalog"} onClick={() => setActiveTab("catalog")}>
          Catalogo bundle
        </TabButton>
        <TabButton active={activeTab === "assignments"} onClick={() => setActiveTab("assignments")}>
          Assegnazioni clienti
        </TabButton>
        <TabButton active={activeTab === "usage"} onClick={() => setActiveTab("usage")}>
          Consumi e alert
        </TabButton>
        <TabButton active={activeTab === "billing"} onClick={() => setActiveTab("billing")}>
          Fatturazione
        </TabButton>
      </div>

      {(creatingBundle || editingBundle) && activeTab === "catalog" && (
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">
              {editingBundle ? "Modifica bundle" : "Nuovo bundle"}
            </div>
          </div>
          <div className="pc-card-body">
            <BundleForm
              initial={editingBundle}
              onSubmit={saveBundle}
              onCancel={resetForms}
              busy={createBundleMutation.isPending || updateBundleMutation.isPending}
            />
          </div>
        </div>
      )}

      {(creatingAssignment || editingAssignment) && activeTab === "assignments" && (
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">
              {editingAssignment ? "Modifica assegnazione" : "Assegna bundle a cliente"}
            </div>
          </div>
          <div className="pc-card-body">
            <AssignmentForm
              bundles={bundles.filter(
                (bundle) => bundle.active || bundle.id === editingAssignment?.bundle_id,
              )}
              clients={clients}
              initial={editingAssignment}
              onSubmit={saveAssignment}
              onCancel={resetForms}
              busy={createAssignmentMutation.isPending || updateAssignmentMutation.isPending}
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
              onToggle={toggleBundle}
            />
          )}
          {activeTab === "assignments" && (
            <AssignmentsTab
              assignments={assignments}
              canManage={canManageAssignments}
              onEdit={setEditingAssignmentWithTab}
              onCancel={cancelAssignment}
            />
          )}
          {activeTab === "usage" && (
            <UsageTab
              summaries={usageSummaries}
              assignmentById={assignmentById}
              monthlyUsage={monthlyUsage}
            />
          )}
          {activeTab === "billing" && (
            <BillingTab
              assignments={assignments}
              payments={payments}
              paymentDraft={paymentDraft}
              setPaymentDraft={setPaymentDraft}
              onSavePayment={savePayment}
              canManage={canManageAssignments}
              extraAmount={stats.extraAmount}
              busy={createPaymentMutation.isPending}
            />
          )}
        </>
      )}
    </div>
  );

  function setEditingBundleWithTab(bundle: AssistanceBundle) {
    resetForms();
    setActiveTab("catalog");
    setEditingBundle(bundle);
  }

  function setEditingAssignmentWithTab(assignment: ClientBundleAssignment) {
    resetForms();
    setActiveTab("assignments");
    setEditingAssignment(assignment);
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
                  {bundle.active ? "Attivo" : "Disattivato"}
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
                  <Pencil className="h-3 w-3" /> Modifica
                </button>
                <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => onToggle(bundle)}>
                  {bundle.active ? <Ban className="h-3 w-3" /> : <RefreshCcw className="h-3 w-3" />}
                  {bundle.active ? "Disattiva" : "Riattiva"}
                </button>
              </div>
            )}
          </div>
          <div className="pc-card-body grid gap-3 md:grid-cols-4">
            <Metric label="Canone" value={formatBundleMoney(bundle.fee, bundle.currency)} />
            <Metric label="Tipo" value={BILLING_TYPE_LABEL[bundle.billing_type]} />
            <Metric label="Ore incluse" value={formatBundleHours(bundle.included_hours)} />
            <Metric
              label="Tariffa extra"
              value={formatBundleMoney(bundle.extra_hourly_rate, bundle.currency)}
            />
            <Metric label="SLA risposta" value={`${bundle.sla_response_hours} h`} />
            <Metric label="SLA risoluzione" value={`${bundle.sla_resolution_hours} h`} />
            <Metric label="On-site" value={formatBundleVisits(bundle.included_onsite_visits)} />
            <Metric label="Supporto remoto" value={bundle.remote_support ? "Incluso" : "No"} />
          </div>
        </div>
      ))}
      {!bundles.length && (
        <div className="pc-card p-6 text-sm text-text3">Nessun bundle configurato.</div>
      )}
    </div>
  );
}

function AssignmentsTab({
  assignments,
  canManage,
  onEdit,
  onCancel,
}: {
  assignments: ClientBundleAssignment[];
  canManage: boolean;
  onEdit: (assignment: ClientBundleAssignment) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div className="pc-card-title">Storico bundle assegnati</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {["Cliente", "Bundle", "Stato", "Periodo", "Rinnovo", "Canone", "Note", "Azioni"].map(
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
                  {assignment.start_date} → {assignment.end_date ?? "senza scadenza"}
                </td>
                <td className="px-3 py-2">{assignment.auto_renew ? "Automatico" : "Manuale"}</td>
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
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {assignment.status === "active" && (
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-sm"
                          onClick={() => onCancel(assignment.id)}
                        >
                          <Ban className="h-3 w-3" />
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
                  Nessuna assegnazione.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">Consumi bundle e alert</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-[12.5px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                {["Cliente", "Bundle", "Ore", "On-site", "Extra", "Scadenza", "Alert"].map((h) => (
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
                      <BundleUsageBar used={summary.used_hours} total={included} label="Ore" />
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
                          <AlertTriangle className="h-3 w-3" /> Attenzione
                        </span>
                      ) : (
                        <span className="text-text3">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!summaries.length && (
                <tr>
                  <td className="px-3 py-8 text-center text-text3" colSpan={7}>
                    Nessun consumo registrato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">Report mensile</div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                <th className="px-3 py-2 text-left">Mese</th>
                <th className="px-3 py-2 text-right">Ore</th>
                <th className="px-3 py-2 text-right">Extra</th>
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
                    Nessun dato mensile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
  canManage,
  extraAmount,
  busy,
}: {
  assignments: ClientBundleAssignment[];
  payments: BundlePayment[];
  paymentDraft: PaymentDraft;
  setPaymentDraft: React.Dispatch<React.SetStateAction<PaymentDraft>>;
  onSavePayment: () => void;
  canManage: boolean;
  extraAmount: number;
  busy: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div className="pc-card-title flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Canoni e fatturazione
          </div>
        </div>
        <div className="pc-card-body space-y-3">
          <Metric label="Ore extra fatturabili" value={formatBundleMoney(extraAmount)} />
          {canManage && (
            <div className="space-y-2">
              <select
                className="pc-input"
                value={paymentDraft.client_bundle_assignment_id}
                onChange={(e) =>
                  setPaymentDraft((v) => ({ ...v, client_bundle_assignment_id: e.target.value }))
                }
              >
                <option value="">Assegnazione...</option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {clientName(assignment)} · {assignment.bundle?.name}
                  </option>
                ))}
              </select>
              <input
                className="pc-input"
                type="number"
                min="0"
                step="0.01"
                value={paymentDraft.amount}
                onChange={(e) => setPaymentDraft((v) => ({ ...v, amount: e.target.value }))}
                placeholder="Importo"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="pc-input"
                  type="date"
                  value={paymentDraft.period_start}
                  onChange={(e) => setPaymentDraft((v) => ({ ...v, period_start: e.target.value }))}
                />
                <input
                  className="pc-input"
                  type="date"
                  value={paymentDraft.period_end}
                  onChange={(e) => setPaymentDraft((v) => ({ ...v, period_end: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="pc-input"
                  type="date"
                  value={paymentDraft.paid_at}
                  onChange={(e) => setPaymentDraft((v) => ({ ...v, paid_at: e.target.value }))}
                />
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
                  <option value="pending">In attesa</option>
                  <option value="paid">Pagato</option>
                  <option value="overdue">Scaduto</option>
                  <option value="cancelled">Annullato</option>
                </select>
              </div>
              <textarea
                className="pc-input min-h-20"
                value={paymentDraft.notes}
                onChange={(e) => setPaymentDraft((v) => ({ ...v, notes: e.target.value }))}
                placeholder="Note pagamento..."
              />
              <button
                className="pc-btn pc-btn-primary pc-btn-sm w-full"
                disabled={busy}
                onClick={onSavePayment}
              >
                Registra pagamento
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">Storico canoni pagati</div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {["Cliente", "Bundle", "Periodo", "Importo", "Stato"].map((h) => (
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
                <td className="px-3 py-2">{payment.status}</td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td className="px-3 py-8 text-center text-text3" colSpan={5}>
                  Nessun pagamento registrato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
