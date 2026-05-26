import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";
import { Download, FileDown, Pencil, Save, Trash2, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ExportPdf } from "@/components/ExportPdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { openTicketDetail } from "@/lib/use-detail";

export const Route = createLazyFileRoute("/_app/costs")({
  component: CostsPage,
});

type TicketCostRow = {
  id: string;
  ticket_code: string;
  client_id: string | null;
  client_name: string | null;
  assignee_id: string | null;
  technician_name: string | null;
  status: string;
  priority: string;
  ticket_type: string;
  created_at: string;
  completed_at: string | null;
  billable_hours: number | null;
  hourly_rate: number | null;
  material_cost: number | null;
  labor_cost: number | null;
  total_cost: number | null;
  tracked_minutes: number | null;
};

// ── Explicit field select for ticket_cost_summary view ──
const COST_SUMMARY_SELECT =
  "id, ticket_code, client_id, client_name, assignee_id, technician_name, status, priority, ticket_type, created_at, completed_at, billable_hours, hourly_rate, material_cost, labor_cost, total_cost, tracked_minutes";

type ClientOption = { id: string; name: string; company_name: string | null };
type ContractRow = {
  id: string;
  client_id: string;
  name: string;
  status: "active" | "paused" | "expired" | "draft";
  billing_period: "monthly" | "annual";
  recurring_fee: number;
  included_hours: number;
  extra_hourly_rate: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  client?: ClientOption | null;
};

type ContractDraft = {
  client_id: string;
  name: string;
  billing_period: "monthly" | "annual";
  recurring_fee: string;
  included_hours: string;
  extra_hourly_rate: string;
  start_date: string;
  end_date: string;
};

const today = new Date();
const defaultDateFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
const defaultDateTo = today.toISOString().slice(0, 10);

const emptyContractDraft: ContractDraft = {
  client_id: "",
  name: "Contratto assistenza",
  billing_period: "monthly",
  recurring_fee: "0",
  included_hours: "0",
  extra_hourly_rate: "0",
  start_date: defaultDateFrom,
  end_date: "",
};

