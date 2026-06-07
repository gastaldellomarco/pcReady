import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 *
 */
export function BackupMetric({
  label,
  value,
  detail,
  readOnly = false,
}: {
  label: string;
  value: string;
  detail: string;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={
        "relative rounded-lg p-3 " +
        (readOnly
          ? "border-2 border-dashed border-muted/40 bg-muted/5 text-muted-foreground"
          : "rounded-lg border bg-muted/30")
      }
    >
      {readOnly ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/70">
          <Info className="size-3" />
          {t("settings.backup.readOnlyBadge", "Read-only")}
        </span>
      ) : null}
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
