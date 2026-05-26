import { useTranslation } from "react-i18next";
import { Shield } from "lucide-react";

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
      aria-hidden={readOnly}
    >
      {readOnly ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-muted/10 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          <Shield className="h-3 w-3 text-muted-foreground" />
          {t("settings.backup.readOnlyBadge", "Gestito dal provider")}
        </span>
      ) : null}
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
