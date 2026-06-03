import { useTranslation } from "react-i18next";
import { BUNDLE_PRIORITY_LABEL, BUNDLE_STATUS_LABEL, bundleUsageTone } from "@/lib/bundles";
import { cn } from "@/lib/utils";
import type { BundleStatus, BundleTicketPriority } from "@/lib/bundles";

const STATUS_COLORS: Record<BundleStatus, { color: string; background: string; border: string }> = {
  active: { color: "var(--success, #16a34a)", background: "rgba(22, 163, 74, 0.12)", border: "rgba(22, 163, 74, 0.35)" },
  renewed: { color: "var(--accent, #2563eb)", background: "rgba(37, 99, 235, 0.12)", border: "rgba(37, 99, 235, 0.35)" },
  pending: { color: "var(--warning, #d97706)", background: "rgba(217, 119, 6, 0.12)", border: "rgba(217, 119, 6, 0.35)" },
  expired: { color: "var(--text3, #64748b)", background: "rgba(100, 116, 139, 0.12)", border: "rgba(100, 116, 139, 0.35)" },
  cancelled: { color: "var(--danger, #dc2626)", background: "rgba(220, 38, 38, 0.12)", border: "rgba(220, 38, 38, 0.35)" },
};

const PRIORITY_COLORS: Record<BundleTicketPriority, { color: string; background: string; border: string }> = {
  low: { color: "var(--success, #16a34a)", background: "rgba(22, 163, 74, 0.12)", border: "rgba(22, 163, 74, 0.35)" },
  med: { color: "var(--accent, #2563eb)", background: "rgba(37, 99, 235, 0.12)", border: "rgba(37, 99, 235, 0.35)" },
  high: { color: "var(--warning, #d97706)", background: "rgba(217, 119, 6, 0.12)", border: "rgba(217, 119, 6, 0.35)" },
  critical: { color: "var(--danger, #dc2626)", background: "rgba(220, 38, 38, 0.12)", border: "rgba(220, 38, 38, 0.35)" },
};

const USAGE_COLORS: Record<ReturnType<typeof bundleUsageTone>, string> = {
  success: "var(--success, #16a34a)",
  warning: "var(--warning, #d97706)",
  danger: "var(--danger, #dc2626)",
};

function BundleBadge({ label, colors }: { label: string; colors: { color: string; background: string; border: string } }) {
  return (
    <span
      className="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: colors.color, background: colors.background, borderColor: colors.border }}
    >
      {label}
    </span>
  );
}

/**
 *
 */
export function BundleStatusBadge({ status }: { status: BundleStatus }) {
  return <BundleBadge label={BUNDLE_STATUS_LABEL[status] ?? status} colors={STATUS_COLORS[status]} />;
}

/**
 *
 */
export function BundlePriorityBadge({ priority }: { priority: BundleTicketPriority }) {
  return <BundleBadge label={BUNDLE_PRIORITY_LABEL[priority] ?? priority} colors={PRIORITY_COLORS[priority]} />;
}

/**
 *
 */
export function BundleUsageBar({ used, total, label }: { used: number | null | undefined; total: number | null | undefined; label?: string }) {
  const { t } = useTranslation("bundles");
  const usedValue = Number(used ?? 0);

  if (total == null) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-text2">{label ?? t("badge.usage", "Utilizzo")}</span>
          <span className="text-text3">{t("badge.unlimited", "Illimitato")}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface2">
          <div className="h-full w-full rounded-full opacity-40" style={{ background: "var(--success, #16a34a)" }} />
        </div>
      </div>
    );
  }

  const totalValue = Number(total);
  const rawPercent = totalValue > 0 ? (usedValue / totalValue) * 100 : 0;
  const percent = Math.max(0, Math.min(100, rawPercent));
  const tone = bundleUsageTone(rawPercent);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-text2">{label ?? t("badge.usage", "Utilizzo")}</span>
        <span className="text-text3">
          {usedValue.toLocaleString("it-IT", { maximumFractionDigits: 2 })} / {totalValue.toLocaleString("it-IT", { maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface2">
        <div
          className={cn("h-full rounded-full transition-all", percent === 0 && "min-w-0")}
          style={{ width: `${percent}%`, background: USAGE_COLORS[tone] }}
        />
      </div>
      <div className="text-right text-[11px] text-text3">{Math.round(rawPercent)}%</div>
    </div>
  );
}
