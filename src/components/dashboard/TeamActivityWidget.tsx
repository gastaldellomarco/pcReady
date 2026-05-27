import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { getTechnicianStats } from "@/lib/dashboard-analytics";

type Period = "today" | "week" | "month";

export function TeamActivityWidget() {
  const { t } = useTranslation("dashboard");
  const [period, setPeriod] = useState<Period>("week");
  const navigate = useNavigate();
  const fetcher = useServerFn(getTechnicianStats);
  const { session } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await fetcher({ data: { accessToken: session.access_token, period } });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load team activity", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetcher, period, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = rows.filter((r) => r.active).length;

  function workloadColor(load: number) {
    if (load >= 10) return "bg-red-500 text-white";
    if (load >= 5) return "bg-orange-500 text-white";
    return "bg-emerald-600 text-white";
  }

  return (
    <div className="pc-card">
      <div className="pc-card-hd">
        <div>
          <span className="pc-card-title">{t("widgets.recentActivity", "Attività del team")}</span>
          <div className="text-[11px] text-text3 flex items-center gap-1">
            {t("widgets.activeTechnicians", "{{count}} tecnici attivi", { count: activeCount })}
            <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} role="button" aria-label={t("widgets.activeTooltipAria", "Info: criterio tecnici attivi")}>
                  <Info className="h-3 w-3 cursor-help" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                <p>{t("widgets.activeTooltip", "Un tecnico è attivo se ha ticket assegnati nel periodo selezionato o ticket ancora aperti")}</p>
              </TooltipContent>
            </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          {(["today", "week", "month"] as Period[]).map((p) => (
            <button
              key={p}
              className={`px-2.5 py-1 text-[11px] rounded ${
                period === p ? "bg-white dark:bg-surface3 font-semibold shadow-sm" : "text-text3"
              }`}
              onClick={() => setPeriod(p)}
            >
              {p === "today" ? t("widgets.periodToday", "Oggi") : p === "week" ? t("widgets.periodWeek", "Settimana") : t("widgets.periodMonth", "Mese")}
            </button>
          ))}
        </div>
      </div>
      <div className="pc-card-body">
        {loading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded bg-surface2" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-text3 py-4 text-center">{t("widgets.noActivity", "Nessuna attività nel periodo")}</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((tech) => (
              <div
                key={tech.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] cursor-pointer hover:bg-surface2 transition-colors"
                style={{ border: "1px solid var(--border)" }}
                onClick={() =>
                  navigate({ to: "/_app/tickets", search: { technician: tech.id } } as any)
                }
              >
                <Avatar className="w-8 h-8 text-[11px]">{tech.initials}</Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{tech.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-text3">
                    <span>{t("widgets.assigned", "Assegnati")}: {tech.assigned}</span>
                    <span>{t("widgets.completed", "Completati")}: {tech.completed}</span>
                    <span>{t("widgets.pending", "In attesa")}: {tech.pending}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16">
                    <Progress
                      value={tech.assigned > 0 ? Math.round((tech.completed / tech.assigned) * 100) : 0}
                      className="h-1.5"
                    />
                  </div>
                  <span
                    className={
                      "px-1.5 py-0.5 rounded text-[10px] font-medium " + workloadColor(tech.assigned)
                    }
                  >
                    {tech.assigned >= 10 ? t("widgets.high", "Alto") : tech.assigned >= 5 ? t("widgets.medium", "Medio") : t("widgets.low", "Basso")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
