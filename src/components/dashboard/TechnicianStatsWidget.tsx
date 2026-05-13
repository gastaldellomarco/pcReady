import React, { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { formatDistanceStrict } from "date-fns";
import { getTechnicianStats } from "@/lib/dashboard-analytics";

type Period = "today" | "week" | "month";

export default function TechnicianStatsWidget({ defaultPeriod = "week" as Period }) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const fetcher = useServerFn(getTechnicianStats);
  const { session } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await fetcher({ data: { accessToken: session.access_token, period } });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load technician stats", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => setRefreshKey((k) => k + 1), 30000);
    return () => clearInterval(t);
  }, [period, session?.access_token]);

  useEffect(() => {
    if (refreshKey > 0) void load();
  }, [refreshKey]);

  const activeCount = rows.filter((r) => r.active).length;

  function formatDuration(ms: number | null) {
    if (!ms) return "—";
    try {
      return formatDistanceStrict(0, ms, { unit: "minute" });
    } catch {
      return "—";
    }
  }

  function workloadColor(load: number) {
    // thresholds: <5 green, 5-9 orange, 10+ red (configurable later)
    if (load >= 10) return "bg-red-500 text-white";
    if (load >= 5) return "bg-orange-500 text-white";
    return "bg-emerald-600 text-white";
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Statistiche Tecnici</CardTitle>
          <div className="text-sm text-text3">Tecnici attivi: {activeCount}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-muted p-1">
            <button
              className={"px-3 py-1 text-sm " + (period === "today" ? "font-semibold" : "text-text3")}
              onClick={() => setPeriod("today")}
            >
              Oggi
            </button>
            <button
              className={"px-3 py-1 text-sm " + (period === "week" ? "font-semibold" : "text-text3")}
              onClick={() => setPeriod("week")}
            >
              Settimana
            </button>
            <button
              className={"px-3 py-1 text-sm " + (period === "month" ? "font-semibold" : "text-text3")}
              onClick={() => setPeriod("month")}
            >
              Mese
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 py-2 lg:overflow-x-auto lg:flex-nowrap flex-wrap">
          {loading ? (
            <div className="flex items-center gap-4">
              <div className="w-80 h-24 rounded-lg bg-surface2 animate-pulse" />
              <div className="w-80 h-24 rounded-lg bg-surface2 animate-pulse" />
              <div className="w-80 h-24 rounded-lg bg-surface2 animate-pulse" />
            </div>
          ) : (
            rows.map((t) => (
              <div
                key={t.id}
                className="min-w-[220px] pc-card p-3 cursor-pointer flex-shrink-0"
                onClick={() => navigate({ to: "/_app/tickets", search: { technician: t.id } })}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">{t.initials}</Avatar>
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-text3">{t.title || "Tecnico"}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-text3">Assegnati</div>
                    <div className="font-semibold">{t.assigned}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-text3">
                    <div>In attesa: {t.pending}</div>
                    <div>Completati: {t.completed}</div>
                  </div>

                  <div className="mt-2 text-xs text-text3">Tempo medio: {formatDuration(t.avg_resolution_ms)}</div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-text3">
                      <div>Tasso completamento</div>
                      <div className="text-sm font-semibold">{t.assigned ? Math.round((t.completed / Math.max(1, t.assigned)) * 100) : 0}%</div>
                    </div>
                    <Progress value={t.assigned ? Math.round((t.completed / Math.max(1, t.assigned)) * 100) : 0} className="mt-1" />
                  </div>

                  <div className="mt-3">
                    <span className={"px-2 py-1 rounded-md text-xs " + workloadColor(t.assigned)}>
                      {t.assigned >= 10 ? "Sovraccarico" : t.assigned >= 5 ? "Carico elevato" : "Carico normale"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
