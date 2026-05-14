import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTechnicianWeeklyActivity } from "@/lib/dashboard-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";

function dayLabels(startIso: string) {
  const start = new Date(startIso);
  return [...Array(7)].map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return format(d, "EEE");
  });
}

function colorForCount(n: number) {
  if (n <= 0) return "bg-transparent border border-surface2";
  if (n <= 2) return "bg-emerald-200";
  if (n <= 4) return "bg-emerald-400";
  return "bg-emerald-700 text-white";
}

export default function TechnicianHeatmapWidget() {
  const { session } = useAuth();
  const fetcher = useServerFn(getTechnicianWeeklyActivity);
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetcher({ data: { accessToken: session.access_token, weekOffset } });
      setData(res);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, [session?.access_token, weekOffset]);

  const technicians = data?.technicians ?? [];
  const weekStart = data?.weekStart ?? new Date().toISOString();
  const weekLabel = useMemo(() => {
    const s = new Date(weekStart);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return `${format(s, "d LLL yyyy")} - ${format(e, "d LLL yyyy")}`;
  }, [weekStart]);

  const days = dayLabels(weekStart);

  return (
    <Card className="dashboard-widget">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Attività settimanale tecnici</CardTitle>
          <div className="text-sm text-text3">{weekLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
            {"<"}
          </Button>
          <Button size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
            {">"}
          </Button>
          <div className="text-sm text-text3">{technicians.length} tecnici</div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-36 flex items-center justify-center text-text3">Caricamento...</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-8 gap-2 items-center mb-2">
                <div />
                {days.map((d) => (
                  <div key={d} className="text-xs text-text3 text-center">
                    {d}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {technicians.map((t: any) => (
                  <div key={t.id} className="grid grid-cols-8 gap-2 items-center p-2 pc-card">
                    <div className="font-semibold text-sm">
                      {t.initials} {t.name}
                    </div>
                    {t.counts.map((c: number, i: number) => (
                      <div
                        key={i}
                        className={`h-10 rounded flex items-center justify-center ${colorForCount(c)}`}
                        title={`${c} ticket chiusi`}
                      >
                        <div className="text-sm">{c || ""}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
