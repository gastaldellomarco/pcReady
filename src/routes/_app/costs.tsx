import { useCallback, useEffect, useMemo, useState } from "react";
import { Document } from "@react-pdf/renderer";
import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import {
  BrandedPage,
  PdfSection,
  PdfTable,
  StatStrip,
  type PdfColumn,
} from "@/components/pcready/pdf/shared";
import { pdfPalette } from "@/components/pcready/pdf/theme";
import { Download, Eye, FileText, Save, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/costs")({
  head: () => ({
    meta: [
      { title: "Costi - PCReady" },
      { name: "description", content: "Gestione costi ticket, contratti e report fatturazione." },
    ],
  }),
  component: CostsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
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
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [clientFilter, setClientFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [tickets, setTickets] = useState<TicketCostRow[]>([]);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"preview" | "download" | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(emptyContractDraft);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketResult, contractResult, clientResult] = await Promise.all([
        (supabase as any)
          .from("ticket_cost_summary")
          .select("*")
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
      toast.error(errorMessage(error, "Errore caricamento costi"));
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
            .map((ticket) => [ticket.assignee_id!, ticket.technician_name || "Senza nome"]),
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

  const byClient = useMemo(() => groupCosts(filteredTickets, "client_name"), [filteredTickets]);
  const byTechnician = useMemo(
    () => groupCosts(filteredTickets, "technician_name"),
    [filteredTickets],
  );

  async function saveContract() {
    if (!canManageCosts || !canEdit) return toast.error("Permessi insufficienti");
    if (!draft.client_id) return toast.error("Seleziona un cliente");
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("client_contracts").insert({
        client_id: draft.client_id,
        name: draft.name.trim() || "Contratto assistenza",
        billing_period: draft.billing_period,
        recurring_fee: numberFromDraft(draft.recurring_fee),
        included_hours: numberFromDraft(draft.included_hours),
        extra_hourly_rate: numberFromDraft(draft.extra_hourly_rate),
        start_date: draft.start_date || defaultDateFrom,
        end_date: draft.end_date || null,
        status: "active",
      });
      if (error) throw error;
      setDraft(emptyContractDraft);
      await loadData();
      toast.success("Contratto salvato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore salvataggio contratto"));
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      [
        [
          "Ticket",
          "Cliente",
          "Tecnico",
          "Ore",
          "Tariffa",
          "Manodopera",
          "Materiali",
          "Totale",
          "Stato",
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
    toast.success("CSV costi esportato");
  }

  async function exportPdf(mode: "preview" | "download") {
    setPdfBusy(mode);
    try {
      const doc = (
        <CostsReportPdf
          rows={filteredTickets}
          summary={summary}
          period={`${dateFrom} - ${dateTo}`}
          byClient={byClient.slice(0, 8)}
          byTechnician={byTechnician.slice(0, 8)}
        />
      );
      if (mode === "preview") await previewPdf(doc);
      else
        await downloadPdf(
          doc,
          buildDownloadFileName("pcready-report-costi", "pdf", { dated: true }),
        );
    } catch (error) {
      toast.error(errorMessage(error, "Errore export PDF costi"));
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">Gestione costi</div>
            <div className="mt-1 text-sm text-text3">
              Ticket, manodopera, materiali, contratti e report fatturazione
            </div>
          </div>
          <TrendingUp className="h-5 w-5 text-text3" />
        </div>
        <div className="pc-card-body">
          <div className="grid gap-2 md:grid-cols-[150px_150px_1fr_1fr_auto_auto_auto]">
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
              <option value="all">Tutti i clienti</option>
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
              <option value="all">Tutti i tecnici</option>
              {technicians.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => exportPdf("preview")}
              disabled={!!pdfBusy}
            >
              <Eye className="h-3 w-3" /> PDF
            </button>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => exportPdf("download")}
              disabled={!!pdfBusy}
            >
              <FileText className="h-3 w-3" /> Scarica
            </button>
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={exportCsv}>
              <Download className="h-3 w-3" /> CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <CostStat label="Totale ticket" value={formatCurrency(summary.ticketTotal)} />
        <CostStat label="Manodopera" value={formatCurrency(summary.labor)} />
        <CostStat label="Materiali" value={formatCurrency(summary.materials)} />
        <CostStat label="Ore fatturabili" value={formatHours(summary.hours)} />
        <CostStat label="Canoni attivi" value={formatCurrency(summary.recurring)} />
        <CostStat
          label="Margine stimato"
          value={formatCurrency(summary.estimatedRevenue - summary.materials)}
          tone="success"
        />
      </div>

      {canManageCosts && (
        <div className="pc-card">
          <div className="pc-card-hd">
            <div className="pc-card-title">Contratti / SLA cliente</div>
            <button
              className="pc-btn pc-btn-primary pc-btn-sm"
              onClick={saveContract}
              disabled={busy || !canEdit}
            >
              <Save className="h-3 w-3" /> Salva contratto
            </button>
          </div>
          <div className="pc-card-body grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            <select
              className="pc-input xl:col-span-2"
              value={draft.client_id}
              onChange={(e) => setDraft((v) => ({ ...v, client_id: e.target.value }))}
            >
              <option value="">Cliente...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.name}
                </option>
              ))}
            </select>
            <input
              className="pc-input xl:col-span-2"
              value={draft.name}
              onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
              placeholder="Nome contratto"
            />
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
              <option value="monthly">Mensile</option>
              <option value="annual">Annuale</option>
            </select>
            <input
              className="pc-input"
              type="number"
              min="0"
              step="0.01"
              value={draft.recurring_fee}
              onChange={(e) => setDraft((v) => ({ ...v, recurring_fee: e.target.value }))}
              placeholder="Canone"
            />
            <input
              className="pc-input"
              type="number"
              min="0"
              step="0.25"
              value={draft.included_hours}
              onChange={(e) => setDraft((v) => ({ ...v, included_hours: e.target.value }))}
              placeholder="Ore incluse"
            />
            <input
              className="pc-input"
              type="number"
              min="0"
              step="0.01"
              value={draft.extra_hourly_rate}
              onChange={(e) => setDraft((v) => ({ ...v, extra_hourly_rate: e.target.value }))}
              placeholder="Tariffa extra"
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryTable title="Costi per cliente" rows={byClient} />
        <SummaryTable title="Costi per tecnico" rows={byTechnician} />
      </div>

      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">Dettaglio ticket fatturabili</div>
            <div className="mt-1 text-sm text-text3">
              {filteredTickets.length} ticket nel periodo
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                {[
                  "Ticket",
                  "Cliente",
                  "Tecnico",
                  "Ore",
                  "Tariffa",
                  "Manodopera",
                  "Materiali",
                  "Totale",
                ].map((header) => (
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
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-text3" colSpan={8}>
                    Caricamento costi...
                  </td>
                </tr>
              ) : filteredTickets.length ? (
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
              ) : (
                <tr>
                  <td className="px-3 py-8 text-center text-text3" colSpan={8}>
                    Nessun costo nel periodo selezionato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div className="pc-card-title">Contratti attivi e ore extra</div>
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
                        : "Cliente"}
                    </div>
                  </div>
                  <span className="rounded-full bg-surface2 px-2 py-1 text-[11px] font-bold text-text2">
                    {contract.billing_period === "monthly" ? "Mensile" : "Annuale"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <ContractMetric label="Canone" value={formatCurrency(contract.recurring_fee)} />
                  <ContractMetric
                    label="Ore incluse"
                    value={formatHours(contract.included_hours)}
                  />
                  <ContractMetric label="Ore usate" value={formatHours(usedHours)} />
                  <ContractMetric
                    label="Extra stimato"
                    value={formatCurrency(extraHours * money(contract.extra_hourly_rate))}
                  />
                </div>
              </div>
            );
          })}
          {!filteredContracts.length && (
            <div className="text-sm text-text3">Nessun contratto configurato.</div>
          )}
        </div>
      </div>
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

function SummaryTable({ title, rows }: { title: string; rows: CostGroup[] }) {
  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd">
        <div className="pc-card-title">{title}</div>
      </div>
      <table className="w-full text-[12.5px]">
        <thead style={{ background: "var(--surface2)" }}>
          <tr>
            <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
              Nome
            </th>
            <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
              Ore
            </th>
            <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
              Totale
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr key={row.name} className="border-t" style={{ borderColor: "var(--border)" }}>
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
                Nessun dato
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

function groupCosts(rows: TicketCostRow[], key: "client_name" | "technician_name"): CostGroup[] {
  const map = new Map<string, CostGroup>();
  rows.forEach((row) => {
    const name = row[key] || (key === "technician_name" ? "Non assegnato" : "Cliente non indicato");
    const current = map.get(name) ?? { name, hours: 0, total: 0, materials: 0, labor: 0 };
    current.hours += money(row.billable_hours);
    current.total += money(row.total_cost);
    current.materials += money(row.material_cost);
    current.labor += money(row.labor_cost);
    map.set(name, current);
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function CostsReportPdf({
  rows,
  summary,
  period,
  byClient,
  byTechnician,
}: {
  rows: TicketCostRow[];
  summary: {
    ticketTotal: number;
    labor: number;
    materials: number;
    hours: number;
    recurring: number;
    estimatedRevenue: number;
  };
  period: string;
  byClient: CostGroup[];
  byTechnician: CostGroup[];
}) {
  const ticketColumns: PdfColumn<TicketCostRow>[] = [
    { key: "ticket", label: "Ticket", width: "14%", value: (row) => row.ticket_code },
    { key: "client", label: "Cliente", width: "28%", value: (row) => row.client_name ?? "-" },
    { key: "tech", label: "Tecnico", width: "20%", value: (row) => row.technician_name ?? "-" },
    {
      key: "hours",
      label: "Ore",
      width: "10%",
      mono: true,
      value: (row) => formatHours(money(row.billable_hours)),
    },
    {
      key: "materials",
      label: "Materiali",
      width: "14%",
      mono: true,
      value: (row) => formatCurrency(row.material_cost),
    },
    {
      key: "total",
      label: "Totale",
      width: "14%",
      mono: true,
      value: (row) => formatCurrency(row.total_cost),
    },
  ];
  const groupColumns: PdfColumn<CostGroup>[] = [
    { key: "name", label: "Nome", width: "55%", value: (row) => row.name },
    {
      key: "hours",
      label: "Ore",
      width: "20%",
      mono: true,
      value: (row) => formatHours(row.hours),
    },
    {
      key: "total",
      label: "Totale",
      width: "25%",
      mono: true,
      value: (row) => formatCurrency(row.total),
    },
  ];

  return (
    <Document author="PCReady" title="Report costi">
      <BrandedPage title="Report costi" meta={period}>
        <StatStrip
          stats={[
            {
              label: "Totale ticket",
              value: formatCurrency(summary.ticketTotal),
              color: pdfPalette.accent,
            },
            { label: "Manodopera", value: formatCurrency(summary.labor), color: pdfPalette.info },
            {
              label: "Materiali",
              value: formatCurrency(summary.materials),
              color: pdfPalette.warn,
            },
            {
              label: "Margine stimato",
              value: formatCurrency(summary.estimatedRevenue - summary.materials),
              color: pdfPalette.success,
            },
          ]}
        />
        <PdfSection title="Costi per cliente" meta={`${byClient.length} clienti`}>
          <PdfTable rows={byClient} columns={groupColumns} />
        </PdfSection>
        <PdfSection title="Costi per tecnico" meta={`${byTechnician.length} tecnici`}>
          <PdfTable rows={byTechnician} columns={groupColumns} />
        </PdfSection>
        <PdfSection title="Dettaglio ticket" meta={`${rows.length} ticket`}>
          <PdfTable rows={rows.slice(0, 40)} columns={ticketColumns} />
        </PdfSection>
      </BrandedPage>
    </Document>
  );
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
