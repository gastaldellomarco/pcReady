import { useTranslation } from "react-i18next";
import { slaIndicator, type SlaCardLike } from "@/lib/kanban/helpers";
import { formatSlaCountdown } from "@/lib/pcready";
import { cn } from "@/lib/utils";

/**
 * Compact SLA status badge for a Kanban card.
 *
 * @description Shows a countdown or status label for cards that are overdue or
 * approaching their SLA deadline. Cards with OK SLA status render nothing.
 */
export function SlaMiniLabel({ card, compactView }: { card: SlaCardLike; compactView?: boolean }) {
  const { t } = useTranslation(["tickets"]);
  const indicator = slaIndicator(card);
  const deadline = card.due_date || card.sla_deadline;
  if (indicator.status === "ok") return null;
  const countdown = deadline
    ? formatSlaCountdown(deadline)
    : indicator.status === "overdue"
      ? t("sla.breached", indicator.label)
      : t("status.expiring", indicator.label);
  const isOverdue = indicator.status === "overdue";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 font-semibold whitespace-nowrap",
        compactView ? "text-[9px]" : "text-[9.5px]",
        isOverdue && "border",
      )}
      style={{
        background: `${indicator.color}22`,
        color: indicator.color,
        ...(isOverdue ? { borderColor: indicator.color, borderWidth: "1px" } : {}),
      }}
      title={countdown}
    >
      {countdown}
    </span>
  );
}
