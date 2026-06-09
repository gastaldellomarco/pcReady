import { createLazyFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileDown,
  FileText,
  Info,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Send,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ExportPdf } from "@/components/ExportPdf";
import { createEmptyQuoteLine } from "@/components/pcready/quote-helpers";
import { QuoteModal, QuoteStatusBadge, QuoteActions } from "@/components/pcready/QuoteModal";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  buildAccountingCsvRows,
  buildFatturaPaXml,
  computeClientProfitability,
  invoiceSeed,
  positiveNumber,
  quoteSeed,
  type BudgetDraft,
  type InvoiceDraft,
  type QuoteDraft,
} from "@/lib/costs-finance";
import { openTicketDetail } from "@/lib/detail-navigation";
import { buildDownloadFileName, downloadCsv, downloadText } from "@/lib/downloads";
import { errorMessage } from "@/lib/errors";

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

type InvoiceRow = {
  id: string;
  client_id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "partial" | "overdue" | "void";
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  sender_name: string | null;
  sender_address: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  notes: string | null;
  client?: ClientOption | null;
};

type InvoiceItemRow = {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  item_type?: string;
};

type QuoteRow = {
  id: string;
  client_id: string;
  quote_number: string;
  status: "draft" | "sent" | "approved" | "rejected" | "converted" | "expired";
  title: string;
  issue_date: string;
  valid_until: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  converted_ticket_id: string | null;
  converted_invoice_id?: string | null;
  client?: ClientOption | null;
};

type QuoteItemRow = {
  id?: string;
  quote_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  item_type?: "service" | "labor" | "material" | "extra";
};

type QuoteLineDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  itemType: "service" | "labor" | "material" | "extra";
};

type BudgetUsageRow = {
  budget_id: string;
  client_id: string;
  client_name: string;
  period: "monthly" | "annual";
  budget_amount: number;
  alert_threshold_percent: number;
  used_amount: number;
  used_percent: number;
  alert_active: boolean;
  active: boolean;
  starts_on: string;
  ends_on: string | null;
};

type PeriodicReportRow = {
  id: string;
  client_id: string;
  report_month: string;
  status: "scheduled" | "generated" | "sent" | "failed";
  email_to: string | null;
  sent_at: string | null;
  client?: ClientOption | null;
};

type CostsTab = "dashboard" | "contracts" | "billing" | "report";

const today = new Date();
const defaultDateTo = today.toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);
const defaultDateFrom = thirtyDaysAgo.toISOString().slice(0, 10);

function getPeriodPresets(
  t: (key: string, def: string) => string,
): Array<{ label: string; from: string; to: string }> {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(now.getDate() - n);
    return d;
  };
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return [
    { label: t("presets.today", "Oggi"), from: fmt(now), to },
    { label: t("presets.last7", "Ultimi 7 giorni"), from: fmt(daysAgo(7)), to },
    { label: t("presets.lastMonth", "Ultimo mese"), from: fmt(daysAgo(30)), to },
    { label: t("presets.last3Months", "Ultimi 3 mesi"), from: fmt(daysAgo(90)), to },
    { label: t("presets.currentMonth", "Mese corrente"), from: fmt(startOfMonth), to },
    { label: t("presets.currentYear", "Anno corrente"), from: fmt(startOfYear), to },
  ];
}

const emptyContractDraft: ContractDraft = {
  client_id: "",
  name: "Contratto assistenza",
  billing_period: "monthly",
  recurring_fee: "0",
  included_hours: "0",
  extra_hourly_rate: "0",
  start_date: "",
  end_date: "",
};

const emptyInvoiceDraft: InvoiceDraft = {
  invoiceNumber: invoiceSeed(),
  senderName: "PCReady",
  senderAddress: "",
  recipientName: "",
  recipientAddress: "",
  issueDate: defaultDateTo,
  dueDate: defaultDateTo,
  taxRate: "22",
  notes: "",
  logoUrl: "",
};

const emptyQuoteDraft: QuoteDraft = {
  clientId: "",
  quoteNumber: quoteSeed(),
  title: "Preventivo extra-contratto",
  validUntil: defaultDateTo,
  description: "Intervento extra-contratto",
  quantity: "1",
  unitPrice: "0",
  notes: "",
};

const emptyBudgetDraft: BudgetDraft = {
  clientId: "",
  period: "monthly",
  budgetAmount: "0",
  alertThresholdPercent: "80",
  startsOn: defaultDateFrom,
  endsOn: "",
};

