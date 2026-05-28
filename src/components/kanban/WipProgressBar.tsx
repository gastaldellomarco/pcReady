import { pcReadyColors } from "@/lib/design-system";
import { cn } from "@/lib/utils";

/**
 * A thin progress bar that shows WIP capacity utilisation for a kanban column.
 *
 * Colour thresholds:
 * - ≥90% → danger (red)
 * - ≥70% → warning (amber)
 * - <70% → success (green)
 *
 * @param pct - Percentage fill (0–100+). Values over 100 are clamped visually.
 * @param className - Optional additional classes (e.g. `"w-14"` for fixed width).
 *                    Defaults to `"w-full"`.
 */
export function WipProgressBar({ pct, className }: { pct: number; className?: string }) {
  const color =
    pct >= 90 ? pcReadyColors.danger : pct >= 70 ? pcReadyColors.warning : pcReadyColors.success;
  const bgColor =
    pct >= 90
      ? pcReadyColors.dangerLight
      : pct >= 70
        ? pcReadyColors.warningLight
        : pcReadyColors.successLight;
  return (
    <div
      className={cn("h-1.5 rounded-full overflow-hidden", className ?? "w-full")}
      style={{ background: bgColor }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}
