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

// ── Shared utility helpers ──────────────────────────────────────────────────

/**
 * Trims a string and returns `null` if the result is empty.
 */
export function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Basic email format validation.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Extracts the first name from a full name string.
 */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * Extracts the last name (everything after the first word) from a full name.
 * Returns an empty string if there is only one word.
 */
export function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

/**
 * Returns the display label for a contact, falling back to first + last name
 * if `full_name` is not available.
 */
export function contactLabel(contact: {
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return contact.full_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

/**
 * Formats a file size in bytes into a human-readable string.
 * Returns `"-"` for falsy values, `"File"` for 0, or a scaled label (B/KB/MB/GB).
 */
export function formatFileSize(value: number | null | undefined): string {
  if (value == null || value === 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Formats a date string into the Italian locale format (medium date + short time).
 * Returns `"-"` for null/undefined/invalid values.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("it-IT", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

/**
 * Formats a numeric value as EUR currency, allowing negative values.
 * Uses `Intl.NumberFormat` with `it-IT` locale.
 *
 * @param value - Raw value to format (string, number, null, or undefined)
 * @returns Formatted currency string (e.g. `"€\xa012,50"`), or `"€\xa00,00"` if invalid
 *
 * @see formatMoney for a version that clamps to non-negative values
 */
export function formatCurrency(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "€ 0,00";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

/**
 * Formats hours as a string with one decimal place and an "h" suffix.
 *
 * @param value - Hours value (number, string, null, or undefined)
 * @returns Formatted hours string (e.g. `"12.5h"`), or `"0h"` if null/undefined/invalid
 */
export function formatHours(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0h";
  return `${n.toFixed(1)}h`;
}
