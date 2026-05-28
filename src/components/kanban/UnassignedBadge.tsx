import { useTranslation } from "react-i18next";

/**
 * Badge displayed when a ticket has no assigned technician.
 */
export function UnassignedBadge() {
  const { t } = useTranslation(["tickets"]);
  return (
    <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      {t("unassigned", "Non assegnato")}
    </span>
  );
}
