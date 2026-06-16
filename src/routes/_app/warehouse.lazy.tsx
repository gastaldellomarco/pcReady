import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  Save,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Modal } from "@/components/pcready/Modal";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { openTicketDetail } from "@/lib/detail-navigation";
import { errorMessage } from "@/lib/errors";
import { formatCurrency, parseCostNumber } from "@/lib/format";

export const Route = createLazyFileRoute("/_app/warehouse")({
  component: WarehousePage,
});

// ── Types ──

interface MaterialRow {
  id: string;
  ticket_id: string;
  description: string;
  supplier: string | null;
  sku: string | null;
  quantity: number;
  unit_cost: number;
  resale_margin_percent: number;
  unit_price: number;
  total_cost: number;
  total_price: number;
  created_at: string;
  tickets?: {
    ticket_code: string;
    client_id: string;
    status: string;
  } | null;
}

interface MaterialDraft {
  ticketId: string;
  description: string;
  supplier: string;
  sku: string;
  quantity: string;
  unitCost: string;
  resaleMarginPercent: string;
}

interface TicketOption {
  id: string;
  ticket_code: string;
  client: string;
  status: string;
  clients?: {
    id: string;
    name: string;
    company_name: string | null;
  } | null;
}

function ticketClientName(ticket: TicketOption): string {
  return ticket.clients?.company_name || ticket.clients?.name || ticket.client;
}

const emptyMaterialDraft: MaterialDraft = {
  ticketId: "",
  description: "",
  supplier: "",
  sku: "",
  quantity: "1",
  unitCost: "0",
  resaleMarginPercent: "30",
};

// ── Page ──

