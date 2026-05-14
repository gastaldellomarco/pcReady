import type { DashboardAnalytics } from "@/lib/dashboard-analytics";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";

export function downloadAnalyticsCsv(analytics: DashboardAnalytics) {
  const rows = [
    ["Report mensile"],
    ["Mese", "Ticket aperti", "Ticket chiusi", "Tempo medio risoluzione giorni"],
    ...analytics.ticketsByMonth.map((row) => [
      row.label,
      row.opened,
      row.closed,
      row.avg_days ?? "",
    ]),
    [],
    ["Performance tecnici"],
    ["Tecnico", "Ticket assegnati", "Ticket completati", "Tempo medio risoluzione giorni"],
    ...analytics.technicianKpi.map((row) => [
      row.full_name,
      row.assigned,
      row.completed,
      row.avg_days ?? "",
    ]),
  ];
  downloadCsv(rows, buildDownloadFileName("pcready-dashboard-report", "csv", { dated: true }));
}

export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 5);
  from.setDate(1);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfDayIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function endOfDayIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

export function formatPeriodLabel(from: string, to: string) {
  const fmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt.format(new Date(from))} - ${fmt.format(new Date(to))}`;
}

export function computeDailyCounts<T extends { created_at: string }>(
  items: T[],
  dateKey: keyof T & string,
  days = 14,
  filter?: (it: T) => boolean,
) {
  const res = new Array(days).fill(0);
  const now = new Date();
  for (const it of items) {
    if (filter && !filter(it)) continue;
    const raw = it[dateKey];
    const d = new Date(typeof raw === "string" ? raw : String(raw));
    if (isNaN(d.getTime())) continue;
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff >= 0 && diff < days) {
      res[days - 1 - diff] += 1;
    }
  }
  return res;
}