function CostsPage() {
  const { canEdit, profile } = useAuth();
  const canManageCosts = profile?.role === "admin" || profile?.role === "tech";
  const { t } = useTranslation("costs");
  const [dateFrom, setDateFrom] = useState(() => {
    try {
      return localStorage.getItem("costs.dateFrom") || defaultDateFrom;
    } catch {
      return defaultDateFrom;
    }
  });
  const [dateTo, setDateTo] = useState(() => {
    try {
      return localStorage.getItem("costs.dateTo") || defaultDateTo;
    } catch {
      return defaultDateTo;
    }
  });
  const [clientFilter, setClientFilter] = useState(() => {
    try {
      return localStorage.getItem("costs.clientFilter") || "all";
    } catch {
      return "all";
    }
  });
  const [technicianFilter, setTechnicianFilter] = useState(() => {
    try {
      return localStorage.getItem("costs.technicianFilter") || "all";
    } catch {
      return "all";
    }
  });
  const [tickets, setTickets] = useState<TicketCostRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [budgetUsage, setBudgetUsage] = useState<BudgetUsageRow[]>([]);
  const [_periodicReports, setPeriodicReports] = useState<PeriodicReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [invoicePdfOpen, setInvoicePdfOpen] = useState(false);
  const [quotePdfOpen, setQuotePdfOpen] = useState(false);
  const [quotePdfItems, setQuotePdfItems] = useState<QuoteItemRow[]>([]);
  const [quotePdfMeta, setQuotePdfMeta] = useState<QuoteRow | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceStep, setInvoiceStep] = useState<"details" | "preview">("details");
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteRow["status"] | "all">("all");
  const [quoteClientFilter, setQuoteClientFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(emptyContractDraft);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(emptyInvoiceDraft);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraft>(emptyQuoteDraft);
  const [quoteLines, setQuoteLines] = useState<QuoteLineDraft[]>(() => [createEmptyQuoteLine()]);
  const [quoteTicketId, setQuoteTicketId] = useState("");
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>(emptyBudgetDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEntity, setDetailEntity] = useState<{
    type: "client" | "technician";
    name: string;
  } | null>(null);
  const [detailGroupBy, setDetailGroupBy] = useState<"none" | "client" | "technician">("none");
  const [activeTab, setActiveTab] = useState<CostsTab>("dashboard");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        ticketResult,
        contractResult,
        clientResult,
        invoiceResult,
        quoteResult,
        budgetResult,
        reportResult,
      ] = await Promise.all([
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
        (supabase as any)
          .from("cost_invoices")
          .select("*, client:clients(id, name, company_name)")
          .order("issue_date", { ascending: false })
          .limit(12),
        (supabase as any)
          .from("cost_quotes")
          .select("*, client:clients(id, name, company_name)")
          .order("issue_date", { ascending: false })
          .limit(12),
        (supabase as any)
          .from("client_budget_usage_summary")
          .select("*")
          .eq("active", true)
          .order("used_percent", { ascending: false }),
        (supabase as any)
          .from("cost_periodic_reports")
          .select("*, client:clients(id, name, company_name)")
          .order("report_month", { ascending: false })
          .limit(8),
      ]);
      if (ticketResult.error) throw ticketResult.error;
      if (contractResult.error) throw contractResult.error;
      if (clientResult.error) throw clientResult.error;
      if (invoiceResult.error && invoiceResult.error.code !== "42P01") throw invoiceResult.error;
      if (quoteResult.error && quoteResult.error.code !== "42P01") throw quoteResult.error;
      if (budgetResult.error && budgetResult.error.code !== "42P01") throw budgetResult.error;
      if (reportResult.error && reportResult.error.code !== "42P01") throw reportResult.error;
      setTickets((ticketResult.data ?? []) as TicketCostRow[]);
      setContracts((contractResult.data ?? []) as ContractRow[]);
      setClients((clientResult.data ?? []) as ClientOption[]);
      setInvoices((invoiceResult.data ?? []) as InvoiceRow[]);
      setQuotes((quoteResult.data ?? []) as QuoteRow[]);
      setBudgetUsage((budgetResult.data ?? []) as BudgetUsageRow[]);
      setPeriodicReports((reportResult.data ?? []) as PeriodicReportRow[]); // stored in _periodicReports
    } catch (error) {
      toast.error(errorMessage(error, t("feedback.loadError", "Errore caricamento costi")));
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, t]);

  useEffect(() => {
    void loadData();
     
  }, [loadData]);

  // Persist date range to localStorage so it's remembered across visits
  useEffect(() => {
    try {
      localStorage.setItem("costs.dateFrom", dateFrom);
      localStorage.setItem("costs.dateTo", dateTo);
      localStorage.setItem("costs.clientFilter", clientFilter);
      localStorage.setItem("costs.technicianFilter", technicianFilter);
    } catch {
      /* localStorage unavailable — ignore */
    }
     
  }, [dateFrom, dateTo, clientFilter, technicianFilter]);

  const technicians = useMemo(
    () =>
      Array.from(
        new Map(
          tickets
            .filter((ticket) => ticket.assignee_id)
            .map((ticket) => [
              ticket.assignee_id!,
              ticket.technician_name || t("fallbacks.noName", "Senza nome"),
            ]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [tickets],
  );

  const clientNameMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c.company_name || c.name] as const)),
    [clients],
  );

  const enrichedTickets = useMemo(
    () =>
      tickets.map((ticket) => ({
        ...ticket,
        client_name:
          ticket.client_name ||
          (ticket.client_id ? (clientNameMap.get(ticket.client_id) ?? null) : null),
      })),
    [tickets, clientNameMap],
  );

  const filteredTickets = useMemo(
    () =>
      enrichedTickets.filter((ticket) => {
        if (clientFilter !== "all" && ticket.client_id !== clientFilter) return false;
        if (technicianFilter !== "all" && ticket.assignee_id !== technicianFilter) return false;
        return true;
      }),
    [clientFilter, technicianFilter, enrichedTickets],
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

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientFilter) ?? null,
    [clientFilter, clients],
  );

  const profitability = useMemo(
    () =>
      computeClientProfitability(
        filteredTickets,
        filteredContracts,
        t("fallbacks.clientNotIndicated", "Cliente non indicato"),
      ),
    [filteredContracts, filteredTickets, t],
  );

  const selectedClientTickets = useMemo(
    () =>
      clientFilter === "all"
        ? filteredTickets
        : filteredTickets.filter((ticket) => ticket.client_id === clientFilter),
    [clientFilter, filteredTickets],
  );

  const invoiceSourceRows = useMemo(
    () => (selectedClient && clientFilter !== "all" ? selectedClientTickets : []),
    [clientFilter, selectedClient, selectedClientTickets],
  );

  const invoicePreviewItems = useMemo<InvoiceItemRow[]>(
    () =>
      invoiceSourceRows.map((ticket) => ({
        description: `${ticket.ticket_code} - ${ticket.client_name ?? selectedClient?.name ?? ""}`,
        quantity: 1,
        unit_price: money(ticket.total_cost),
        line_total: money(ticket.total_cost),
        item_type: "service",
      })),
    [invoiceSourceRows, selectedClient],
  );

  const invoicePreviewTotals = useMemo(() => {
    const subtotal = invoiceSourceRows.reduce((sum, ticket) => sum + money(ticket.total_cost), 0);
    const taxRate = positiveNumber(invoiceDraft.taxRate);
    const taxAmount = roundMoney((subtotal * taxRate) / 100);
    return {
      subtotal,
      taxRate,
      taxAmount,
      total: roundMoney(subtotal + taxAmount),
    };
  }, [invoiceDraft.taxRate, invoiceSourceRows]);

  const quoteTotals = useMemo(() => {
    const subtotal = quoteLines.reduce(
      (sum, line) => sum + positiveNumber(line.quantity) * positiveNumber(line.unitPrice),
      0,
    );
    const taxRate = 22;
    const taxAmount = roundMoney((subtotal * taxRate) / 100);
    return {
      subtotal: roundMoney(subtotal),
      taxRate,
      taxAmount,
      total: roundMoney(subtotal + taxAmount),
    };
  }, [quoteLines]);

  const quoteTicketOptions = useMemo(
    () =>
      filteredTickets.filter((ticket) => {
        if (!quoteDraft.clientId) return true;
        return ticket.client_id === quoteDraft.clientId;
      }),
    [filteredTickets, quoteDraft.clientId],
  );

  const filteredQuotes = useMemo(
    () =>
      quotes.filter((quote) => {
        if (quoteStatusFilter !== "all" && quote.status !== quoteStatusFilter) return false;
        if (quoteClientFilter !== "all" && quote.client_id !== quoteClientFilter) return false;
        return true;
      }),
    [quoteClientFilter, quoteStatusFilter, quotes],
  );

  const byClient = useMemo(
    () =>
      groupCosts(filteredTickets, "client_name", {
        client: t("fallbacks.clientNotIndicated", "Cliente non indicato"),
      }),
    [filteredTickets, t],
  );
  const byTechnician = useMemo(
    () =>
      groupCosts(filteredTickets, "technician_name", {
        technician: t("fallbacks.notAssigned", "Non assegnato"),
      }),
    [filteredTickets, t],
  );

  const detailTickets = useMemo(() => {
    if (!detailEntity) return [] as TicketCostRow[];
    const key = detailEntity.type === "client" ? "client_name" : "technician_name";
    const fallback =
      detailEntity.type === "technician"
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

  const nextInvoiceNumber = useMemo(() => buildNextInvoiceNumber(invoices), [invoices]);

  const groupedDetail = useMemo(() => {
    if (detailGroupBy === "none") return null;
    const key = detailGroupBy === "client" ? "client_name" : "technician_name";
    const fallback =
      detailGroupBy === "technician"
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

  function openNewInvoice() {
    if (clientFilter === "all" || !selectedClient) {
      toast.error(t("feedback.selectClient", "Seleziona un cliente"));
      return;
    }
    setInvoiceDraft((prev) => ({
      ...prev,
      invoiceNumber: nextInvoiceNumber,
      recipientName: selectedClient.company_name || selectedClient.name,
    }));
    setInvoiceStep("details");
    setInvoiceModalOpen(true);
  }

  function closeInvoiceModal(open: boolean) {
    setInvoiceModalOpen(open);
    if (!open) setInvoiceStep("details");
  }

  function resetQuoteDraft(clientId = clientFilter !== "all" ? clientFilter : "") {
    setQuoteDraft({
      ...emptyQuoteDraft,
      clientId,
      quoteNumber: quoteSeed(),
    });
    setQuoteLines([createEmptyQuoteLine()]);
    setQuoteTicketId("");
  }

  function openNewQuote() {
    resetQuoteDraft(clientFilter !== "all" ? clientFilter : "");
    setQuoteModalOpen(true);
  }

  function closeQuoteModal(open: boolean) {
    setQuoteModalOpen(open);
    if (!open) resetQuoteDraft("");
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
    setIsFormOpen(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setErrors({});
    setTouched({});
    setDraft(emptyContractDraft);
    setIsFormOpen(false);
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
        setIsFormOpen(false);
      }
      await loadData();
      toast.success(t("contractTable.deleted", "Contratto eliminato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("contractTable.deleteError", "Errore eliminazione contratto")),
      );
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
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
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
        ({ error } = await (supabase as any)
          .from("client_contracts")
          .update(payload)
          .eq("id", editingId));
      } else {
        ({ error } = await (supabase as any).from("client_contracts").insert(payload));
      }
      if (error) throw error;
      setDraft(emptyContractDraft);
      setEditingId(null);
      setErrors({});
      setTouched({});
      setIsFormOpen(false);
      await loadData();
      toast.success(
        editingId
          ? t("feedback.contractUpdated", "Contratto aggiornato")
          : t("feedback.contractSaved", "Contratto salvato"),
      );
    } catch (error) {
      toast.error(
        errorMessage(error, t("feedback.contractSaveError", "Errore salvataggio contratto")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createInvoice() {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    if (clientFilter === "all" || !selectedClient)
      return toast.error(t("feedback.selectClient", "Seleziona un cliente"));
    const rows = invoiceSourceRows;
    if (!rows.length)
      return toast.error(
        t("finance.invoiceNoRows", "Nessun ticket da fatturare per il cliente selezionato"),
      );
    setBusy(true);
    try {
      const { subtotal, taxRate, taxAmount, total } = invoicePreviewTotals;
      const invoicePayload = {
        client_id: selectedClient.id,
        invoice_number: invoiceDraft.invoiceNumber.trim() || nextInvoiceNumber,
        status: "draft",
        issue_date: invoiceDraft.issueDate || defaultDateTo,
        due_date: invoiceDraft.dueDate || null,
        period_start: dateFrom,
        period_end: dateTo,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: total,
        paid_amount: 0,
        logo_url: invoiceDraft.logoUrl.trim() || null,
        sender_name: invoiceDraft.senderName.trim() || "PCReady",
        sender_address: invoiceDraft.senderAddress.trim() || null,
        recipient_name:
          invoiceDraft.recipientName.trim() || selectedClient.company_name || selectedClient.name,
        recipient_address: invoiceDraft.recipientAddress.trim() || null,
        notes: invoiceDraft.notes.trim() || null,
      };
      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from("cost_invoices")
        .insert(invoicePayload)
        .select()
        .single();
      if (invoiceError) throw invoiceError;
      const items = rows.map((ticket) => ({
        invoice_id: invoice.id,
        ticket_id: ticket.id,
        description: `${ticket.ticket_code} - ${ticket.client_name ?? selectedClient.name}`,
        quantity: 1,
        unit_price: money(ticket.total_cost),
        item_type: "service",
      }));
      const { error: itemsError } = await (supabase as any)
        .from("cost_invoice_items")
        .insert(items);
      if (itemsError) throw itemsError;
      const createdInvoice = { ...(invoice as InvoiceRow), client: selectedClient };
      setSelectedInvoice(createdInvoice);
      setInvoiceItems(invoicePreviewItems);
      setInvoiceModalOpen(false);
      setInvoiceStep("details");
      setInvoicePdfOpen(true);
      setInvoiceDraft({
        ...emptyInvoiceDraft,
        invoiceNumber: buildNextInvoiceNumber([createdInvoice, ...invoices]),
      });
      await loadData();
      toast.success(t("finance.invoiceCreated", "Fattura creata"));
    } catch (error) {
      toast.error(errorMessage(error, t("finance.invoiceCreateError", "Errore creazione fattura")));
    } finally {
      setBusy(false);
    }
  }

  async function openInvoicePdf(invoice: InvoiceRow) {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any)
        .from("cost_invoice_items")
        .select("description, quantity, unit_price, line_total, item_type")
        .eq("invoice_id", invoice.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setInvoiceItems((data ?? []) as InvoiceItemRow[]);
      setSelectedInvoice(invoice);
      setInvoicePdfOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, t("finance.invoiceLoadError", "Errore caricamento fattura")));
    } finally {
      setBusy(false);
    }
  }

  async function openQuotePdf(quote: QuoteRow) {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any)
        .from("cost_quote_items")
        .select("description, quantity, unit_price, line_total, item_type")
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setQuotePdfItems((data ?? []) as QuoteItemRow[]);
      setQuotePdfMeta(quote);
      setQuotePdfOpen(true);
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.quoteLoadError", "Errore caricamento preventivo")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateInvoiceStatus(invoice: InvoiceRow, status: InvoiceRow["status"]) {
    setBusy(true);
    try {
      const paidAmount =
        status === "paid"
          ? invoice.total_amount
          : status === "partial"
            ? Math.max(0, invoice.paid_amount || invoice.total_amount / 2)
            : invoice.paid_amount;
      const { error } = await (supabase as any)
        .from("cost_invoices")
        .update({ status, paid_amount: paidAmount })
        .eq("id", invoice.id);
      if (error) throw error;
      await loadData();
      toast.success(t("finance.paymentUpdated", "Stato pagamento aggiornato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.paymentUpdateError", "Errore aggiornamento pagamento")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function createQuote() {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    if (!quoteDraft.clientId)
      return toast.error(t("feedback.selectClient", "Seleziona un cliente"));
    const validLines = quoteLines
      .map((line) => ({
        ...line,
        description: line.description.trim(),
        quantity: positiveNumber(line.quantity),
        unitPrice: positiveNumber(line.unitPrice),
      }))
      .filter((line) => line.description && line.quantity > 0 && line.unitPrice >= 0);
    if (!validLines.length || quoteTotals.subtotal <= 0)
      return toast.error(
        t("finance.quoteAmountRequired", "Inserisci almeno una voce di preventivo"),
      );
    setBusy(true);
    try {
      const linkedTicket = quoteTicketOptions.find((ticket) => ticket.id === quoteTicketId);
      const notes = [
        quoteDraft.notes.trim(),
        linkedTicket ? `Ticket collegato: ${linkedTicket.ticket_code}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      const { data: quote, error: quoteError } = await (supabase as any)
        .from("cost_quotes")
        .insert({
          client_id: quoteDraft.clientId,
          quote_number: quoteDraft.quoteNumber.trim() || quoteSeed(),
          title: quoteDraft.title.trim() || "Preventivo extra-contratto",
          status: "draft",
          valid_until: quoteDraft.validUntil || null,
          subtotal: quoteTotals.subtotal,
          tax_rate: quoteTotals.taxRate,
          tax_amount: quoteTotals.taxAmount,
          total_amount: quoteTotals.total,
          notes: notes || null,
        })
        .select()
        .single();
      if (quoteError) throw quoteError;
      const { error: itemError } = await (supabase as any).from("cost_quote_items").insert(
        validLines.map((line) => ({
          quote_id: quote.id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          item_type: line.itemType,
        })),
      );
      if (itemError) throw itemError;
      closeQuoteModal(false);
      await loadData();
      toast.success(t("finance.quoteCreated", "Preventivo creato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.quoteCreateError", "Errore creazione preventivo")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function convertQuoteToTicket(quote: QuoteRow) {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    setBusy(true);
    try {
      const client = quote.client ?? clients.find((c) => c.id === quote.client_id);
      const { data: ticket, error: ticketError } = await (supabase as any)
        .from("tickets")
        .insert({
          client_id: quote.client_id,
          client: client?.company_name || client?.name || null,
          requester: client?.company_name || client?.name || "Cliente",
          ticket_type: "other",
          priority: "medium",
          status: "pending",
          notes: `${quote.title}\n\nPreventivo ${quote.quote_number} approvato.`,
          billable_hours: 0,
          hourly_rate: 0,
          material_cost: quote.subtotal,
          cost_notes: `Convertito da preventivo ${quote.quote_number}`,
        })
        .select("id")
        .single();
      if (ticketError) throw ticketError;
      const { error: quoteError } = await (supabase as any)
        .from("cost_quotes")
        .update({
          status: "converted",
          converted_ticket_id: ticket.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", quote.id);
      if (quoteError) throw quoteError;
      await loadData();
      toast.success(t("finance.quoteConverted", "Preventivo convertito in ticket"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.quoteConvertError", "Errore conversione preventivo")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateQuoteStatus(quote: QuoteRow, status: QuoteRow["status"]) {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "approved") payload.approved_at = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("cost_quotes")
        .update(payload)
        .eq("id", quote.id);
      if (error) throw error;
      await loadData();
      toast.success(t("finance.quoteStatusUpdated", "Stato preventivo aggiornato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.quoteStatusError", "Errore aggiornamento preventivo")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function convertQuoteToInvoice(quote: QuoteRow) {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    if (quote.status !== "approved")
      return toast.error(
        t("finance.quoteMustBeApproved", "Approva il preventivo prima di convertirlo in fattura"),
      );
    setBusy(true);
    try {
      const { data: quoteItems, error: itemLoadError } = await (supabase as any)
        .from("cost_quote_items")
        .select("description, quantity, unit_price, line_total, item_type")
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: true });
      if (itemLoadError) throw itemLoadError;
      const items = (quoteItems ?? []) as QuoteItemRow[];
      if (!items.length)
        throw new Error(t("finance.quoteNoRows", "Il preventivo non contiene righe"));

      const client = quote.client ?? clients.find((c) => c.id === quote.client_id);
      const invoiceNumber = buildNextInvoiceNumber(invoices);
      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from("cost_invoices")
        .insert({
          client_id: quote.client_id,
          invoice_number: invoiceNumber,
          status: "draft",
          issue_date: defaultDateTo,
          due_date: defaultDateTo,
          period_start: dateFrom,
          period_end: dateTo,
          subtotal: quote.subtotal,
          tax_rate: quote.tax_rate,
          tax_amount: quote.tax_amount,
          total_amount: quote.total_amount,
          paid_amount: 0,
          sender_name: invoiceDraft.senderName.trim() || "PCReady",
          sender_address: invoiceDraft.senderAddress.trim() || null,
          recipient_name: client?.company_name || client?.name || null,
          recipient_address: null,
          notes: `Convertita da preventivo ${quote.quote_number}`,
        })
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      const invoiceRows = items.map((item) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: money(item.quantity),
        unit_price: money(item.unit_price),
        item_type: item.item_type ?? "extra",
      }));
      const { error: invoiceItemsError } = await (supabase as any)
        .from("cost_invoice_items")
        .insert(invoiceRows);
      if (invoiceItemsError) throw invoiceItemsError;

      const { error: quoteError } = await (supabase as any)
        .from("cost_quotes")
        .update({ status: "converted", converted_invoice_id: invoice.id })
        .eq("id", quote.id);
      if (quoteError) throw quoteError;

      const createdInvoice = { ...(invoice as InvoiceRow), client };
      setSelectedInvoice(createdInvoice);
      setInvoiceItems(invoiceRows);
      setInvoicePdfOpen(true);
      await loadData();
      toast.success(t("finance.quoteConvertedToInvoice", "Preventivo convertito in fattura"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.quoteInvoiceError", "Errore conversione in fattura")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuote(quote: QuoteRow) {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    if (!window.confirm(t("finance.confirmDeleteQuote", "Eliminare questo preventivo?"))) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("cost_quotes").delete().eq("id", quote.id);
      if (error) throw error;
      await loadData();
      toast.success(t("finance.quoteDeleted", "Preventivo eliminato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.quoteDeleteError", "Errore eliminazione preventivo")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveBudget() {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    if (!budgetDraft.clientId)
      return toast.error(t("feedback.selectClient", "Seleziona un cliente"));
    setBusy(true);
    try {
      const client = clients.find((c) => c.id === budgetDraft.clientId);
      const clientName = client ? (client.company_name || client.name) : "";

      const payload = {
        client_id: budgetDraft.clientId,
        period: budgetDraft.period,
        budget_amount: positiveNumber(budgetDraft.budgetAmount),
        alert_threshold_percent: positiveNumber(budgetDraft.alertThresholdPercent) || 80,
        starts_on: budgetDraft.startsOn || defaultDateFrom,
        ends_on: budgetDraft.endsOn || null,
        active: true,
      };

      let error;
      if (editingBudgetId) {
        ({ error } = await (supabase as any)
          .from("client_budgets")
          .update(payload)
          .eq("id", editingBudgetId));
      } else {
        ({ error } = await (supabase as any).from("client_budgets").insert(payload));
      }

      if (error) throw error;
      setBudgetDraft(emptyBudgetDraft);
      setEditingBudgetId(null);
      setBudgetModalOpen(false);
      await loadData();

      toast.success(
        editingBudgetId
          ? t("finance.budgetUpdatedForClient", "Budget aggiornato per {{client}}", { client: clientName })
          : t("finance.budgetSavedForClient", "Budget impostato per {{client}}", { client: clientName })
      );
    } catch (error) {
      toast.error(errorMessage(error, t("finance.budgetSaveError", "Errore salvataggio budget")));
    } finally {
      setBusy(false);
    }
  }

  async function scheduleMonthlyReports() {
    if (!canManageCosts || !canEdit)
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    setBusy(true);
    try {
      const month = `${dateFrom.slice(0, 7)}-01`;
      const activeClients = clients.filter((client) =>
        filteredTickets.some((ticket) => ticket.client_id === client.id),
      );
      const payload = activeClients.map((client) => ({
        client_id: client.id,
        report_month: month,
        status: "scheduled",
        email_to: null,
      }));
      if (!payload.length)
        return toast.error(t("finance.noReportsToSchedule", "Nessun cliente attivo nel periodo"));
      const { error } = await (supabase as any).from("cost_periodic_reports").upsert(payload, {
        onConflict: "client_id,report_month",
      });
      if (error) throw error;
      await loadData();
      toast.success(t("finance.reportsScheduled", "Report mensili pianificati"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("finance.reportsScheduleError", "Errore pianificazione report")),
      );
    } finally {
      setBusy(false);
    }
  }

  function exportAccountingCsv() {
    downloadCsv(
      buildAccountingCsvRows(invoices as any),
      buildDownloadFileName("pcready-fatture-contabilita", "csv", { dated: true }),
    );
    toast.success(t("finance.accountingCsvExported", "CSV contabile esportato"));
  }

  async function exportInvoiceXml(invoice: InvoiceRow) {
    try {
      const { data, error } = await (supabase as any)
        .from("cost_invoice_items")
        .select("description, quantity, unit_price, line_total")
        .eq("invoice_id", invoice.id);
      if (error) throw error;
      downloadText(
        buildFatturaPaXml(invoice as any, (data ?? []) as any[]),
        buildDownloadFileName(`fattura-pa-${invoice.invoice_number}`, "xml" as any, {
          dated: false,
        }),
        { type: "application/xml;charset=utf-8" },
      );
      toast.success(t("finance.invoiceXmlExported", "XML fattura esportato"));
    } catch (error) {
      toast.error(errorMessage(error, t("finance.invoiceXmlError", "Errore export XML")));
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
          <TrendingUp className="size-5 text-text3" />
        </div>
        <div className="pc-card-body">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-[150px_150px_1fr_1fr_auto_auto]">
            <DatePickerInput value={dateFrom} onChange={setDateFrom} />
            <DatePickerInput value={dateTo} onChange={setDateTo} />
            <select
              className="pc-input"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              aria-label={t("filters.clientLabel", "Filtra per cliente")}
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
              aria-label={t("filters.technicianLabel", "Filtra per tecnico")}
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
              <FileDown className="size-3" /> {t("downloadPdf", "Esporta PDF")}
            </button>
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={exportCsv}>
              <Download className="size-3" /> {t("exportCsvBtn", "CSV")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1 -mt-1">
            {getPeriodPresets(t).map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`pc-btn pc-btn-xs ${dateFrom === preset.from && dateTo === preset.to ? "pc-btn-primary" : "pc-btn-ghost"}`}
                onClick={() => {
                  setDateFrom(preset.from);
                  setDateTo(preset.to);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as CostsTab)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4 lg:w-auto">
          <TabsTrigger value="dashboard">{t("tabs.dashboard", "Dashboard")}</TabsTrigger>
          <TabsTrigger value="contracts">{t("tabs.contracts", "Contratti / SLA")}</TabsTrigger>
          <TabsTrigger value="billing">{t("tabs.billing", "Fatturazione")}</TabsTrigger>
          <TabsTrigger value="report">{t("tabs.report", "Report")}</TabsTrigger>
        </TabsList>

        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <CostStat
                label={t("stats.ticketTotal", "Totale ticket")}
                value={formatCurrency(summary.ticketTotal)}
              />
              <CostStat
                label={t("stats.labor", "Manodopera")}
                value={formatCurrency(summary.labor)}
              />
              <CostStat
                label={t("stats.materials", "Materiali")}
                value={formatCurrency(summary.materials)}
              />
              <CostStat
                label={t("stats.billableHours", "Ore fatturabili")}
                value={formatHours(summary.hours)}
              />
              <CostStat
                label={t("stats.recurring", "Canoni attivi")}
                value={formatCurrency(summary.recurring)}
              />
              <CostStat
                label={t("stats.estimatedMargin", "Margine stimato")}
                value={
                  summary.recurring > 0
                    ? `${formatCurrency(summary.estimatedRevenue - summary.materials)} (${(((summary.estimatedRevenue - summary.materials) / summary.recurring) * 100).toFixed(0)}%)`
                    : formatCurrency(summary.estimatedRevenue - summary.materials)
                }
                tone="success"
                helpText={
                  summary.ticketTotal === 0 && summary.recurring > 0
                    ? t("stats.marginRecurringOnly", "Solo canoni contrattuali")
                    : t("stats.marginFormula", "Canoni attivi + Totale ticket − Costi materiali")
                }
              />
            </div>
            {summary.ticketTotal === 0 && summary.recurring > 0 && (
              <div
                className="rounded-lg border border-dashed px-4 py-2.5 text-sm text-text3"
                style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
              >
                {t(
                  "stats.noTicketMarginNote",
                  "Nessun ticket fatturabile nel periodo. Il margine include solo i canoni contrattuali.",
                )}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="pc-card">
                <div className="pc-card-hd">
                  <div>
                    <div className="pc-card-title">
                      {t("finance.profitabilityTitle", "Dashboard profittabilità")}
                    </div>
                    <div className="mt-1 text-sm text-text3">
                      {t(
                        "finance.profitabilitySubtitle",
                        "Ricavo contratto (azzurro), costo effettivo (giallo) e margine (verde) nel periodo",
                      )}
                    </div>
                  </div>
                  <TrendingUp className="size-5 text-text3" />
                </div>
                <div className="pc-card-body">
                  <div className="h-[280px] w-full">
                    <ChartContainer
                      config={{
                        revenue: { label: t("finance.revenue", "Ricavo"), color: "var(--accent)" },
                        actualCost: { label: t("finance.cost", "Costo"), color: "var(--warning)" },
                        margin: { label: t("finance.margin", "Margine"), color: "var(--success)" },
                      }}
                      className="h-full w-full"
                    >
                      <BarChart
                        data={profitability.slice(0, 8)}
                        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="clientName"
                          tick={{ fill: "var(--text3)", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                          height={24}
                        />
                        <YAxis
                          tick={{ fill: "var(--text3)", fontSize: 10 }}
                          tickFormatter={(value) => `${value}€`}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value: any, name: any) => (
                                <>
                                  <div
                                    className="size-2 shrink-0 rounded-[2px]"
                                    style={{
                                      backgroundColor:
                                        name === "margin" || name === "Margine"
                                          ? "var(--success)"
                                          : name === "revenue" || name === "Ricavo"
                                            ? "var(--accent)"
                                            : "var(--warning)",
                                    }}
                                  />
                                  <div className="flex flex-1 justify-between items-center gap-4 text-xs">
                                    <span className="text-muted-foreground">
                                      {name === "margin" || name === "Margine"
                                        ? t("finance.margin", "Margine")
                                        : name === "revenue" || name === "Ricavo"
                                          ? t("finance.revenue", "Ricavo")
                                          : t("finance.cost", "Costo")}
                                    </span>
                                    <span className="font-mono font-medium text-foreground">
                                      {formatCurrency(Number(value))}
                                    </span>
                                  </div>
                                </>
                              )}
                            />
                          }
                        />
                        <Bar
                          dataKey="revenue"
                          fill="var(--color-revenue)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="actualCost"
                          fill="var(--color-actualCost)"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="margin"
                          fill="var(--color-margin)"
                          radius={[4, 4, 0, 0]}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                  <div className="mt-4 flex items-start gap-1.5 text-xs text-text3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <Info className="size-3.5 shrink-0 text-accent mt-0.5" />
                    <span>
                      {t(
                        "finance.profitabilityNegativeNote",
                        "Nota: I valori negativi sull'asse Y indicano che i costi effettivi nel periodo (manodopera e materiali) hanno superato i ricavi del contratto mensilizzato per quel cliente.",
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pc-card">
                <div className="pc-card-hd">
                  <div className="pc-card-title">{t("finance.budgetTitle", "Budget clienti")}</div>
                  <div className="flex items-center gap-2">
                    {canManageCosts && (
                      <button
                        type="button"
                        className="pc-btn pc-btn-primary pc-btn-xs flex items-center gap-1"
                        onClick={() => {
                          setBudgetDraft(emptyBudgetDraft);
                          setEditingBudgetId(null);
                          setBudgetModalOpen(true);
                        }}
                        title={t("finance.newBudget", "Imposta budget")}
                      >
                        <Plus className="size-3" /> {t("finance.newBudget", "Imposta budget")}
                      </button>
                    )}
                    <AlertTriangle className="size-5 text-text3" />
                  </div>
                </div>
                <div className="pc-card-body space-y-3">
                  <div className="space-y-2">
                    {budgetUsage.slice(0, 5).map((budget) => {
                      const pct = money(budget.used_percent);
                      const overBudget = pct > 100;
                      const warning = pct >= 80 && pct <= 100;
                      const budgetColor = overBudget ? "#ef4444" : warning ? "#f97316" : "#22c55e";
                      const overAmount = overBudget
                        ? money(budget.used_amount) - money(budget.budget_amount)
                        : 0;
                      return (
                        <div
                          key={budget.budget_id}
                          className="rounded-lg border p-3"
                          style={{
                            borderColor: overBudget
                              ? "#ef4444"
                              : warning
                                ? "#f97316"
                                : "var(--border)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold">{budget.client_name}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className="font-mono"
                                style={{ color: overBudget ? "#ef4444" : undefined }}
                              >
                                {pct.toFixed(0)}%
                              </span>
                              {canManageCosts && (
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-text3 hover:bg-surface2 hover:text-text1"
                                  onClick={() => {
                                    setEditingBudgetId(budget.budget_id);
                                    setBudgetDraft({
                                      clientId: budget.client_id,
                                      period: budget.period,
                                      budgetAmount: String(budget.budget_amount),
                                      alertThresholdPercent: String(budget.alert_threshold_percent),
                                      startsOn: budget.starts_on || defaultDateFrom,
                                      endsOn: budget.ends_on || "",
                                    });
                                    setBudgetModalOpen(true);
                                  }}
                                  title={t("finance.editBudget", "Modifica budget")}
                                >
                                  <Pencil className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                background: budgetColor,
                              }}
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-text3">
                            <span>
                              {formatCurrency(budget.used_amount)} /{" "}
                              {formatCurrency(budget.budget_amount)}
                            </span>
                            {overBudget && (
                              <span style={{ color: "#ef4444" }}>
                                {t("budget.overBudget", "Superato di {{amount}}", {
                                  amount: formatCurrency(overAmount),
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!budgetUsage.length && (
                      <div className="text-sm text-text3">
                        {t("finance.noBudgets", "Nessun budget attivo.")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "contracts" && canManageCosts && (
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
                {isFormOpen ? (
                  <>
                    <button
                      type="button"
                      className="pc-btn pc-btn-ghost pc-btn-sm"
                      onClick={() => {
                        if (editingId) {
                          cancelEdit();
                        } else {
                          setDraft(emptyContractDraft);
                          setErrors({});
                          setTouched({});
                          setIsFormOpen(false);
                        }
                      }}
                      disabled={busy}
                    >
                      <X className="size-3" /> {t("contractForm.cancelEdit", "Annulla")}
                    </button>
                    <button
                      className="pc-btn pc-btn-primary pc-btn-sm"
                      onClick={saveContract}
                      disabled={busy || !canEdit || !draft.client_id}
                    >
                      <Save className="size-3" />{" "}
                      {editingId
                        ? t("contractForm.update", "Aggiorna contratto")
                        : t("contractForm.save", "Salva contratto")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    onClick={() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const oneYearLater = new Date();
                      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
                      const oneYearLaterStr = oneYearLater.toISOString().slice(0, 10);
                      setDraft({
                        ...emptyContractDraft,
                        start_date: todayStr,
                        end_date: oneYearLaterStr,
                      });
                      setIsFormOpen(true);
                    }}
                  >
                    <Plus className="size-3" /> {t("contractForm.newContract", "+ Nuovo contratto")}
                  </button>
                )}
              </div>
            </div>
            {isFormOpen && (
              <div className="pc-card-body grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-8">
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
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.client_id}
                    </p>
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
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.name}
                    </p>
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
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.recurring_fee}
                    </p>
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
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.included_hours}
                    </p>
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
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.extra_hourly_rate}
                    </p>
                  )}
                </label>
                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("contractForm.startDateLabel", "Data inizio")}
                  <DatePickerInput
                    value={draft.start_date}
                    minDate={undefined}
                    onBlur={() => touchField("start_date")}
                    onChange={(v) => {
                      clearFieldError("start_date");
                      clearFieldError("end_date");
                      setDraft((prev) => ({ ...prev, start_date: v }));
                    }}
                  />
                  {touched.start_date && errors.start_date && (
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.start_date}
                    </p>
                  )}
                </label>
                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("contractForm.endDateLabel", "Data fine")}
                  <DatePickerInput
                    value={draft.end_date}
                    minDate={draft.start_date || undefined}
                    onBlur={() => touchField("end_date")}
                    onChange={(v) => {
                      clearFieldError("end_date");
                      setDraft((prev) => ({ ...prev, end_date: v }));
                    }}
                  />
                  {touched.end_date && errors.end_date && (
                    <p className="text-xs" style={{ color: "var(--destructive)" }}>
                      {errors.end_date}
                    </p>
                  )}
                </label>
              </div>
            )}
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
                          {contract.client?.company_name ||
                            contract.client?.name ||
                            t("fallbacks.client", "Cliente")}
                        </td>
                        <td className="px-3 py-2 font-medium">{contract.name}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs rounded-full bg-surface2 px-2 py-0.5">
                            {contract.billing_period === "monthly"
                              ? t("contracts.period.monthly", "Mensile")
                              : t("contracts.period.annual", "Annuale")}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(contract.recurring_fee)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatHours(contract.included_hours)}
                        </td>
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
                              <Pencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              className="pc-btn pc-btn-ghost pc-btn-xs text-destructive"
                              onClick={() => deleteContract(contract.id)}
                              disabled={busy}
                              title={t("contractTable.delete", "Elimina")}
                            >
                              <Trash2 className="size-3" />
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

        {activeTab === "billing" && canManageCosts && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="pc-card">
              <div className="pc-card-hd">
                <div>
                  <div className="pc-card-title">
                    {t("finance.invoiceTitle", "Generazione fattura")}
                  </div>
                  <div className="mt-1 text-sm text-text3">
                    {selectedClient
                      ? t("finance.invoiceClientHint", "{{count}} ticket per {{client}}", {
                          count: invoiceSourceRows.length,
                          client: selectedClient.company_name || selectedClient.name,
                        })
                      : t("finance.invoiceSelectHint", "Filtra un cliente per generare la fattura")}
                  </div>
                </div>
                <ReceiptText className="size-5 text-text3" />
              </div>
              <div className="pc-card-body space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <ContractMetric
                    label={t("finance.invoiceContextPeriod", "Periodo")}
                    value={`${dateFrom} - ${dateTo}`}
                  />
                  <ContractMetric
                    label={t("finance.invoiceContextRows", "Righe")}
                    value={String(invoiceSourceRows.length)}
                  />
                  <ContractMetric
                    label={t("finance.invoiceContextNextNumber", "Prossimo numero")}
                    value={nextInvoiceNumber}
                  />
                </div>
                <div
                  className="rounded-lg border border-dashed p-3 text-sm text-text3"
                  style={{ borderColor: "var(--border)" }}
                >
                  {selectedClient
                    ? t(
                        "finance.invoiceContextHint",
                        "La fattura userà i ticket del cliente selezionato nei filtri correnti.",
                      )
                    : t("finance.invoiceSelectHint", "Filtra un cliente per generare la fattura")}
                </div>
                <button
                  className="pc-btn pc-btn-primary pc-btn-sm w-full"
                  onClick={openNewInvoice}
                  disabled={busy || !selectedClient || !invoiceSourceRows.length}
                >
                  <Plus className="size-3" /> {t("finance.newInvoice", "Nuova fattura")}
                </button>
              </div>
            </div>

            <div className="pc-card">
              <div className="pc-card-hd">
                <div>
                  <div className="pc-card-title">{t("finance.quoteTitle", "Preventivi")}</div>
                  <div className="mt-1 text-sm text-text3">
                    {t("finance.quoteSubtitle", "{{count}} preventivi trovati", {
                      count: filteredQuotes.length,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    onClick={openNewQuote}
                    disabled={busy}
                  >
                    <Plus className="size-3" /> {t("finance.newQuote", "Nuovo preventivo")}
                  </button>
                </div>
              </div>
              <div className="pc-card-body">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <select
                    className="pc-input w-auto"
                    value={quoteStatusFilter}
                    onChange={(e) =>
                      setQuoteStatusFilter(e.target.value as QuoteRow["status"] | "all")
                    }
                  >
                    <option value="all">{t("finance.allStatuses", "Tutti gli stati")}</option>
                    <option value="draft">{t("finance.quoteStatusDraft", "Bozza")}</option>
                    <option value="sent">{t("finance.quoteStatusSent", "Inviato")}</option>
                    <option value="approved">
                      {t("finance.quoteStatusApproved", "Approvato")}
                    </option>
                    <option value="rejected">
                      {t("finance.quoteStatusRejected", "Rifiutato")}
                    </option>
                    <option value="converted">
                      {t("finance.quoteStatusConverted", "Convertito")}
                    </option>
                    <option value="expired">{t("finance.quoteStatusExpired", "Scaduto")}</option>
                  </select>
                  <select
                    className="pc-input w-auto"
                    value={quoteClientFilter}
                    onChange={(e) => setQuoteClientFilter(e.target.value)}
                  >
                    <option value="all">{t("filters.allClients", "Tutti i clienti")}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company_name || client.name}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredQuotes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-[12.5px]">
                      <thead style={{ background: "var(--surface2)" }}>
                        <tr>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                            {t("finance.quoteNumberLabel", "Numero")}
                          </th>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                            {t("contractForm.clientLabel", "Cliente")}
                          </th>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                            {t("finance.quoteTitleLabel", "Titolo")}
                          </th>
                          <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                            {t("detailTable.headers.total", "Totale")}
                          </th>
                          <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                            {t("contractTable.headers.status", "Stato")}
                          </th>
                          <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                            {t("contractTable.headers.actions", "Azioni")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQuotes.map((quote) => (
                          <tr
                            key={quote.id}
                            className="border-t"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <td className="px-3 py-2 font-mono font-semibold">
                              {quote.quote_number}
                            </td>
                            <td className="px-3 py-2">
                              {quote.client?.company_name || quote.client?.name || "-"}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate" title={quote.title}>
                              {quote.title}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {formatCurrency(quote.total_amount)}
                            </td>
                            <td className="px-3 py-2">
                              <QuoteStatusBadge status={quote.status} />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <QuoteActions
                                quote={quote}
                                busy={busy}
                                onStatusChange={updateQuoteStatus}
                                onConvertToTicket={convertQuoteToTicket}
                                onConvertToInvoice={convertQuoteToInvoice}
                                onDelete={deleteQuote}
                                onViewPdf={openQuotePdf}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-text3">
                    <Send className="mx-auto h-8 w-8 mb-2 opacity-40" />
                    <p>{t("finance.noQuotes", "Nessun preventivo creato.")}</p>
                    <button
                      className="pc-btn pc-btn-primary pc-btn-sm mt-3"
                      onClick={openNewQuote}
                      disabled={busy}
                    >
                      <Plus className="size-3" />{" "}
                      {t("finance.createFirstQuote", "Crea primo preventivo")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "billing" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <FinanceTable
              title={t("finance.invoicesTitle", "Fatture e pagamenti")}
              empty={t("finance.noInvoices", "Nessuna fattura nel periodo selezionato.")}
              emptyIcon={<FileText className="h-8 w-8" />}
              emptyAction={
                canManageCosts ? (
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm"
                    onClick={openNewInvoice}
                    disabled={!selectedClient || !invoiceSourceRows.length}
                  >
                    {t("finance.createFirstInvoice", "Crea prima fattura")}
                  </button>
                ) : undefined
              }
              actions={
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={exportAccountingCsv}
                  disabled={!invoices.length}
                >
                  <Download className="size-3" />{" "}
                  {t("finance.exportAccountingCsv", "CSV contabile")}
                </button>
              }
            >
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-mono font-semibold">{invoice.invoice_number}</td>
                  <td className="px-3 py-2">
                    {invoice.client?.company_name ||
                      invoice.client?.name ||
                      invoice.recipient_name ||
                      "-"}
                  </td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(invoice.total_amount)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-surface2 px-2 py-1 text-[11px] font-bold">
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-xs"
                        onClick={() => openInvoicePdf(invoice)}
                        title="PDF"
                      >
                        <FileDown className="size-3" />
                      </button>
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-xs"
                        onClick={() => exportInvoiceXml(invoice)}
                        title="XML"
                      >
                        XML
                      </button>
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-xs"
                        onClick={() => updateInvoiceStatus(invoice, "paid")}
                        title={t("finance.markPaid", "Pagata")}
                      >
                        <CheckCircle2 className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </FinanceTable>

            <FinanceTable
              title={`${t("finance.quotesTitle", "Tutti i preventivi")}`}
              empty={t("finance.noQuotes", "Nessun preventivo creato.")}
              emptyIcon={<Send className="h-8 w-8" />}
              emptyAction={
                canManageCosts ? (
                  <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={openNewQuote}>
                    <Plus className="size-3" />{" "}
                    {t("finance.createFirstQuote", "Crea primo preventivo")}
                  </button>
                ) : undefined
              }
              actions={
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={scheduleMonthlyReports}
                  disabled={busy}
                >
                  <Send className="size-3" /> {t("finance.scheduleReports", "Report mensili")}
                </button>
              }
            >
              {quotes.map((quote) => (
                <tr key={quote.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-mono font-semibold">{quote.quote_number}</td>
                  <td className="px-3 py-2">
                    {quote.client?.company_name || quote.client?.name || "-"}
                  </td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(quote.total_amount)}</td>
                  <td className="px-3 py-2">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QuoteActions
                      quote={quote}
                      busy={busy}
                      onStatusChange={updateQuoteStatus}
                      onConvertToTicket={convertQuoteToTicket}
                      onConvertToInvoice={convertQuoteToInvoice}
                      onDelete={deleteQuote}
                      onViewPdf={openQuotePdf}
                    />
                  </td>
                </tr>
              ))}
            </FinanceTable>
          </div>
        )}

        {activeTab === "report" && (
          <>
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

            {/* Mobile card view for ticket detail */}
            <div className="md:hidden">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="mb-3 rounded-xl border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-bold text-accent">
                      {ticket.ticket_code}
                    </span>
                    <span className="text-[11px] text-text3">{ticket.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-text3">
                        {t("detailTable.headers.client", "Cliente")}:
                      </span>{" "}
                      <span className="font-medium">{ticket.client_name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-text3">
                        {t("detailTable.headers.technician", "Tecnico")}:
                      </span>{" "}
                      <span className="font-medium">{ticket.technician_name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-text3">{t("detailTable.headers.hours", "Ore")}:</span>{" "}
                      <span className="font-mono font-medium">
                        {formatHours(money(ticket.billable_hours))}
                      </span>
                    </div>
                    <div>
                      <span className="text-text3">
                        {t("detailTable.headers.rate", "Tariffa")}:
                      </span>{" "}
                      <span className="font-mono font-medium">
                        {formatCurrency(ticket.hourly_rate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text3">
                        {t("detailTable.headers.labor", "Manodopera")}:
                      </span>{" "}
                      <span className="font-mono font-medium">
                        {formatCurrency(ticket.labor_cost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text3">
                        {t("detailTable.headers.materials", "Materiali")}:
                      </span>{" "}
                      <span className="font-mono font-medium">
                        {formatCurrency(ticket.material_cost)}
                      </span>
                    </div>
                  </div>
                  <div
                    className="mt-3 flex items-center justify-between border-t pt-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-[11px] text-text3">
                      {t("detailTable.headers.total", "Totale")}
                    </span>
                    <span className="font-mono text-sm font-bold">
                      {formatCurrency(ticket.total_cost)}
                    </span>
                  </div>
                </div>
              ))}
              {!filteredTickets.length && !loading && (
                <div className="py-8 text-center text-sm text-text3">
                  {t("detailTable.empty", "Nessun costo nel periodo selezionato")}
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block pc-card overflow-hidden">
              <div className="pc-card-hd">
                <div>
                  <div className="pc-card-title">
                    {t("detailTable.title", "Dettaglio ticket fatturabili")}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-text3">
                    <span>
                      {t("detailTable.ticketsInPeriod", { count: filteredTickets.length })}
                    </span>
                    <select
                      className="pc-input text-xs w-auto"
                      value={detailGroupBy}
                      onChange={(e) =>
                        setDetailGroupBy(e.target.value as "none" | "client" | "technician")
                      }
                      aria-label={t("detailTable.groupByLabel", "Raggruppamento")}
                    >
                      <option value="none">
                        {t("detailTable.groupByNone", "Nessun raggruppamento")}
                      </option>
                      <option value="client">
                        {t("detailTable.groupByClient", "Raggruppa per cliente")}
                      </option>
                      <option value="technician">
                        {t("detailTable.groupByTechnician", "Raggruppa per tecnico")}
                      </option>
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
                        {
                          key: "technician",
                          label: t("detailTable.headers.technician", "Tecnico"),
                        },
                        { key: "hours", label: t("detailTable.headers.hours", "Ore") },
                        { key: "rate", label: t("detailTable.headers.rate", "Tariffa") },
                        { key: "labor", label: t("detailTable.headers.labor", "Manodopera") },
                        {
                          key: "materials",
                          label: t("detailTable.headers.materials", "Materiali"),
                        },
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
                            onClick={() =>
                              openDetail(
                                detailGroupBy === "client" ? "client" : "technician",
                                group.name,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openDetail(
                                  detailGroupBy === "client" ? "client" : "technician",
                                  group.name,
                                );
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
                            <tr
                              key={ticket.id}
                              className="border-t"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <td className="px-3 py-2 pl-8 font-mono font-semibold text-accent">
                                {ticket.ticket_code}
                              </td>
                              <td className="px-3 py-2">{ticket.client_name || "-"}</td>
                              <td className="px-3 py-2">{ticket.technician_name || "-"}</td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatHours(money(ticket.billable_hours))}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatCurrency(ticket.hourly_rate)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatCurrency(ticket.labor_cost)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatCurrency(ticket.material_cost)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-bold">
                                {formatCurrency(ticket.total_cost)}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))
                    ) : (
                      filteredTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="border-t"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <td className="px-3 py-2 font-mono font-semibold text-accent">
                            {ticket.ticket_code}
                          </td>
                          <td className="px-3 py-2">{ticket.client_name || "-"}</td>
                          <td className="px-3 py-2">{ticket.technician_name || "-"}</td>
                          <td className="px-3 py-2 font-mono">
                            {formatHours(money(ticket.billable_hours))}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatCurrency(ticket.hourly_rate)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatCurrency(ticket.labor_cost)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {formatCurrency(ticket.material_cost)}
                          </td>
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
          </>
        )}

        {activeTab === "contracts" && (
          <div className="pc-card overflow-hidden">
            <div className="pc-card-hd">
              <div className="pc-card-title">
                {t("contracts.title", "Contratti attivi e ore extra")}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-2">
              {filteredContracts.map((contract) => {
                const contractTickets = enrichedTickets.filter((ticket) => {
                  // Match by client_id (primary)
                  if (ticket.client_id && ticket.client_id === contract.client_id) return true;
                  // Fallback: match by client name when client_id is NULL (pre-backfill tickets)
                  if (!ticket.client_id && ticket.client_name && contract.client) {
                    const contractName = (
                      contract.client.company_name ||
                      contract.client.name ||
                      ""
                    )
                      .toLowerCase()
                      .trim();
                    return (
                      contractName !== "" &&
                      ticket.client_name.toLowerCase().trim() === contractName
                    );
                  }
                  return false;
                });
                const associatedCount = contractTickets.length;
                const usedHours = contractTickets.reduce(
                  (sum, ticket) => sum + money(ticket.billable_hours),
                  0,
                );
                const includedH = money(contract.included_hours);
                const usedPct = includedH > 0 ? Math.min(100, (usedHours / includedH) * 100) : 0;
                const extraHours = Math.max(0, usedHours - includedH);
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
                        {contract.billing_period === "monthly"
                          ? t("contracts.period.monthly", "Mensile")
                          : t("contracts.period.annual", "Annuale")}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <ContractMetric
                        label={t("contracts.fee", "Canone")}
                        value={formatCurrency(contract.recurring_fee)}
                      />
                      <ContractMetric
                        label={t("contracts.includedHours", "Ore incluse")}
                        value={formatHours(contract.included_hours)}
                      />
                      <ContractMetric
                        label={t("contracts.associatedTickets", "Ticket associati")}
                        value={String(associatedCount)}
                      />
                      <ContractMetric
                        label={t("contracts.estimatedExtra", "Extra stimato")}
                        value={formatCurrency(extraHours * money(contract.extra_hourly_rate))}
                      />
                    </div>
                    {includedH > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-text3 mb-1">
                          <span>{t("contracts.hoursUsed", "Ore usate")}</span>
                          <span className="font-mono">
                            {formatHours(usedHours)} / {formatHours(contract.included_hours)} (
                            {usedPct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface2">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, usedPct)}%`,
                              background:
                                usedPct >= 100 ? "#ef4444" : usedPct >= 80 ? "#f97316" : "#22c55e",
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {associatedCount === 0 && (
                      <div className="mt-2 text-xs text-text4">
                        {t(
                          "contracts.noLinkedTickets",
                          "Nessun ticket collegato a questo contratto",
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {!filteredContracts.length && (
                <div className="text-sm text-text3">
                  {t("contracts.noContracts", "Nessun contratto configurato.")}
                </div>
              )}
            </div>
          </div>
        )}
      </Tabs>

      <ExportPdf<TicketCostRow, TicketCostRow>
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        entityLabel="ticket"
        renderPdf={async (rows) => {
          const { CostsReportPdf } = await import("@/components/pcready/pdf/CostsReportPdf");
          return (
            <CostsReportPdf
              rows={rows}
              summary={summary}
              period={`${dateFrom} - ${dateTo}`}
              byClient={byClient.slice(0, 8)}
              byTechnician={byTechnician.slice(0, 8)}
            />
          );
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

      <Dialog open={invoiceModalOpen} onOpenChange={closeInvoiceModal}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto xs:fixed xs:inset-0 xs:m-0 xs:h-full xs:max-w-full xs:rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-4" />
              {t("finance.newInvoice", "Nuova fattura")}
            </DialogTitle>
            <DialogDescription>
              {selectedClient
                ? t(
                    "finance.invoiceModalDescription",
                    "{{count}} ticket di {{client}} dal {{from}} al {{to}}",
                    {
                      count: invoiceSourceRows.length,
                      client: selectedClient.company_name || selectedClient.name,
                      from: dateFrom,
                      to: dateTo,
                    },
                  )
                : t("finance.invoiceSelectHint", "Filtra un cliente per generare la fattura")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {(["details", "preview"] as const).map((step) => (
              <button
                key={step}
                type="button"
                className={`pc-btn pc-btn-sm ${invoiceStep === step ? "pc-btn-primary" : "pc-btn-ghost"}`}
                onClick={() => setInvoiceStep(step)}
                disabled={step === "preview" && (!selectedClient || !invoiceSourceRows.length)}
              >
                {step === "details"
                  ? t("finance.invoiceStepDetails", "Dettagli")
                  : t("finance.invoiceStepPreview", "Anteprima")}
              </button>
            ))}
          </div>

          {invoiceStep === "details" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium text-text2">
                    {t("finance.issueDateLabel", "Data emissione")}
                    <DatePickerInput
                      value={invoiceDraft.issueDate}
                      onChange={(v) => setInvoiceDraft((prev) => ({ ...prev, issueDate: v }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-text2">
                    {t("finance.dueDateLabel", "Scadenza")}
                    <DatePickerInput
                      value={invoiceDraft.dueDate}
                      minDate={invoiceDraft.issueDate || undefined}
                      onChange={(v) => setInvoiceDraft((prev) => ({ ...prev, dueDate: v }))}
                    />
                  </label>
                </div>

                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("finance.recipientNameLabel", "Cliente destinatario")}
                  <input
                    className="pc-input"
                    value={invoiceDraft.recipientName}
                    onChange={(e) =>
                      setInvoiceDraft((v) => ({ ...v, recipientName: e.target.value }))
                    }
                    placeholder={selectedClient?.company_name || selectedClient?.name || undefined}
                  />
                </label>

                <label className="space-y-1 text-sm font-medium text-text2">
                  {t("finance.recipientAddressLabel", "Indirizzo destinatario")}
                  <textarea
                    className="pc-input min-h-16"
                    value={invoiceDraft.recipientAddress}
                    onChange={(e) =>
                      setInvoiceDraft((v) => ({ ...v, recipientAddress: e.target.value }))
                    }
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <label className="space-y-1 text-sm font-medium text-text2">
                    {t("finance.taxRateLabel", "IVA %")}
                    <input
                      className="pc-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceDraft.taxRate}
                      onChange={(e) => setInvoiceDraft((v) => ({ ...v, taxRate: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium text-text2">
                    {t("finance.notesLabel", "Note")}
                    <input
                      className="pc-input"
                      value={invoiceDraft.notes}
                      onChange={(e) => setInvoiceDraft((v) => ({ ...v, notes: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-surface2 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
                    {t("finance.invoiceNumberLabel", "Numero fattura")}
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold">
                    {invoiceDraft.invoiceNumber}
                  </div>
                  <div className="mt-1 text-xs text-text3">
                    {t("finance.invoiceNumberAutoHint", "Generato automaticamente in sequenza.")}
                  </div>
                </div>
                <div className="rounded-lg bg-surface2 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
                    {t("finance.senderNameLabel", "Ragione sociale emittente")}
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {invoiceDraft.senderName || "PCReady"}
                  </div>
                  {invoiceDraft.senderAddress && (
                    <div className="mt-1 whitespace-pre-line text-xs text-text3">
                      {invoiceDraft.senderAddress}
                    </div>
                  )}
                </div>
                <ContractMetric
                  label={t("finance.invoiceContextRows", "Righe")}
                  value={String(invoiceSourceRows.length)}
                />
                <ContractMetric
                  label={t("finance.invoicePreviewTotal", "Totale")}
                  value={formatCurrency(invoicePreviewTotals.total)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-4">
                <ContractMetric
                  label={t("finance.invoiceNumberLabel", "Numero fattura")}
                  value={invoiceDraft.invoiceNumber}
                />
                <ContractMetric
                  label={t("finance.invoiceContextRows", "Righe")}
                  value={String(invoiceSourceRows.length)}
                />
                <ContractMetric
                  label={t("finance.invoicePreviewSubtotal", "Imponibile")}
                  value={formatCurrency(invoicePreviewTotals.subtotal)}
                />
                <ContractMetric
                  label={t("finance.invoicePreviewTotal", "Totale")}
                  value={formatCurrency(invoicePreviewTotals.total)}
                />
              </div>

              <div
                className="overflow-x-auto rounded-lg border"
                style={{ borderColor: "var(--border)" }}
              >
                <table className="w-full min-w-[680px] text-[12.5px]">
                  <thead style={{ background: "var(--surface2)" }}>
                    <tr>
                      <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                        {t("detailTable.headers.ticket", "Ticket")}
                      </th>
                      <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                        {t("detailTable.headers.client", "Cliente")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detailTable.headers.hours", "Ore")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detailTable.headers.labor", "Manodopera")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detailTable.headers.materials", "Materiali")}
                      </th>
                      <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detailTable.headers.total", "Totale")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceSourceRows.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-t"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <td className="px-3 py-2 font-mono font-semibold">{ticket.ticket_code}</td>
                        <td className="px-3 py-2">
                          {ticket.client_name || selectedClient?.name || "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatHours(ticket.billable_hours)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(ticket.labor_cost)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCurrency(ticket.material_cost)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold">
                          {formatCurrency(ticket.total_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto grid max-w-sm gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-text3">
                    {t("finance.invoicePreviewSubtotal", "Imponibile")}
                  </span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(invoicePreviewTotals.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-text3">IVA {invoicePreviewTotals.taxRate}%</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(invoicePreviewTotals.taxAmount)}
                  </span>
                </div>
                <div
                  className="flex justify-between gap-4 border-t pt-2 text-base"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="font-bold">{t("finance.invoicePreviewTotal", "Totale")}</span>
                  <span className="font-mono font-bold">
                    {formatCurrency(invoicePreviewTotals.total)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div
            className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"
            style={{ borderColor: "var(--border)" }}
          >
            {invoiceStep === "preview" && (
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={() => setInvoiceStep("details")}
                disabled={busy}
              >
                <ArrowLeft className="size-3" /> {t("finance.backToDetails", "Torna ai dettagli")}
              </button>
            )}
            {invoiceStep === "details" ? (
              <button
                type="button"
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={() => setInvoiceStep("preview")}
                disabled={!selectedClient || !invoiceSourceRows.length}
              >
                <Eye className="size-3" /> {t("finance.previewInvoice", "Anteprima")}
              </button>
            ) : (
              <button
                type="button"
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={createInvoice}
                disabled={busy || !selectedClient || !invoiceSourceRows.length}
              >
                <FileText className="size-3" /> {t("finance.createInvoice", "Crea fattura PDF")}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <QuoteModal
        open={quoteModalOpen}
        onOpenChange={closeQuoteModal}
        quoteDraft={quoteDraft}
        setQuoteDraft={setQuoteDraft}
        quoteLines={quoteLines}
        setQuoteLines={setQuoteLines}
        quoteTicketId={quoteTicketId}
        setQuoteTicketId={setQuoteTicketId}
        clients={clients}
        ticketOptions={quoteTicketOptions}
        busy={busy}
        onCreateQuote={createQuote}
      />

      <ExportPdf<QuoteItemRow, QuoteItemRow>
        open={quotePdfOpen}
        onOpenChange={setQuotePdfOpen}
        entityLabel="preventivo"
        currentPageRows={quotePdfItems}
        totalFilteredCount={quotePdfItems.length}
        mapRow={(row) => row}
        activeFilters={{}}
        fetchAll={async () => ({ data: quotePdfItems, count: quotePdfItems.length })}
        renderPdf={async (rows) => {
          const { QuotePdf } = await import("@/components/pcready/pdf/InvoicePdf");
          const meta = quotePdfMeta;
          const client = meta?.client ?? clients.find((c) => c.id === meta?.client_id);
          return (
            <QuotePdf
              title="Preventivo"
              number={meta?.quote_number ?? ""}
              status={meta?.status}
              issueDate={meta?.issue_date ?? ""}
              dueDate={meta?.valid_until ?? null}
              senderName="PCReady"
              recipientName={client?.company_name || client?.name || "Cliente"}
              notes={meta?.notes}
              subtotal={meta?.subtotal ?? 0}
              taxRate={meta?.tax_rate ?? 22}
              taxAmount={meta?.tax_amount ?? 0}
              total={meta?.total_amount ?? 0}
              items={rows}
            />
          );
        }}
        fileName={`preventivo-${quotePdfMeta?.quote_number ?? "export"}`}
        onSuccess={() => toast.success(t("finance.quotePdfExported", "PDF preventivo esportato"))}
        onError={(err) =>
          toast.error(errorMessage(err, t("finance.quotePdfError", "Errore export PDF preventivo")))
        }
      />

      <ExportPdf<InvoiceItemRow, InvoiceItemRow>
        open={invoicePdfOpen}
        onOpenChange={setInvoicePdfOpen}
        entityLabel="righe fattura"
        renderPdf={async (rows) => {
          const { InvoicePdf } = await import("@/components/pcready/pdf/InvoicePdf");
          const invoice = selectedInvoice;
          return (
            <InvoicePdf
              title="Fattura"
              number={invoice?.invoice_number ?? invoiceDraft.invoiceNumber}
              status={invoice?.status ?? "draft"}
              issueDate={invoice?.issue_date ?? invoiceDraft.issueDate}
              dueDate={invoice?.due_date ?? invoiceDraft.dueDate}
              senderName={invoice?.sender_name ?? invoiceDraft.senderName}
              senderAddress={invoice?.sender_address ?? invoiceDraft.senderAddress}
              recipientName={
                invoice?.recipient_name ?? selectedClient?.company_name ?? selectedClient?.name
              }
              recipientAddress={invoice?.recipient_address ?? invoiceDraft.recipientAddress}
              notes={invoice?.notes ?? invoiceDraft.notes}
              subtotal={
                invoice?.subtotal ??
                rows.reduce(
                  (sum, row) =>
                    sum + money(row.line_total ?? money(row.quantity) * money(row.unit_price)),
                  0,
                )
              }
              taxRate={invoice?.tax_rate ?? money(invoiceDraft.taxRate)}
              taxAmount={invoice?.tax_amount ?? 0}
              total={invoice?.total_amount ?? 0}
              paidAmount={invoice?.paid_amount ?? 0}
              items={rows.map((row) => ({
                description: row.description,
                quantity: money(row.quantity),
                unit_price: money(row.unit_price),
                line_total: money(row.line_total ?? money(row.quantity) * money(row.unit_price)),
                item_type: row.item_type,
              }))}
            />
          );
        }}
        mapRow={(row) => row}
        fileName={buildDownloadFileName(
          `pcready-fattura-${selectedInvoice?.invoice_number ?? "bozza"}`,
          "pdf",
          { dated: true },
        )}
        fetchAll={async () => ({ data: invoiceItems, count: invoiceItems.length })}
        currentPageRows={invoiceItems}
        activeFilters={{ invoice: selectedInvoice?.invoice_number }}
        filterSummary={[`Fattura: ${selectedInvoice?.invoice_number ?? "-"}`]}
        totalFilteredCount={invoiceItems.length}
        onSuccess={() => toast.success(t("finance.invoicePdfExported", "Fattura PDF esportata"))}
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
                <Download className="size-3" /> {t("detailDialog.exportCsvBtn", "CSV")}
              </button>
            </div>
            <DialogDescription>
              {detailEntity
                ? t("detailDialog.entityLabel", "{{entity}}: {{name}}", {
                    entity:
                      detailEntity.type === "client"
                        ? t("summaryTables.perClient", "Cliente")
                        : t("summaryTables.perTechnician", "Tecnico"),
                    name: detailEntity.name,
                  }) +
                  " \u2022 " +
                  t("detailDialog.ticketCount", { count: detailTickets.length })
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
                    <tr
                      key={ticket.id}
                      className="border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
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
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(ticket.hourly_rate)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(ticket.labor_cost)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(ticket.material_cost)}
                      </td>
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
                    <td className="px-3 py-2 text-right font-mono">
                      {formatHours(detailTotals.hours)}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(detailTotals.labor)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(detailTotals.materials)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {formatCurrency(detailTotals.total)}
                    </td>
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

      <Dialog open={budgetModalOpen} onOpenChange={setBudgetModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBudgetId
                ? t("finance.editBudgetTitle", "Modifica budget cliente")
                : t("finance.newBudgetTitle", "Imposta budget cliente")}
            </DialogTitle>
            <DialogDescription>
              {t("finance.budgetDesc", "Configura il budget di spesa massima ed avvisi per questo cliente.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="space-y-1 text-sm font-medium text-text2 block">
              {t("contractForm.clientLabel", "Cliente")}
              <select
                className="pc-input w-full"
                value={budgetDraft.clientId}
                disabled={!!editingBudgetId}
                onChange={(e) =>
                  setBudgetDraft((v) => ({ ...v, clientId: e.target.value }))
                }
              >
                <option value="">
                  {t("contractForm.clientPlaceholder", "Seleziona cliente...")}
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.company_name || client.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm font-medium text-text2 block">
                {t("contractForm.billingPeriodLabel", "Fatturazione")}
                <select
                  className="pc-input w-full"
                  value={budgetDraft.period}
                  onChange={(e) =>
                    setBudgetDraft((v) => ({
                      ...v,
                      period: e.target.value as BudgetDraft["period"],
                    }))
                  }
                >
                  <option value="monthly">{t("contracts.period.monthly", "Mensile")}</option>
                  <option value="annual">{t("contracts.period.annual", "Annuale")}</option>
                </select>
              </label>

              <label className="space-y-1 text-sm font-medium text-text2 block">
                {t("finance.budgetAmountLabel", "Budget (€)")}
                <input
                  className="pc-input w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetDraft.budgetAmount}
                  onChange={(e) =>
                    setBudgetDraft((v) => ({ ...v, budgetAmount: e.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm font-medium text-text2 block">
                <span className="flex items-center gap-1">
                  {t("finance.alertThresholdLabel", "Alert %")}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help">
                          <Info className="h-3.5 w-3.5 text-text3 hover:text-text2 transition-colors" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
                        {t("finance.alertThresholdTooltip", "Riceverai un avviso quando la spesa supera la percentuale impostata del budget.")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <input
                  className="pc-input w-full"
                  type="number"
                  min="1"
                  max="100"
                  value={budgetDraft.alertThresholdPercent}
                  onChange={(e) =>
                    setBudgetDraft((v) => ({ ...v, alertThresholdPercent: e.target.value }))
                  }
                />
              </label>

              <label className="space-y-1 text-sm font-medium text-text2 block">
                {t("finance.startsOnLabel", "Inizio validità")}
                <DatePickerInput
                  value={budgetDraft.startsOn}
                  onChange={(v) => setBudgetDraft((prev) => ({ ...prev, startsOn: v }))}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => setBudgetModalOpen(false)}
            >
              {t("contractForm.cancelEdit", "Annulla")}
            </button>
            <button
              className="pc-btn pc-btn-primary pc-btn-sm"
              disabled={busy || !budgetDraft.clientId}
              onClick={saveBudget}
            >
              <Save className="size-3" /> {t("finance.saveBudget", "Salva budget")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanceTable({
  title,
  empty,
  emptyIcon,
  emptyAction,
  actions,
  children,
}: {
  title: string;
  empty: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div className="pc-card-title">{title}</div>
        {actions}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {["Numero", "Cliente", "Totale", "Stato", "Azioni"].map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {children}
            {Array.isArray(children) && children.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center" colSpan={5}>
                  <div className="flex flex-col items-center gap-2 text-text3">
                    {emptyIcon && <div className="text-text4">{emptyIcon}</div>}
                    <div className="text-sm">{empty}</div>
                    {emptyAction && <div className="mt-1">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CostStat({
  label,
  value,
  tone = "default",
  helpText,
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
  helpText?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text3">
        {label}
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help">
                  <Info className="h-3.5 w-3.5 text-text3 hover:text-text2 transition-colors" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                {helpText}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
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
  fallbacks?: { technician?: string; client?: string },
): CostGroup[] {
  const map = new Map<string, CostGroup>();
  rows.forEach((row) => {
    const name =
      row[key] ||
      (key === "technician_name"
        ? (fallbacks?.technician ?? "Non assegnato")
        : (fallbacks?.client ?? "Cliente non indicato"));
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildNextInvoiceNumber(invoices: Array<{ invoice_number?: string | null }>) {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const max = invoices.reduce((highest, invoice) => {
    const number = invoice.invoice_number ?? "";
    if (!number.startsWith(prefix)) return highest;
    const suffix = Number(number.slice(prefix.length));
    return Number.isFinite(suffix) ? Math.max(highest, suffix) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    money(value),
  );
}

function formatHours(value: unknown) {
  return `${money(value).toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
}
