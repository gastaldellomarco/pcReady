import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 *
 */
export function AutomationKpiCard({
  label,
  value,
  icon,
  color,
  trend,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  color?: "green" | "red" | "amber" | "blue" | "default";
  trend?: number;
}) {
  const valueCls =
    color === "green"
      ? "text-emerald-700"
      : color === "red"
        ? "text-red-700"
        : color === "amber"
          ? "text-amber-700"
          : color === "blue"
            ? "text-blue-700"
            : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface2 px-[18px] py-[14px]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-text3">{label}</div>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("text-xl font-extrabold", valueCls)}>{value}</span>
        {trend !== undefined && (
          <span
            className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-text3",
            )}
          >
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
      </div>
    </div>
  );
}
