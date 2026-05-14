import type { ReactNode } from "react";

export function AutomationKpiCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
