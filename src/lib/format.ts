/**
 * Parses a potentially-nullish value into a non-negative number.
 *
 * @param value - Raw value (string, number, null, or undefined)
 * @returns Parsed number, or `0` if the input is invalid
 */
export function parseCostNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

/**
 * Formats a monetary value as an Italian EUR currency string.
 *
 * @param value - Raw monetary value
 * @returns Formatted currency string (e.g. `"12,50\xa0€"`)
 *
 * @example
 * formatMoney(12.5)  // → "12,50\xa0€"
 * formatMoney(null)  // → "0,00\xa0€"
 */
export function formatMoney(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    parseCostNumber(value),
  );
}

/**
 * Converts an ISO timestamp into a compact relative time label.
 *
 * @param value - ISO 8601 date string
 * @returns Compact label like `"5m"`, `"3h"`, `"12g"`, `"2M"`, or `"-"` if invalid
 *
 * @example
 * formatRelativeTime("2025-05-28T08:00:00Z")  // → "2h"
 */
export function formatRelativeTime(value: string): string {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "-";
  const diffMs = Date.now() - created;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g`;
  const months = Math.floor(days / 30);
  return `${months}M`;
}
