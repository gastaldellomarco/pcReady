import i18n from "@/i18n";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";
import type { DashboardAnalytics } from "@/lib/dashboard-analytics";

/**
 *
 */
export function downloadAnalyticsCsv(analytics: DashboardAnalytics) {
  const rows = [
    [i18n.t("dashboard:help.monthlyReport", "Report mensile")],
    [
      i18n.t("dashboard:help.month", "Mese"),
      i18n.t("dashboard:help.openedTickets", "Ticket aperti"),
      i18n.t("dashboard:help.closedTickets", "Ticket chiusi"),
      i18n.t("dashboard:help.avgResolutionDays", "Tempo medio risoluzione giorni"),
    ],
    ...analytics.ticketsByMonth.map((row) => [
      row.label,
      row.opened,
      row.closed,
      row.avg_days ?? "",
    ]),
    [],
    [i18n.t("dashboard:help.technicianPerformance", "Performance tecnici")],
    [
      i18n.t("dashboard:help.technician", "Tecnico"),
      i18n.t("dashboard:help.assignedTickets", "Ticket assegnati"),
      i18n.t("dashboard:help.completedTickets", "Ticket completati"),
      i18n.t("dashboard:help.avgResolutionDays", "Tempo medio risoluzione giorni"),
    ],
    ...analytics.technicianKpi.map((row) => [
      row.full_name,
      row.assigned,
      row.completed,
      row.avg_days ?? "",
    ]),
  ];
  downloadCsv(rows, buildDownloadFileName("pcready-dashboard-report", "csv", { dated: true }));
}

/**
 *
 */
export function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 5);
  from.setDate(1);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

/**
 *
 */
export function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 *
 */
export function startOfDayIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

/**
 *
 */
export function endOfDayIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

/**
 *
 */
export function formatPeriodLabel(from: string, to: string) {
  const fmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  return `${fmt.format(new Date(from))} - ${fmt.format(new Date(to))}`;
}

/**
 *
 */
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

interface DailyLabelOptions {
  /** BCP-47 locale tag. Defaults to the active i18n language. */
  locale?: string;
  /** Overrides for the localised "today" / "yesterday" strings. */
  todayText?: string;
  yesterdayText?: string;
}

/**
 * Map a BCP-47 language code (e.g. "it", "en", "en-US") to a locale suitable
 * for `Date.toLocaleDateString`. Falls back to the original language so the
 * output remains predictable.
 */
function languageToLocale(lang: string | undefined = i18n.language) {
  if (!lang) return "it-IT";
  const map: Record<string, string> = {
    it: "it-IT",
    en: "en-US",
    es: "es-ES",
    de: "de-DE",
    fr: "fr-FR",
  };
  return map[lang.toLowerCase().split(/[-_]/)[0]] ?? lang;
}

/**
 * Returns the matching per-day labels (oldest -> newest) for a spark chart
 * fed by `computeDailyCounts`. The last two entries are the localised
 * "yesterday" / "today" strings (default Italian) so hovered tooltips show a
 * meaningful date even when the host language is not Italian. Pass `locale`
 * to override the active i18n language.
 */
export function computeDailyLabels(
  days = 14,
  options: DailyLabelOptions = {},
) {
  const activeLocale = languageToLocale(i18n.language);
  const {
    locale = activeLocale,
    todayText = "Oggi",
    yesterdayText = "Ieri",
  } = options;
  const res: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (i === 0) {
      res.push(todayText);
    } else if (i === 1) {
      res.push(yesterdayText);
    } else {
      res.push(d.toLocaleDateString(locale, { day: "2-digit", month: "short" }));
    }
  }
  return res;
}