function WarehousePage() {
  const { t } = useTranslation("warehouse");
  const { canEdit, profile } = useAuth();
  const canManage = profile?.role === "admin" || profile?.role === "tech";
  const qc = useQueryClient();

  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [tickets, setTickets] = useState<TicketOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formExpanded, setFormExpanded] = useState(true);
  const [draft, setDraft] = useState<MaterialDraft>(emptyMaterialDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState<MaterialRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"month" | "supplier">("month");
  const [monthRange, setMonthRange] = useState<6 | 12>(12);

  // ── Derived ──

  const materialQuantity = parseCostNumber(draft.quantity) || 1;
  const materialUnitCost = parseCostNumber(draft.unitCost);
  const materialMargin = parseCostNumber(draft.resaleMarginPercent);
  const previewUnitPrice = materialUnitCost * (1 + materialMargin / 100);
  const previewTotalPrice = previewUnitPrice * materialQuantity;

  const suppliers = useMemo(
    () =>
      Array.from(new Set(materials.map((m) => m.supplier).filter(Boolean))) as string[],
    [materials],
  );

  const filteredMaterials = useMemo(
    () =>
      supplierFilter
        ? materials.filter((m) => m.supplier === supplierFilter)
        : materials,
    [materials, supplierFilter],
  );

  const summary = useMemo(() => {
    const totalCost = filteredMaterials.reduce(
      (sum, m) => sum + parseCostNumber(m.total_cost),
      0,
    );
    const totalRevenue = filteredMaterials.reduce(
      (sum, m) => sum + parseCostNumber(m.total_price),
      0,
    );
    const margin = totalRevenue - totalCost;
    const marginPct = totalCost > 0 ? (margin / totalCost) * 100 : 0;
    return { totalCost, totalRevenue, margin, marginPct };
  }, [filteredMaterials]);

  const chartData = useMemo(() => {
    if (chartMode === "supplier") {
      const bySupplier = new Map<string, number>();
      materials.forEach((m) => {
        const key = m.supplier || t("chart.unknownSupplier", "Sconosciuto");
        bySupplier.set(key, (bySupplier.get(key) ?? 0) + parseCostNumber(m.total_cost));
      });
      return Array.from(bySupplier.entries())
        .map(([label, cost]) => ({ label, cost: Math.round(cost) }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
    }
    // If there are no materials at all, return empty so the "no data"
    // empty-state message is shown instead of 12 zero-height bars.
    if (materials.length === 0) return [];

    const byMonth = new Map<string, number>();
    materials.forEach((m) => {
      const month = m.created_at.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + parseCostNumber(m.total_cost));
    });

    // Generate last N months (including current) to ensure the chart always
    // shows a full time axis even when some months have no spending.
    const now = new Date();
    const months: string[] = [];
    for (let i = monthRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(label);
    }

    return months.map((label) => ({
      label,
      cost: Math.round(byMonth.get(label) ?? 0),
    }));
  }, [materials, chartMode, monthRange]);

  // ── Data loading ──

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [materialsResult, ticketsResult] = await Promise.all([
        (supabase as any)
          .from("ticket_material_items")
          .select(
            "id, ticket_id, description, supplier, sku, quantity, unit_cost, resale_margin_percent, unit_price, total_cost, total_price, created_at, tickets(ticket_code, client_id, status)",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase as any)
          .from("tickets")
          .select("id, ticket_code, client, status, clients(id, name, company_name)")
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (materialsResult.error) throw materialsResult.error;
      if (ticketsResult.error) throw ticketsResult.error;
      setMaterials((materialsResult.data ?? []) as MaterialRow[]);
      setTickets((ticketsResult.data ?? []) as TicketOption[]);
    } catch (error) {
      toast.error(
        errorMessage(error, t("feedback.loadError", "Errore caricamento materiali")),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Actions ──

  function resetForm() {
    setDraft(emptyMaterialDraft);
    setEditingId(null);
    setFormExpanded(false);
  }

  function startEdit(material: MaterialRow) {
    setDraft({
      ticketId: material.ticket_id,
      description: material.description,
      supplier: material.supplier ?? "",
      sku: material.sku ?? "",
      quantity: String(material.quantity),
      unitCost: String(material.unit_cost),
      resaleMarginPercent: String(material.resale_margin_percent),
    });
    setEditingId(material.id);
    setFormExpanded(true);
  }

  async function saveMaterial() {
    if (!canManage || !canEdit) {
      return toast.error(t("feedback.insufficientPermissions", "Permessi insufficienti"));
    }
    if (!draft.ticketId) {
      return toast.error(t("validation.ticketRequired", "Seleziona un ticket"));
    }
    if (!draft.description.trim()) {
      return toast.error(t("validation.descriptionRequired", "Inserisci una descrizione"));
    }
    const quantity = parseCostNumber(draft.quantity);
    const unitCost = parseCostNumber(draft.unitCost);
    const margin = parseCostNumber(draft.resaleMarginPercent);
    if (quantity <= 0) {
      return toast.error(t("validation.quantityInvalid", "La quantità deve essere > 0"));
    }
    if (unitCost < 0) {
      return toast.error(t("validation.costInvalid", "Il costo deve essere ≥ 0"));
    }

    setBusy(true);
    try {
      const payload = {
        ticket_id: draft.ticketId,
        description: draft.description.trim(),
        supplier: draft.supplier.trim() || null,
        sku: draft.sku.trim() || null,
        quantity,
        unit_cost: unitCost,
        resale_margin_percent: margin,
      };

      if (editingId) {
        const { error } = await (supabase as any)
          .from("ticket_material_items")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success(t("feedback.materialUpdated", "Materiale aggiornato"));
      } else {
        const { error } = await (supabase as any)
          .from("ticket_material_items")
          .insert(payload);
        if (error) throw error;
        toast.success(t("feedback.materialSaved", "Materiale salvato"));
      }
      resetForm();
      await loadData();
      qc.invalidateQueries({ queryKey: ["tickets", draft.ticketId, "material-items"] });
    } catch (error) {
      toast.error(
        errorMessage(error, t("feedback.saveError", "Errore salvataggio materiale")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteMaterial(id: string) {
    if (!canManage || !canEdit) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any)
        .from("ticket_material_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setDeleteConfirm(null);
      await loadData();
      toast.success(t("feedback.materialDeleted", "Materiale eliminato"));
    } catch (error) {
      toast.error(
        errorMessage(error, t("feedback.deleteError", "Errore eliminazione materiale")),
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Ticket search ──

  const filteredTickets = useMemo(() => {
    if (!ticketSearch.trim()) return tickets.slice(0, 50);
    const q = ticketSearch.toLowerCase();
    return tickets
      .filter(
        (ticket) =>
          ticket.ticket_code.toLowerCase().includes(q) ||
          ticketClientName(ticket).toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [tickets, ticketSearch]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === draft.ticketId) ?? null,
    [tickets, draft.ticketId],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header card ── */}
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">
              {t("title", "Magazzino / Ricambi")}
            </div>
            <div className="mt-1 text-sm text-text3">
              {t(
                "subtitle",
                "Gestione materiali e ricambi con calcolo prezzi in tempo reale",
              )}
            </div>
          </div>
          <Package className="size-5 text-text3" />
        </div>
        <div className="pc-card-body">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <StatBox
              label={t("stats.totalCost", "Costo totale")}
              value={formatCurrency(summary.totalCost)}
              tone="neutral"
            />
            <StatBox
              label={t("stats.totalRevenue", "Ricavo stimato")}
              value={formatCurrency(summary.totalRevenue)}
              tone="neutral"
            />
            <StatBox
              label={t("stats.margin", "Margine")}
              value={formatCurrency(summary.margin)}
              tone={summary.margin >= 0 ? "success" : "danger"}
              subtitle={summary.totalCost > 0 ? `${summary.marginPct.toFixed(0)}%` : undefined}
            />
            <StatBox
              label={t("stats.items", "Materiali")}
              value={String(filteredMaterials.length)}
              tone="neutral"
            />
          </div>
        </div>
      </div>

      {/* ── Add / Edit form card ── */}
      <div className="pc-card">
        <button
          type="button"
          className="pc-card-hd w-full cursor-pointer"
          onClick={() => {
            if (formExpanded) resetForm();
            else setFormExpanded(true);
          }}
        >
          <div className="flex items-center gap-2">
            {formExpanded ? (
              <ChevronUp className="size-4 text-text3" />
            ) : (
              <ChevronDown className="size-4 text-text3" />
            )}
            <div className="pc-card-title">
              {editingId
                ? t("form.editTitle", "Modifica materiale")
                : t("form.addTitle", "Aggiungi materiale / ricambio")}
            </div>
          </div>
          {!formExpanded && (
            <Plus className="size-5 text-text3" />
          )}
        </button>
        {formExpanded && (
          <div className="pc-card-body">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              {/* Ticket selector */}
              <label className="space-y-1 text-sm font-medium text-text2 col-span-4 sm:col-span-2 md:col-span-2">
                {t("form.ticketLabel", "Ticket")}
                <div className="relative">
                  <input
                    className="pc-input w-full"
                    value={
                      ticketSearch || selectedTicket
                        ? selectedTicket
                          ? `${selectedTicket.ticket_code} - ${ticketClientName(selectedTicket)}`
                          : ticketSearch
                        : ""
                    }
                    onChange={(e) => {
                      setTicketSearch(e.target.value);
                      if (!e.target.value) {
                        setDraft((d) => ({ ...d, ticketId: "" }));
                      }
                    }}
                    placeholder={t("form.ticketPlaceholder", "Cerca ticket per codice o cliente...")}
                    disabled={!canManage || !canEdit}
                  />
                  {ticketSearch && filteredTickets.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background shadow-lg">
                      {filteredTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-surface2"
                          onClick={() => {
                            setDraft((d) => ({ ...d, ticketId: ticket.id }));
                            setTicketSearch("");
                          }}
                        >
                          <span className="font-mono font-semibold text-accent">
                            {ticket.ticket_code}
                          </span>
                          <span className="text-text2">
                            {ticketClientName(ticket)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* Supplier */}
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("form.supplierLabel", "Fornitore")}
                <input
                  className="pc-input"
                  value={draft.supplier}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, supplier: e.target.value }))
                  }
                  placeholder={t("form.supplierPlaceholder", "es. Amazon, MediaWorld...")}
                  disabled={!canManage || !canEdit}
                />
              </label>

              {/* SKU */}
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("form.skuLabel", "SKU / Codice")}
                <input
                  className="pc-input"
                  value={draft.sku}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, sku: e.target.value }))
                  }
                  placeholder={t("form.skuPlaceholder", "es. WD40EZAX")}
                  disabled={!canManage || !canEdit}
                />
              </label>

              {/* Description */}
              <label className="space-y-1 text-sm font-medium text-text2 col-span-4 sm:col-span-2 md:col-span-2">
                {t("form.descriptionLabel", "Descrizione")}
                <input
                  className="pc-input"
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder={t("form.descriptionPlaceholder", "es. SSD NVMe 1TB...")}
                  disabled={!canManage || !canEdit}
                />
              </label>

              {/* Quantity */}
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("form.quantityLabel", "Quantità")}
                <input
                  className="pc-input"
                  type="number"
                  min="1"
                  step="1"
                  value={draft.quantity}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, quantity: e.target.value }))
                  }
                  disabled={!canManage || !canEdit}
                />
              </label>

              {/* Unit cost */}
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("form.unitCostLabel", "Costo unitario (€)")}
                <input
                  className="pc-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.unitCost}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, unitCost: e.target.value }))
                  }
                  disabled={!canManage || !canEdit}
                />
              </label>

              {/* Resale margin */}
              <label className="space-y-1 text-sm font-medium text-text2">
                {t("form.marginLabel", "Ricarico (%)")}
                <input
                  className="pc-input"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.resaleMarginPercent}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      resaleMarginPercent: e.target.value,
                    }))
                  }
                  disabled={!canManage || !canEdit}
                />
              </label>

              {/* Live price preview */}
              <div className="rounded-lg bg-surface2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
                  {t("form.previewLabel", "Anteprima prezzo finale")}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-text3">
                      {t("form.unitPrice", "Prezzo unitario")}
                    </div>
                    <div className="font-mono text-sm font-bold text-success">
                      {formatCurrency(previewUnitPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-text3">
                      {t("form.totalPrice", "Prezzo totale")}
                    </div>
                    <div className="font-mono text-lg font-bold">
                      {formatCurrency(previewTotalPrice)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex items-center gap-2">
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={saveMaterial}
                disabled={busy || !canManage || !canEdit || !draft.ticketId}
              >
                <Save className="size-3" />{" "}
                {editingId
                  ? t("form.updateBtn", "Aggiorna materiale")
                  : t("form.saveBtn", "Salva materiale")}
              </button>
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={resetForm}
                disabled={busy}
              >
                {t("form.cancelBtn", "Annulla")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Chart card ── */}
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">
              {t("chart.title", "Andamento spesa materiali")}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`pc-btn pc-btn-xs ${chartMode === "month" ? "pc-btn-primary" : "pc-btn-ghost"}`}
              onClick={() => setChartMode("month")}
            >
              {t("chart.byMonth", "Per mese")}
            </button>
            <button
              type="button"
              className={`pc-btn pc-btn-xs ${chartMode === "supplier" ? "pc-btn-primary" : "pc-btn-ghost"}`}
              onClick={() => setChartMode("supplier")}
            >
              {t("chart.bySupplier", "Per fornitore")}
            </button>
            {chartMode === "month" && (
              <>
                <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} />
                <button
                  type="button"
                  className={`pc-btn pc-btn-xs ${monthRange === 6 ? "pc-btn-primary" : "pc-btn-ghost"}`}
                  onClick={() => setMonthRange(6)}
                >
                  {t("chart.months6", "6M")}
                </button>
                <button
                  type="button"
                  className={`pc-btn pc-btn-xs ${monthRange === 12 ? "pc-btn-primary" : "pc-btn-ghost"}`}
                  onClick={() => setMonthRange(12)}
                >
                  {t("chart.months12", "12M")}
                </button>
              </>
            )}
            <TrendingUp className="size-5 text-text3 ml-2" />
          </div>
        </div>
        <div className="pc-card-body">
          {loading ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-text3">
              {t("table.loading", "Caricamento...")}
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-text3">
              {t("chart.empty", "Nessun dato disponibile")}
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--text3)", fontSize: 11 }}
                    interval={0}
                    angle={chartMode === "supplier" ? -18 : -12}
                    textAnchor="end"
                    height={54}
                  />
                  <YAxis
                    tick={{ fill: "var(--text3)", fontSize: 11 }}
                    tickFormatter={(value) => `${value}€`}
                    domain={[0, (dataMax: number) => Math.max(Math.ceil(dataMax * 1.25), 10)]}
                  />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(value), t("chart.cost", "Costo")]}
                    contentStyle={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="cost" fill="var(--accent)" name={t("chart.cost", "Costo")} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Materials table ── */}
      <div className="pc-card overflow-hidden">
        <div className="pc-card-hd">
          <div>
            <div className="pc-card-title">
              {t("table.title", "Materiali registrati")}
            </div>
            <div className="mt-1 text-sm text-text3">
              {t("table.count", { count: filteredMaterials.length })}
            </div>
          </div>
          {suppliers.length > 0 && (
            <select
              className="pc-input w-auto"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              aria-label={t("table.supplierFilterLabel", "Filtra per fornitore")}
            >
              <option value="">
                {t("table.allSuppliers", "Tutti i fornitori")}
              </option>
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-text3">
            {t("table.loading", "Caricamento materiali...")}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Package className="mx-auto h-10 w-10 text-text3 opacity-40" />
            <p className="mt-3 text-sm text-text3">
              {t("table.empty", "Nessun materiale registrato.")}
            </p>
            {canManage && (
              <button
                className="pc-btn pc-btn-primary pc-btn-sm mt-3"
                onClick={() => setFormExpanded(true)}
              >
                <Plus className="size-3" />{" "}
                {t("table.addFirst", "Aggiungi primo materiale")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12.5px]">
              <thead style={{ background: "var(--surface2)" }}>
                <tr>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.description", "Descrizione")}
                  </th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.supplier", "Fornitore")}
                  </th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.sku", "SKU")}
                  </th>
                  <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.quantity", "Qtà")}
                  </th>
                  <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.unitCost", "Costo unit.")}
                  </th>
                  <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.margin", "Ricarico")}
                  </th>
                  <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.unitPrice", "Prezzo unit.")}
                  </th>
                  <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.totalPrice", "Prezzo tot.")}
                  </th>
                  <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                    {t("table.headers.ticket", "Ticket")}
                  </th>
                  <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3 whitespace-nowrap">
                    {t("table.headers.actions", "Azioni")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.map((material) => (
                  <tr
                    key={material.id}
                    className="border-t hover:bg-surface2 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-3 py-2 max-w-[200px] truncate font-medium" title={material.description}>
                      {material.description}
                    </td>
                    <td className="px-3 py-2 text-text2">
                      {material.supplier || "-"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-text3">
                      {material.sku ? (
                        <button
                          type="button"
                          className="group inline-flex items-center gap-1 hover:text-accent transition-colors cursor-pointer"
                          title={t("table.copySku", "Copia SKU")}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(material.sku!).then(() => {
                              toast.success(t("table.skuCopied", "SKU copiato!"));
                            }).catch(() => {
                              toast.error(t("table.skuCopyError", "Copia non riuscita"));
                            });
                          }}
                        >
                          <span>{material.sku}</span>
                          <Copy className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {material.quantity}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(material.unit_cost)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {material.resale_margin_percent}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(material.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {formatCurrency(material.total_price)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      <button
                        className="text-accent hover:underline"
                        onClick={() => openTicketDetail(material.ticket_id)}
                      >
                        {material.tickets?.ticket_code ?? material.ticket_id.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-xs"
                          onClick={() => setDetailOpen(material)}
                          title={t("table.viewDetails", "Dettagli")}
                        >
                          <Eye className="size-3" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              className="pc-btn pc-btn-ghost pc-btn-xs"
                              onClick={() => startEdit(material)}
                              title={t("table.edit", "Modifica")}
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              className="pc-btn pc-btn-ghost pc-btn-xs text-destructive"
                              onClick={() => setDeleteConfirm(material.id)}
                              title={t("table.delete", "Elimina")}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detailOpen && (
        <MaterialDetailModal
          material={detailOpen}
          onClose={() => setDetailOpen(null)}
        />
      )}

      {/* ── Delete confirmation ── */}
      <DestructiveConfirmDialog
        open={!!deleteConfirm}
        title={t("table.confirmDelete", "Eliminare questo materiale?")}
        description={t("table.confirmDeleteDescription", "L'azione non può essere annullata.")}
        confirmLabel={t("table.delete", "Elimina")}
        loadingLabel={t("table.deleting", "Eliminazione...")}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        onConfirm={() => { if (deleteConfirm) void deleteMaterial(deleteConfirm); }}
      />
    </div>
  );
}

// ── Detail modal ──

function MaterialDetailModal({
  material,
  onClose,
}: {
  material: MaterialRow;
  onClose: () => void;
}) {
  const { t } = useTranslation("warehouse");
  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t("detail.title", "Dettaglio materiale")}
    >
      <div className="grid grid-cols-2 gap-3">
        <Info label={t("detail.description", "Descrizione")} value={material.description} />
        <Info label={t("detail.supplier", "Fornitore")} value={material.supplier ?? "-"} />
        <Info label={t("detail.sku", "SKU")} value={material.sku ?? "-"} />
        <Info label={t("detail.quantity", "Quantità")} value={String(material.quantity)} />
        <Info
          label={t("detail.unitCost", "Costo unitario")}
          value={formatCurrency(material.unit_cost)}
        />
        <Info
          label={t("detail.margin", "Ricarico")}
          value={`${material.resale_margin_percent}%`}
        />
        <Info
          label={t("detail.unitPrice", "Prezzo unitario")}
          value={formatCurrency(material.unit_price)}
        />
        <Info
          label={t("detail.totalCost", "Costo totale")}
          value={formatCurrency(material.total_cost)}
        />
        <Info
          label={t("detail.totalPrice", "Prezzo totale")}
          value={formatCurrency(material.total_price)}
          tone="success"
        />
        <Info
          label={t("detail.ticket", "Ticket")}
          value={material.tickets?.ticket_code ?? material.ticket_id.slice(0, 8)}
        />
        <Info
          label={t("detail.createdAt", "Data creazione")}
          value={new Date(material.created_at).toLocaleDateString("it-IT")}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          className="pc-btn pc-btn-ghost pc-btn-sm"
          onClick={() => {
            onClose();
            openTicketDetail(material.ticket_id);
          }}
        >
          <ExternalLink className="size-3" /> {t("detail.openTicket", "Apri ticket")}
        </button>
        <button className="pc-btn pc-btn-ghost" onClick={onClose}>
          {t("detail.close", "Chiudi")}
        </button>
      </div>
    </Modal>
  );
}

// ── Helper components ──

function Info({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div>
      <div className="pc-label">{label}</div>
      <div
        className="text-[13px] font-mono"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
  subtitle,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "danger";
  subtitle?: string;
}) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
        ? "var(--destructive)"
        : undefined;
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-lg font-bold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-[11px] text-text3">{subtitle}</div>
      )}
    </div>
  );
}