function CostsPage() {
  const { canEdit, profile } = useAuth();
  const canManageCosts = profile?.role === "admin" || profile?.role === "tech";
  const { t } = useTranslation("costs");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [clientFilter, setClientFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [tickets, setTickets] = useState<TicketCostRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [draft, setDraft] = useState<ContractDraft>(emptyContractDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntity, setDetailEntity] = useState<{ type: "client" | "technician"; name: string } | null>(null);
  const [detailGroupBy, setDetailGroupBy] = useState<"none" | "client" | "technician">("none");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketResult, contractResult, clientResult] = await Promise.all([
        (supabase as any)
          .from("ticket_cost_summary")
          .select(COST_SUMMARY_SELECT)
          .gte("created_at", dateFrom)
          .lte("created_at", `${dateTo}T23:59:59.999Z`)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("client_contracts")
          .select("*, client:clients(id, name, company_name)")
          .order("start_date", { ascending: false }),
        supabase.from("clients").select("id, name, company_name").order("name"),
      ]);
      if (ticketResult.error) throw ticketResult.error;
      if (contractResult.error) throw contractResult.error;
      if (clientResult.error) throw clientResult.error;
      setTickets((ticketResult.data ?? []) as TicketCostRow[]);
      setContracts((contractResult.data ?? []) as ContractRow[]);
      setClients((clientResult.data ?? []) as ClientOption[]);
    } catch (error) {
      toast.error(errorMessage(error, t("feedback.loadError", "Errore caricamento costi")));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const technicians = useMemo(
    () =>
      Array.from(
        new Map(
          tickets
            .filter((ticket) => ticket.assignee_id)
            .map((ticket) => [ticket.assignee_id!, ticket.technician_name || t("fallbacks.noName", "Senza nome")]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [tickets],
  );

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (clientFilter !== "all" && ticket.client_id !== clientFilter) return false;
        if (technicianFilter !== "all" && ticket.assignee_id !== technicianFilter) return false;
        return true;
      }),
    [clientFilter, technicianFilter, tickets],
  );

  const filteredContracts = useMemo(
    () =>
      contracts.filter((contract) => clientFilter === "all" || contract.client_id === clientFilter),
    [clientFilter, contracts],
  );

  const summary = useMemo(() => {
    const ticketTotal = filteredTickets.reduce((sum, ticket) => sum + money(ticket.total_cost), 0);
    const labor = filteredTickets.reduce((sum, ticket) => sum + money(ticket.labor_cost), 0);
    const materials = filteredTickets.reduce((sum, ticket) => sum + money(ticket.material_cost), 0);
    const hours = filteredTickets.reduce((sum, ticket) => sum + money(ticket.billable_hours), 0);
    const recurring = filteredContracts
      .filter((contract) => contract.status === "active")
      .reduce((sum, contract) => sum + money(contract.recurring_fee), 0);
    const estimatedRevenue = ticketTotal + recurring;
    return { ticketTotal, labor, materials, hours, recurring, estimatedRevenue };
  }, [filteredContracts, filteredTickets]);

  const byClient = useMemo(
    () => groupCosts(filteredTickets, "client_name", { client: t("fallbacks.clientNotIndicated", "Cliente non indicato") }),
    [filteredTickets, t],
  );
  const byTechnician = useMemo(
    () => groupCosts(filteredTickets, "technician_name", { technician: t("fallbacks.notAssigned", "Non assegnato") }),
    [filteredTickets, t],
  );

  const detailTickets = useMemo(() => {
    if (!detailEntity) return [] as TicketCostRow[];
    const key = detailEntity.type === "client" ? "client_name" : "technician_name";
    const fallback = detailEntity.type === "technician"
      ? t("fallbacks.notAssigned", "Non assegnato")
      : t("fallbacks.clientNotIndicated", "Cliente non indicato");
    return filteredTickets.filter((ticket) => {
      const name = ticket[key] || fallback;
      return name === detailEntity.name;
    });
  }, [detailEntity, filteredTickets, t]);

  const detailTotals = useMemo(() => {
    const hours = detailTickets.reduce((sum, t) => sum + money(t.billable_hours), 0);
    const labor = detailTickets.reduce((sum, t) => sum + money(t.labor_cost), 0);
    const materials = detailTickets.reduce((sum, t) => sum + money(t.material_cost), 0);
    const total = detailTickets.reduce((sum, t) => sum + money(t.total_cost), 0);
    return { hours, labor, materials, total };
  }, [detailTickets]);

  const groupedDetail = useMemo(() => {
    if (detailGroupBy === "none") return null;
    const key = detailGroupBy === "client" ? "client_name" : "technician_name";
    const fallback = detailGroupBy === "technician"
      ? t("fallbacks.notAssigned", "Non assegnato")
      : t("fallbacks.clientNotIndicated", "Cliente non indicato");
    const groups = groupCosts(filteredTickets, key, { technician: fallback, client: fallback });
    return groups.map((group) => ({
      name: group.name,
      hours: group.hours,
      labor: group.labor,
      materials: group.materials,
      total: group.total,
      tickets: filteredTickets.filter((t) => {
        const name = t[key] || fallback;
        return name === group.name;
      }),
    }));
  }, [detailGroupBy, filteredTickets, t]);

  function openDetail(type: "client" | "technician", name: string) {
    setDetailEntity({ type, name });
    setDetailOpen(true);
  }

  function startEdit(contract: ContractRow) {
    setEditingId(contract.id);
    setErrors({});
    setTouched({});
    setDraft({
      client_id: contract.client_id,
      name: contract.name,
      billing_period: contract.billing_period,
      recurring_fee: String(contract.recurring_fee),
      included_hours: String(contract.included_hours),
      extra_hourly_rate: String(contract.extra_hourly_rate),
      start_date: contract.start_date,
      end_date: contract.end_date ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setErrors({});
    setTouched({});
    setDraft(emptyContractDraft);
  }

  async function deleteContract(id: string) {
    if (!window.confirm(t("contractTable.confirmDelete", "Eliminare questo contratto?"))) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("client_contracts").delete().eq("id", id);
      if (error) throw error;
      if (id === editingId) {
        setEditingId(null);
        setDraft(emptyContractDraft);
        setErrors({});
        setTouched({});
      }
      await loadData();
      toast.success(t("contractTable.deleted", "Contratto eliminato"));
    } catch (error) {
      toast.error(errorMessage(error, t("contractTable.deleteError", "Errore eliminazione contratto")));
    } finally {
      setBusy(false);
    }
  }

  function validateDraft(): boolean {
    const errs: Record<string, string | null> = {};
    if (!draft.client_id) {
      errs.client_id = t("validation.clientRequired", "Seleziona un cliente");
    }
    if (!draft.name.trim()) {
      errs.name = t("validation.nameRequired", "Inserisci un nome contratto");
    }
    const fee = money(draft.recurring_fee);
    if (fee < 0) {
      errs.recurring_fee = t("validation.feeInvalid", "Il canone deve essere ≥ 0");
    }
    const hours = money(draft.included_hours);
    if (hours <= 0) {
      errs.included_hours = t("validation.hoursInvalid", "Le ore incluse devono essere > 0");
    }
    const extraRate = money(draft.extra_hourly_rate);
    if (extraRate < 0) {
      errs.extra_hourly_rate = t("validation.extraRateInvalid", "La tariffa extra deve essere ≥ 0");
    }
    if (!draft.start_date) {
      errs.start_date = t("validation.startDateRequired", "Inserisci la data inizio");
    }
    if (draft.end_date && draft.start_date && draft.end_date < draft.start_date) {
      errs.end_date = t("validation.endDateBeforeStart", "La data fine deve essere ≥ data inizio");
    }
    setErrors(errs);
    setTouched({
      client_id: true,
      name: true,
      recurring_fee: true,
      included_hours: true,
      extra_hourly_rate: true,
      start_date: true,
      end_date: true,
    });
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

  async function saveContract() {
    if (!canManageCosts || !canEdit) return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    if (!validateDraft()) return;
    setBusy(true);
    try {
      const payload = {
        client_id: draft.client_id,
        name: draft.name.trim() || t("contractForm.defaultName", "Contratto assistenza"),
        billing_period: draft.billing_period,
        recurring_fee: numberFromDraft(draft.recurring_fee),
        included_hours: numberFromDraft(draft.included_hours),
        extra_hourly_rate: numberFromDraft(draft.extra_hourly_rate),
        start_date: draft.start_date || defaultDateFrom,
        end_date: draft.end_date || null,
        status: "active",
      };
      let error;
      if (editingId) {
        ({ error } = await (supabase as any).from("client_contracts").update(payload).eq("id", editingId));
      } else {
        ({ error } = await (supabase as any).from("client_contracts").insert(payload));
      }
      if (error) throw error;
      setDraft(emptyContractDraft);
      setEditingId(null);
      setErrors({});
      setTouched({});
      await loadData();
      toast.success(editingId
        ? t("feedback.contractUpdated", "Contratto aggiornato")
        : t("feedback.contractSaved", "Contratto salvato"));
    } catch (error) {
      toast.error(errorMessage(error, t("feedback.contractSaveError", "Errore salvataggio contratto")));
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      [
        [
          t("detailTable.headers.ticket", "Ticket"),
          t("detailTable.headers.client", "Cliente"),
          t("detailTable.headers.technician", "Tecnico"),
          t("detailTable.headers.hours", "Ore"),
          t("detailTable.headers.rate", "Tariffa"),
          t("detailTable.headers.labor", "Manodopera"),
          t("detailTable.headers.materials", "Materiali"),
          t("detailTable.headers.total", "Totale"),
          t("detailTable.headers.status", "Stato"),
        ],
        ...filteredTickets.map((ticket) => [
          ticket.ticket_code,
          ticket.client_name ?? "-",
          ticket.technician_name ?? "-",
          ticket.billable_hours ?? 0,
          ticket.hourly_rate ?? 0,
          ticket.labor_cost ?? 0,
          ticket.material_cost ?? 0,
          ticket.total_cost ?? 0,
          ticket.status,
        ]),
      ],
      buildDownloadFileName("pcready-costi-ticket", "csv", { dated: true }),
    );
    toast.success(t("feedback.csvExported", "CSV costi esportato"));
  }

  const activeFilterRecord: Record<string, any> = {
    dateFrom,
    dateTo,
    client_id: clientFilter !== "all" ? clientFilter : undefined,
    assignee_id: technicianFilter !== "all" ? technicianFilter : undefined,
  };

  const filterSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Periodo: ${dateFrom} - ${dateTo}`);
    if (clientFilter !== "all") {
      const client = clients.find((c) => c.id === clientFilter);
      lines.push(`Cliente: ${client?.company_name || client?.name || clientFilter}`);
    }
    if (technicianFilter !== "all") {
      lines.push(`Tecnico: filtrato`);
    }
    return lines;
  }, [dateFrom, dateTo, clientFilter, technicianFilter, clients]);

  async function exportPdfSuccess() {
    toast.success(t("feedback.pdfExported", "Report costi esportato"));
  }

  function exportPdfError(err: Error) {
    toast.error(errorMessage(err, t("feedback.pdfExportError", "Errore export PDF costi")));
  }

  function detailExportCsv() {
    if (!detailTickets.length) return;
    downloadCsv(
      [
        [
          t("detailTable.headers.ticket", "Ticket"),
          t("detailTable.headers.client", "Cliente"),
          t("detailTable.headers.technician", "Tecnico"),
          t("detailTable.headers.hours", "Ore"),
          t("detailTable.headers.rate", "Tariffa"),
          t("detailTable.headers.labor", "Manodopera"),
          t("detailTable.headers.materials", "Materiali"),
          t("detailTable.headers.total", "Totale"),
          t("detailTable.headers.status", "Stato"),
        ],
        ...detailTickets.map((ticket) => [
          ticket.ticket_code,
          ticket.client_name ?? "-",
          ticket.technician_name ?? "-",
          ticket.billable_hours ?? 0,
          ticket.hourly_rate ?? 0,
          ticket.labor_cost ?? 0,
          ticket.material_cost ?? 0,
          ticket.total_cost ?? 0,
          ticket.status,
        ]),
      ],
      buildDownloadFileName("pcready-costi-dettaglio", "csv", { dated: true }),
    );
    toast.success(t("detailDialog.csvExported", "CSV dettaglio esportato"));
  }

  const detailDialogTitle = detailEntity
    ? detailEntity.type === "client"
      ? t("detailDialog.clientTitle", "Dettaglio ticket per cliente")
      : t("detailDialog.technicianTitle", "Dettaglio ticket per tecnico")
    : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">{t("title", "Gestione costi")}</div>
            <div className="mt-1 text-sm text-text3">
              {t("subtitle", "Ticket, manodopera, materiali, contratti e report fatturazione")}
            </div>
          </div>
          <TrendingUp className="h-5 w-5 text-text3" />
        </div>
        <div className="pc-card-body">
          <div className="grid gap-2 md:grid-cols-[150px_150px_1fr_1fr_auto_auto]">
            <input
              className="pc-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <input
              className="pc-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <select
              className="pc-input"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="all">{t("filters.allClients", "Tutti i clienti")}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.name}
                </option>
              ))}
            </select>
            <select
              className="pc-input"
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
            >
              <option value="all">{t("filters.allTechnicians", "Tutti i tecnici")}</option>
              {technicians.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => setExportModalOpen(true)}
            >
              <FileDown className="h-3 w-3" /> {t("downloadPdf", "Esporta PDF")}
            </button>
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={exportCsv}>
              <Download className="h-3 w-3" /> {t("exportCsvBtn", "CSV")}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CostStat label={t("stats.ticketTotal", "Totale ticket")} value={formatCurrency(summary.ticketTotal)} />
        <CostStat label={t("stats.labor", "Manodopera")} value={formatCurrency(summary.labor)} />
        <CostStat label={t("stats.materials", "Materiali")} value={formatCurrency(summary.materials)} />
        <CostStat label={t("stats.billableHours", "Ore fatturabili")} value={formatHours(summary.hours)} />
        <CostStat label={t("stats.recurring", "Canoni attivi")} value={formatCurrency(summary.recurring)} />
        <CostStat
          label={t("stats.estimatedMargin", "Margine stimato")}
          value={formatCurrency(summary.estimatedRevenue - summary.materials)}
          tone="success"
        />
      </div>

      {canManageCosts && (
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">
              {t("contractForm.title", "Contratti / SLA cliente")}
              {editingId && (
                <span className="ml-2 text-xs font-normal text-accent">
                  {t("contractForm.editing", "Modifica in corso")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  type="button"
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={cancelEdit}
                  disabled={busy}
                >
                  <X className="h-3 w-3" /> {t("contractForm.cancelEdit", "Annulla")}
                </button>
              )}
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={saveContract}
                disabled={busy || !canEdit || !draft.client_id}
              >
                <Save className="h-3 w-3" />{" "}
                {editingId
                  ? t("contractForm.update", "Aggiorna contratto")
                  : t("contractForm.save", "Salva contratto")}
              </button>
            </div>
          </div>
          <div className="pc-card-body grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.clientLabel", "Cliente")}
              <select
                className="pc-input"
                value={draft.client_id}
                onBlur={() => touchField("client_id")}
                onChange={(e) => {
                  clearFieldError("client_id");
                  setDraft((v) => ({ ...v, client_id: e.target.value }));
                }}
              >
                <option value="" disabled>
                  {t("contractForm.clientPlaceholder", "Seleziona cliente...")}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.name}
                  </option>
                ))}
              </select>
              {touched.client_id && errors.client_id && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.client_id}</p>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.nameLabel", "Nome contratto")}
              <input
                className="pc-input"
                value={draft.name}
                onBlur={() => touchField("name")}
                onChange={(e) => {
                  clearFieldError("name");
                  setDraft((v) => ({ ...v, name: e.target.value }));
                }}
                placeholder={t("contractForm.namePlaceholder", "es. Contratto base")}
              />
              {touched.name && errors.name && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.name}</p>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.billingPeriodLabel", "Fatturazione")}
              <select
                className="pc-input"
                value={draft.billing_period}
                onChange={(e) =>
                  setDraft((v) => ({
                    ...v,
                    billing_period: e.target.value as ContractDraft["billing_period"],
                  }))
                }
              >
                <option value="monthly">{t("contracts.period.monthly", "Mensile")}</option>
                <option value="annual">{t("contracts.period.annual", "Annuale")}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.feeLabel", "Canone (€)")}
              <input
                className="pc-input"
                type="number"
                min="0"
                step="0.01"
                value={draft.recurring_fee}
                onBlur={() => touchField("recurring_fee")}
                onChange={(e) => {
                  clearFieldError("recurring_fee");
                  setDraft((v) => ({ ...v, recurring_fee: e.target.value }));
                }}
                placeholder={t("contractForm.feePlaceholder", "0")}
              />
              {touched.recurring_fee && errors.recurring_fee && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.recurring_fee}</p>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.hoursLabel", "Ore incluse")}
              <input
                className="pc-input"
                type="number"
                min="0"
                step="0.25"
                value={draft.included_hours}
                onBlur={() => touchField("included_hours")}
                onChange={(e) => {
                  clearFieldError("included_hours");
                  setDraft((v) => ({ ...v, included_hours: e.target.value }));
                }}
                placeholder={t("contractForm.hoursPlaceholder", "0")}
              />
              {touched.included_hours && errors.included_hours && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.included_hours}</p>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.extraRateLabel", "Tariffa extra/h (€)")}
              <input
                className="pc-input"
                type="number"
                min="0"
                step="0.01"
                value={draft.extra_hourly_rate}
                onBlur={() => touchField("extra_hourly_rate")}
                onChange={(e) => {
                  clearFieldError("extra_hourly_rate");
                  setDraft((v) => ({ ...v, extra_hourly_rate: e.target.value }));
                }}
                placeholder={t("contractForm.extraRatePlaceholder", "0")}
              />
              {touched.extra_hourly_rate && errors.extra_hourly_rate && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.extra_hourly_rate}</p>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.startDateLabel", "Data inizio")}
              <input
                className="pc-input"
                type="date"
                value={draft.start_date}
                min={defaultDateFrom}
                onBlur={() => touchField("start_date")}
                onChange={(e) => {
                  clearFieldError("start_date");
                  clearFieldError("end_date");
                  setDraft((v) => ({ ...v, start_date: e.target.value }));
                }}
              />
              {touched.start_date && errors.start_date && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.start_date}</p>
              )}
            </label>
            <label className="space-y-1 text-sm font-medium text-text2">
              {t("contractForm.endDateLabel", "Data fine")}
              <input
                className="pc-input"
                type="date"
                value={draft.end_date}
                min={draft.start_date || undefined}
                onBlur={() => touchField("end_date")}
                onChange={(e) => {
                  clearFieldError("end_date");
                  setDraft((v) => ({ ...v, end_date: e.target.value }));
                }}
              />
              {touched.end_date && errors.end_date && (
                <p className="text-xs" style={{ color: "var(--destructive)" }}>{errors.end_date}</p>
              )}
            </label>
          </div>
          {filteredContracts.length > 0 && (
            <div className="border-t overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <table className="w-full min-w-[800px] text-[12.5px]">
                <thead style={{ background: "var(--surface2)" }}>
                  <tr>
                    <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.client", "Cliente")}
                    </th>
                    <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.name", "Contratto")}
                    </th>
                    <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.period", "Periodo")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.fee", "Canone")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.hours", "Ore")}
                    </th>
                    <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.status", "Stato")}
                    </th>
                    <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.dates", "Date")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("contractTable.headers.actions", "Azioni")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className="border-t"
                      style={{
                        borderColor: "var(--border)",
                        background: editingId === contract.id ? "var(--accent-alpha)" : undefined,
                      }}
                    >
                      <td className="px-3 py-2 text-sm">
                        {contract.client?.company_name || contract.client?.name || t("fallbacks.client", "Cliente")}
                      </td>
                      <td className="px-3 py-2 font-medium">{contract.name}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs rounded-full bg-surface2 px-2 py-0.5">
                          {contract.billing_period === "monthly"
                            ? t("contracts.period.monthly", "Mensile")
                            : t("contracts.period.annual", "Annuale")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(contract.recurring_fee)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatHours(contract.included_hours)}</td>
                      <td className="px-3 py-2">
                        <span
                          className="text-xs rounded-full px-2 py-0.5 font-bold"
                          style={{
                            background:
                              contract.status === "active"
                                ? "var(--success-alpha)"
                                : contract.status === "paused"
                                  ? "var(--warning-alpha)"
                                  : "var(--surface2)",
                            color:
                              contract.status === "active"
                                ? "var(--success)"
                                : contract.status === "paused"
                                  ? "var(--warning)"
                                  : "var(--text3)",
                          }}
                        >
                          {contract.status === "active"
                            ? t("contractTable.statusActive", "Attivo")
                            : contract.status === "paused"
                              ? t("contractTable.statusPaused", "In pausa")
                              : contract.status === "expired"
                                ? t("contractTable.statusExpired", "Scaduto")
                                : t("contractTable.statusDraft", "Bozza")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-text3">
                        {new Date(contract.start_date).toLocaleDateString("it-IT")}
                        {contract.end_date
                          ? ` \u2192 ${new Date(contract.end_date).toLocaleDateString("it-IT")}`
                          : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="pc-btn pc-btn-ghost pc-btn-xs"
                            onClick={() => startEdit(contract)}
                            disabled={busy}
                            title={t("contractTable.edit", "Modifica")}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="pc-btn pc-btn-ghost pc-btn-xs text-destructive"
                            onClick={() => deleteContract(contract.id)}
                            disabled={busy}
                            title={t("contractTable.delete", "Elimina")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryTable
          title={t("summaryTables.perClient", "Costi per cliente")}
          rows={byClient}
          onRowClick={(name) => openDetail("client", name)}
        />
        <SummaryTable
          title={t("summaryTables.perTechnician", "Costi per tecnico")}
          rows={byTechnician}
          onRowClick={(name) => openDetail("technician", name)}
        />
      </div>

      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">{t("detailTable.title", "Dettaglio ticket fatturabili")}</div>
            <div className="mt-1 flex items-center gap-3 text-sm text-text3">
              <span>{t("detailTable.ticketsInPeriod", { count: filteredTickets.length })}</span>
              <select
                className="pc-input text-xs w-auto"
                value={detailGroupBy}
                onChange={(e) => setDetailGroupBy(e.target.value as "none" | "client" | "technician")}
              >
                <option value="none">{t("detailTable.groupByNone", "Nessun raggruppamento")}</option>
                <option value="client">{t("detailTable.groupByClient", "Raggruppa per cliente")}</option>
                <option value="technician">{t("detailTable.groupByTechnician", "Raggruppa per tecnico")}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                {[
                  { key: "ticket", label: t("detailTable.headers.ticket", "Ticket") },
                  { key: "client", label: t("detailTable.headers.client", "Cliente") },
                  { key: "technician", label: t("detailTable.headers.technician", "Tecnico") },
                  { key: "hours", label: t("detailTable.headers.hours", "Ore") },
                  { key: "rate", label: t("detailTable.headers.rate", "Tariffa") },
                  { key: "labor", label: t("detailTable.headers.labor", "Manodopera") },
                  { key: "materials", label: t("detailTable.headers.materials", "Materiali") },
                  { key: "total", label: t("detailTable.headers.total", "Totale") },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-text3" colSpan={8}>
                    {t("detailTable.loading", "Caricamento costi...")}
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-text3" colSpan={8}>
                    {t("detailTable.empty", "Nessun costo nel periodo selezionato")}
                  </td>
                </tr>
              ) : groupedDetail ? (
                groupedDetail.map((group) => (
                  <Fragment key={group.name}>
                    <tr
                      className="border-t bg-surface2 cursor-pointer transition-colors"
                      style={{ borderColor: "var(--border)" }}
                      tabIndex={0}
                      role="button"
                      onClick={() => openDetail(detailGroupBy === "client" ? "client" : "technician", group.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(detailGroupBy === "client" ? "client" : "technician", group.name);
                        }
                      }}
                    >
                      <td className="px-3 py-2 font-bold" colSpan={3}>
                        {group.name} ({group.tickets.length})
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatHours(group.hours)}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatCurrency(group.labor)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatCurrency(group.materials)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatCurrency(group.total)}
                      </td>
                    </tr>
                    {group.tickets.map((ticket) => (
                      <tr key={ticket.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-2 pl-8 font-mono font-semibold text-accent">
                          {ticket.ticket_code}
                        </td>
                        <td className="px-3 py-2">{ticket.client_name || "-"}</td>
                        <td className="px-3 py-2">{ticket.technician_name || "-"}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatHours(money(ticket.billable_hours))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(ticket.hourly_rate)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(ticket.labor_cost)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(ticket.material_cost)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {formatCurrency(ticket.total_cost)}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              ) : (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-3 py-2 font-mono font-semibold text-accent">
                      {ticket.ticket_code}
                    </td>
                    <td className="px-3 py-2">{ticket.client_name || "-"}</td>
                    <td className="px-3 py-2">{ticket.technician_name || "-"}</td>
                    <td className="px-3 py-2 font-mono">
                      {formatHours(money(ticket.billable_hours))}
                    </td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(ticket.hourly_rate)}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(ticket.labor_cost)}</td>
                    <td className="px-3 py-2 font-mono">{formatCurrency(ticket.material_cost)}</td>
                    <td className="px-3 py-2 font-mono font-bold">
                      {formatCurrency(ticket.total_cost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">{t("contracts.title", "Contratti attivi e ore extra")}</div>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {filteredContracts.map((contract) => {
            const usedHours = filteredTickets
              .filter((ticket) => ticket.client_id === contract.client_id)
              .reduce((sum, ticket) => sum + money(ticket.billable_hours), 0);
            const extraHours = Math.max(0, usedHours - money(contract.included_hours));
            return (
              <div
                key={contract.id}
                className="rounded-xl border p-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{contract.name}</div>
                    <div className="text-sm text-text3">
                      {contract.client
                        ? contract.client.company_name || contract.client.name
                        : t("fallbacks.client", "Cliente")}
                    </div>
                  </div>
                  <span className="rounded-full bg-surface2 px-2 py-1 text-[11px] font-bold text-text2">
                    {contract.billing_period === "monthly" ? t("contracts.period.monthly", "Mensile") : t("contracts.period.annual", "Annuale")}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <ContractMetric label={t("contracts.fee", "Canone")} value={formatCurrency(contract.recurring_fee)} />
                  <ContractMetric
                    label={t("contracts.includedHours", "Ore incluse")}
                    value={formatHours(contract.included_hours)}
                  />
                  <ContractMetric label={t("contracts.usedHours", "Ore usate")} value={formatHours(usedHours)} />
                  <ContractMetric
                    label={t("contracts.estimatedExtra", "Extra stimato")}
                    value={formatCurrency(extraHours * money(contract.extra_hourly_rate))}
                  />
                </div>
              </div>
            );
          })}
          {!filteredContracts.length && (
            <div className="text-sm text-text3">{t("contracts.noContracts", "Nessun contratto configurato.")}</div>
          )}
        </div>
      </div>

      <ExportPdf<TicketCostRow, TicketCostRow>
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        entityLabel="ticket"
        renderPdf={async (rows) => {
          const { CostsReportPdf } = await import("@/components/pcready/pdf/CostsReportPdf");
          return <CostsReportPdf
            rows={rows}
            summary={summary}
            period={`${dateFrom} - ${dateTo}`}
            byClient={byClient.slice(0, 8)}
            byTechnician={byTechnician.slice(0, 8)}
          />;
        }}
        mapRow={(row) => row}
        fileName={buildDownloadFileName("pcready-report-costi", "pdf", { dated: true })}
        fetchAll={async (filters) => {
          let data = tickets;
          if (filters.client_id) data = data.filter((t) => t.client_id === filters.client_id);
          if (filters.assignee_id) data = data.filter((t) => t.assignee_id === filters.assignee_id);
          return { data, count: data.length };
        }}
        currentPageRows={filteredTickets}
        activeFilters={activeFilterRecord}
        filterSummary={filterSummary}
        totalFilteredCount={filteredTickets.length}
        onSuccess={exportPdfSuccess}
        onError={exportPdfError}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] xs:fixed xs:inset-0 xs:m-0 xs:max-w-full xs:h-full xs:rounded-none xs:overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle>{detailDialogTitle}</DialogTitle>
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm shrink-0"
                onClick={detailExportCsv}
                disabled={detailTickets.length === 0}
              >
                <Download className="h-3 w-3" /> {t("detailDialog.exportCsvBtn", "CSV")}
              </button>
            </div>
            <DialogDescription>
              {detailEntity
                ? t("detailDialog.entityLabel", "{{entity}}: {{name}}", {
                    entity: detailEntity.type === "client"
                      ? t("summaryTables.perClient", "Cliente")
                      : t("summaryTables.perTechnician", "Tecnico"),
                    name: detailEntity.name,
                  }) + " \u2022 " + t("detailDialog.ticketCount", { count: detailTickets.length })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            {detailTickets.length > 0 ? (
              <table className="w-full min-w-[720px] text-[12.5px]">
                <thead style={{ background: "var(--surface2)" }}>
                  <tr>
                    <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                      {t("detailDialog.headers.ticket", "Ticket")}
                    </th>
                    {detailEntity?.type === "technician" && (
                      <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                        {t("detailDialog.headers.client", "Cliente")}
                      </th>
                    )}
                    {detailEntity?.type === "client" && (
                      <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                        {t("detailDialog.headers.technician", "Tecnico")}
                      </th>
                    )}
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("detailDialog.headers.hours", "Ore")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("detailDialog.headers.rate", "Tariffa")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("detailDialog.headers.labor", "Manodopera")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("detailDialog.headers.materials", "Materiali")}
                    </th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                      {t("detailDialog.headers.total", "Totale")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-mono font-semibold text-accent">
                        <button
                          type="button"
                          className="cursor-pointer hover:underline"
                          onClick={() => openTicketDetail(ticket.id)}
                        >
                          {ticket.ticket_code}
                        </button>
                      </td>
                      {detailEntity?.type === "technician" && (
                        <td className="px-3 py-2">{ticket.client_name || "-"}</td>
                      )}
                      {detailEntity?.type === "client" && (
                        <td className="px-3 py-2">{ticket.technician_name || "-"}</td>
                      )}
                      <td className="px-3 py-2 text-right font-mono">
                        {formatHours(money(ticket.billable_hours))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(ticket.hourly_rate)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(ticket.labor_cost)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(ticket.material_cost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {formatCurrency(ticket.total_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold" style={{ borderColor: "var(--text3)" }}>
                    <td className="px-3 py-2 text-[10.5px] uppercase text-text3">
                      {t("detailTable.headers.total", "Totale")} ({detailTickets.length})
                    </td>
                    {detailEntity?.type === "technician" && <td className="px-3 py-2" />}
                    {detailEntity?.type === "client" && <td className="px-3 py-2" />}
                    <td className="px-3 py-2 text-right font-mono">{formatHours(detailTotals.hours)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(detailTotals.labor)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(detailTotals.materials)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(detailTotals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div className="py-8 text-center text-text3">
                {t("detailDialog.empty", "Nessun ticket trovato")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CostStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-wide text-text3">{label}</div>
      <div
        className="mt-2 text-xl font-bold"
        style={{ color: tone === "success" ? "var(--success)" : "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}

function SummaryTable({
  title,
  rows,
  onRowClick,
}: {
  title: string;
  rows: CostGroup[];
  onRowClick?: (name: string) => void;
}) {
  const { t } = useTranslation("costs");
  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div className="pc-card-title">{title}</div>
        {onRowClick && rows.length > 0 && (
          <div className="text-[10.5px] text-text3">
            {t("summaryTables.clickHint", "Clicca per dettaglio")}
          </div>
        )}
      </div>
      <table className="w-full text-[12.5px]">
        <thead style={{ background: "var(--surface2)" }}>
          <tr>
            <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
              {t("summaryTables.nameHeader", "Nome")}
            </th>
            <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
              {t("summaryTables.hoursHeader", "Ore")}
            </th>
            <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
              {t("summaryTables.totalHeader", "Totale")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr
              key={row.name}
              className={`border-t ${onRowClick ? "cursor-pointer transition-colors hover:bg-surface2" : ""}`}
              style={{ borderColor: "var(--border)" }}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              onClick={() => onRowClick?.(row.name)}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onRowClick(row.name);
                }
              }}
            >
              <td className="px-3 py-2 font-semibold">{row.name}</td>
              <td className="px-3 py-2 text-right font-mono">{formatHours(row.hours)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                {formatCurrency(row.total)}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="px-3 py-6 text-center text-text3" colSpan={3}>
                {t("summaryTables.noData", "Nessun dato")}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ContractMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface2 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-text3">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold">{value}</div>
    </div>
  );
}

type CostGroup = { name: string; hours: number; total: number; materials: number; labor: number };

function groupCosts(
  rows: TicketCostRow[],
  key: "client_name" | "technician_name",
  fallbacks?: { technician?: string; client?: string }
): CostGroup[] {
  const map = new Map<string, CostGroup>();
  rows.forEach((row) => {
    const name = row[key] || (key === "technician_name" ? (fallbacks?.technician ?? "Non assegnato") : (fallbacks?.client ?? "Cliente non indicato"));
    const current = map.get(name) ?? { name, hours: 0, total: 0, materials: 0, labor: 0 };
    current.hours += money(row.billable_hours);
    current.total += money(row.total_cost);
    current.materials += money(row.material_cost);
    current.labor += money(row.labor_cost);
    map.set(name, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}


function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function numberFromDraft(value: string) {
  return Math.max(0, money(value));
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    money(value),
  );
}

function formatHours(value: unknown) {
  return `${money(value).toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
