import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, KanbanSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { getKanbanAppSettings, DEFAULT_WIP_LIMITS, type WipLimits } from "@/lib/app-settings";
import { KANBAN_STATUSES } from "@/lib/kanban/constants";
import { STATUS_META, type TicketStatus } from "@/lib/pcready";

interface KanbanWipWidgetProps {
  accessToken: string | undefined;
}

/**
 * Dashboard widget that displays current ticket counts per Kanban column
 * against configured WIP (Work-in-Progress) limits.
 *
 * Each column shows:
 * - Column name with colour dot
 * - Current count / WIP limit
 * - A colour-coded progress bar (green <70%, yellow 70–90%, red ≥90%)
 * - Visual warning when the WIP limit is exceeded
 *
 * @param accessToken - Supabase access token for authenticated data fetching
 */
export function KanbanWipWidget({ accessToken }: KanbanWipWidgetProps) {
  const { t } = useTranslation("dashboard");
  const loadKanbanSettings = useServerFn(getKanbanAppSettings);
  const [wipLimits, setWipLimits] = useState<WipLimits>(DEFAULT_WIP_LIMITS);
  const [counts, setCounts] = useState<Map<TicketStatus, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  const refresh = useCallback(() => {
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    void (async () => {
      if (accessToken) {
        try {
          const settings = await loadKanbanSettings({ data: { accessToken } });
          setWipLimits(settings.wip_limits ?? DEFAULT_WIP_LIMITS);
        } catch {
          setWipLimits(DEFAULT_WIP_LIMITS);
        }
      }

      try {
        const { data, error } = await supabase
          .from("tickets")
          .select("status")
          .in("status", KANBAN_STATUSES);
        if (error) throw error;
        const map = new Map<TicketStatus, number>();
        KANBAN_STATUSES.forEach((s) => map.set(s, 0));
        ((data ?? []) as Array<{ status: string }>).forEach((row) => {
          const s = row.status as TicketStatus;
          map.set(s, (map.get(s) ?? 0) + 1);
        });
        setCounts(map);
      } catch {
        KANBAN_STATUSES.forEach((s) => setCounts((prev) => new Map(prev).set(s, 0)));
      }

      initialLoadDone.current = true;
      setLoading(false);
    })();
  }, [accessToken, loadKanbanSettings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="pc-card">
        <div className="pc-card-hd">
          <span className="pc-card-title">
            {t("widgets.kanbanWip.title", "Limiti WIP Kanban")}
          </span>
        </div>
        <div className="pc-card-body">
          <div className="flex items-center justify-center py-6 text-sm text-text3">
            {t("widgets.loading", "Caricamento...")}
          </div>
        </div>
      </div>
    );
  }

  const totalTickets = Array.from(counts.values()).reduce((sum, c) => sum + c, 0);

  return (
    <div className="pc-card">
      <div className="pc-card-hd">
        <div className="flex items-center gap-2">
          <KanbanSquare className="w-4 h-4" />
          <span className="pc-card-title">
            {t("widgets.kanbanWip.title", "Limiti WIP Kanban")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text3 font-mono">
            {totalTickets} {t("widgets.kanbanWip.totalTickets", "ticket")}
          </span>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={refresh}
            disabled={loading}
            title={t("widgets.refresh", "Aggiorna")}
          >
            {t("widgets.refreshLabel", "Aggiorna")}
          </button>
        </div>
      </div>
      <div className="pc-card-body">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {KANBAN_STATUSES.map((status) => {
            const count = counts.get(status) ?? 0;
            const limit = wipLimits[status] ?? 0;
            const isOverLimit = limit > 0 && count > limit;
            const wipPct = limit > 0 ? (count / limit) * 100 : 0;
            const barColor =
              wipPct >= 90 ? "#DC2626" : wipPct >= 70 ? "#CA8A04" : "#16A34A";
            const barBg =
              wipPct >= 90
                ? "#FEE2E2"
                : wipPct >= 70
                  ? "#FEF9C3"
                  : "#DCFCE7";

            return (
              <div
                key={status}
                className="flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:bg-surface2"
                style={{ borderColor: "var(--border)" }}
              >
                {/* Header: dot + label */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ background: STATUS_META[status].color }}
                    />
                    <span className="text-[11.5px] font-bold uppercase tracking-wide truncate">
                      {STATUS_META[status].label}
                    </span>
                  </div>

                  {/* WIP limit badge */}
                  {limit > 0 && (
                    <span
                      className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isOverLimit
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-surface3 text-text3"
                      }`}
                    >
                      {t("widgets.kanbanWip.limitLabel", "Limite: {{limit}}", { limit })}
                    </span>
                  )}
                </div>

                {/* Count */}
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-[22px] font-bold font-mono ${
                      isOverLimit ? "text-red-600" : ""
                    }`}
                  >
                    {count}
                  </span>
                  {limit > 0 && (
                    <span className="text-[12px] text-text3 font-mono">
                      / {limit}
                    </span>
                  )}
                  {isOverLimit && (
                    <AlertTriangle className="w-4 h-4 text-red-500 ml-auto flex-shrink-0" />
                  )}
                </div>

                {/* Progress bar */}
                {limit > 0 && (
                  <div
                    className="h-2 w-full overflow-hidden rounded-full"
                    style={{ background: barBg }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(wipPct, 100)}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                )}

                {/* Over-limit warning text */}
                {isOverLimit && (
                  <p className="text-[10.5px] font-semibold text-red-600 dark:text-red-400">
                    {t("widgets.kanbanWip.overLimit", "Superato il limite WIP del {{overflow}}%", {
                      overflow: Math.round(wipPct - 100),
                    })}
                  </p>
                )}

                {/* "No limit" label when limit is 0 */}
                {limit === 0 && (
                  <p className="text-[10.5px] text-text3 italic">
                    {t("widgets.kanbanWip.noLimit", "Nessun limite configurato")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {totalTickets === 0 && (
          <div className="mt-4 text-center text-sm text-text3 py-4">
            <KanbanSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p>{t("widgets.kanbanWip.noTickets", "Nessun ticket nelle colonne Kanban")}</p>
          </div>
        )}

        {/* Link to full Kanban */}
        <div className="mt-3 flex justify-end">
          <Link
            to="/kanban"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            {t("widgets.kanbanWip.openKanban", "Apri Kanban")}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
