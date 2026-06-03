/**
 *
 */
export function formatAvgDays(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 1) return `${Math.round(value * 24)} ore`;
  return `${value.toFixed(1)} giorni`;
}
