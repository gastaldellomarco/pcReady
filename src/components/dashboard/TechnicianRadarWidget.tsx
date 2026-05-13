import React, { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTechnicianRadarMetrics } from "@/lib/dashboard-analytics";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export default function TechnicianRadarWidget({ dateFrom, dateTo }: { dateFrom?: string; dateTo?: string }) {
  const { session } = useAuth();
  const fetcher = useServerFn(getTechnicianRadarMetrics);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetcher({ data: { accessToken: session.access_token, dateFrom, dateTo } });
      const out = res?.rows ?? [];
      setRows(out);
      setSelectedId((prev) => prev ?? out[0]?.id ?? null);
    } catch (err) {
      console.error(err);
      setRows([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session?.access_token, dateFrom, dateTo]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);

  const data = useMemo(() => {
    if (!selected) return [];
    const n = selected.normalized ?? {};
    const metricKeys: Array<{ key: string; label: string }> = [
      { key: "volume", label: "Volume" },
      { key: "velocita", label: "Velocità" },
      { key: "completamento", label: "Completamento" },
      { key: "reattivita", label: "Reattività" },
      { key: "affidabilita", label: "Affidabilità" },
    ];

    return metricKeys.map((m) => ({ metric: m.label, value: clamp(Number(n[m.key] ?? 0), 0, 100) }));
  }, [selected]);

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Radar tecnico</CardTitle>
        </div>
        <div>
          <select
            className="pc-select pc-select-sm"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="h-[320px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text3">Caricamento...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius={90} data={data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} />
              <Radar name={selected?.full_name ?? "Tecnico"} dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
