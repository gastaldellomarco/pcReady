import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { formatAvgDays } from "./analytics-format";
import type { TechnicianKpi } from "@/lib/dashboard-analytics";

function workloadColor(assigned: number) {
  if (assigned >= 6) return "bg-red-500 text-white";
  if (assigned >= 3) return "bg-orange-500 text-white";
  return "bg-emerald-600 text-white";
}

/**
 *
 */
export function TechnicianKpiTable({ rows }: { rows: TechnicianKpi[] }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length) {
    return (
      <div className="text-center text-text3 py-6">
        {t("widgets.noTechnicianData", "Nessun dato tecnico nel periodo selezionato.")}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto lg:flex-wrap">
      {safeRows.map((row) => {
        const pct = row.assigned
          ? Math.round((row.completed / Math.max(1, row.assigned)) * 100)
          : 0;
        return (
          <button
            type="button"
            key={row.technician_id ?? "unassigned"}
            className="pc-card p-3 min-w-[220px] flex-shrink-0 cursor-pointer text-left"
            onClick={() =>
              navigate({ to: "/_app/tickets", search: { technician: row.technician_id } } as any)
            }
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                {(row.full_name || "")
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Avatar>
              <div className="flex-1">
                <div className="font-semibold text-sm">{row.full_name}</div>
                <div className="text-xs text-text3">
                  {t("widgets.assigned", "Assegnati")}: {row.assigned} • {t("widgets.completed", "Completati")}: {row.completed}
                </div>
              </div>
              <div>
                <div className="text-xs text-text3">{t("widgets.avgTime", "Tempo medio")}</div>
                <div className="text-sm font-semibold">{formatAvgDays(row.avg_days) ?? t("widgets.na", "N/D")}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-text3">
                <div>{t("widgets.completion", "Completamento")}</div>
                <div className="text-sm font-semibold">{pct}%</div>
              </div>
              <Progress value={pct} className="mt-1" />
            </div>

            <div className="mt-3">
              <span className={"px-2 py-1 rounded-md text-xs " + workloadColor(row.assigned)}>
                {row.assigned >= 6
                  ? t("widgets.overloaded", "Sovraccarico")
                  : row.assigned >= 3
                    ? t("widgets.highLoad", "Carico elevato")
                    : t("widgets.normalLoad", "Carico normale")}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
