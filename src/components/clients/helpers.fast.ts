/**
 * Helper moved out of component file to keep Fast Refresh safe.
 */
export function formatHours(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(v)) return "-";
  if (v < 1) return `${Math.round(v * 60)}m`;
  if (v === 1) return "1h";
  return `${Math.round(v)}h`;
}
