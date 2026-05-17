import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { getTechnicianStats } from "@/lib/dashboard-analytics";

type Period = "today" | "week" | "month";

export function TeamActivityWidget() {
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
          <span className="pc-card-title">Attivita del team</span>
          <div className="text-[11px] text-text3">{activeCount} tecnici attivi</div>
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
              {p === "today" ? "Oggi" : p === "week" ? "Settimana" : "Mese"}
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
          <div className="text-sm text-text3 py-4 text-center">Nessuna attivita nel periodo</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {rows.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] cursor-pointer hover:bg-surface2 transition-colors"
                style={{ border: "1px solid var(--border)" }}
                onClick={() =>
                  navigate({ to: "/_app/tickets", search: { technician: t.id } } as any)
                }
              >
                <Avatar className="w-8 h-8 text-[11px]">{t.initials}</Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-text3">
                    <span>Assegnati: {t.assigned}</span>
                    <span>Completati: {t.completed}</span>
                    <span>In attesa: {t.pending}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16">
                    <Progress
                      value={t.assigned > 0 ? Math.round((t.completed / t.assigned) * 100) : 0}
                      className="h-1.5"
                    />
                  </div>
                  <span
                    className={
                      "px-1.5 py-0.5 rounded text-[10px] font-medium " + workloadColor(t.assigned)
                    }
                  >
                    {t.assigned >= 10 ? "Alto" : t.assigned >= 5 ? "Medio" : "Basso"}
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
