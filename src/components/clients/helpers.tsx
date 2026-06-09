// `formatHours` moved to helpers.fast and is imported where needed.

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
