/**
 * Format hours into a human-readable string.
 */
export function formatHours(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  const v = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(v)) return "-";
  if (v < 1) return `${Math.round(v * 60)}m`;
  if (v === 1) return "1h";
  return `${Math.round(v)}h`;
}

/**
 * Small stat box with label and value.
 */
export function SummaryBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-md border px-3 py-2 text-center"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="font-mono text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase text-text3">{label}</div>
    </div>
  );
}
