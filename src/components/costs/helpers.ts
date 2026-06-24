import type { TicketCostRow } from "./types";

export function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    money(value),
  );
}

export function formatHours(value: unknown) {
  return `${money(value).toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
}

export function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function numberFromDraft(value: string) {
  return Math.max(0, money(value));
}

export function buildNextInvoiceNumber(invoices: Array<{ invoice_number?: string | null }>) {
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

type CostGroup = { name: string; hours: number; total: number; materials: number; labor: number };

export function groupCosts(
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

export function getPeriodPresets(
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
