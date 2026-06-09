import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import {
  getTechnicianRadarMetrics,
  type TechnicianRadarRow,
} from "@/lib/dashboard-analytics";

import { pcReadyChartColors } from "@/lib/design-system";

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

/**
 *
 */
export default function TechnicianRadarWidget({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const { t } = useTranslation("dashboard");
  const { session } = useAuth();
  const fetcher = useServerFn(getTechnicianRadarMetrics);
  const [rows, setRows] = useState<TechnicianRadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetcher({ data: { accessToken: session.access_token, dateFrom, dateTo } });
      const out = Array.isArray(res?.rows) ? res.rows : [];
      setRows(out);
      setSelectedId((prev) => prev ?? out[0]?.id ?? out[0]?.technician_id ?? null);
    } catch (err) {
      console.error(err);
      toast.error(t("radar.error", "Errore caricamento radar tecnici"));
      setRows([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, fetcher, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Ensure selectedId is initialized when rows change (handles cases where load
  // might be called without setting selectedId above)
  useEffect(() => {
    if (rows.length > 0 && selectedId === null) {
      setSelectedId(rows[0]?.id ?? rows[0]?.technician_id ?? null);
    }
  }, [rows, selectedId]);

  const selected = useMemo(
    () =>
      rows.find((r) => r.id === selectedId || r.technician_id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  const data = useMemo(() => {
    if (!selected) return [];
    const n = selected.normalized ?? {};
    const metricKeys: Array<{ key: string; label: string }> = [
      { key: "volume", label: t("radar.volume", "Volume") },
      { key: "velocita", label: t("radar.speed", "Velocità") },
      { key: "completamento", label: t("radar.completion", "Completamento") },
      { key: "reattivita", label: t("radar.responsiveness", "Reattività") },
      { key: "affidabilita", label: t("radar.reliability", "Affidabilità") },
    ];

    return metricKeys.map((m) => ({
      metric: m.label,
      value: clamp(Number(n[m.key] ?? 0), 0, 100),
    }));
  }, [selected, t]);

  const dataAll = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const metricKeys: Array<{ key: string; label: string }> = [
      { key: "volume", label: t("radar.volume", "Volume") },
      { key: "velocita", label: t("radar.speed", "Velocità") },
      { key: "completamento", label: t("radar.completion", "Completamento") },
      { key: "reattivita", label: t("radar.responsiveness", "Reattività") },
      { key: "affidabilita", label: t("radar.reliability", "Affidabilità") },
    ];

    return metricKeys.map((m) => {
      const entry: Record<string, string | number> = { metric: m.label };
      for (const r of rows) {
        const n = r.normalized ?? {};
        entry[`t_${r.id}`] = clamp(Number(n[m.key] ?? 0), 0, 100);
      }
      return entry;
    });
  }, [rows, t]);

  const palette = pcReadyChartColors;

  return (
    <Card className="h-full">
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>{t("radar.title", "Radar tecnico")}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            {t("radar.showAll", "Mostra tutti")}
          </label>
          <select
            className="pc-select pc-select-sm"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            disabled={showAll}
          >
            {rows.map((r) => (
              <option key={r.id ?? r.technician_id} value={r.id ?? r.technician_id}>
                {r.full_name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="h-[320px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text3">
            {t("radar.loading", "Caricamento...")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {showAll ? (
              <RadarChart cx="50%" cy="50%" outerRadius={90} data={dataAll}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                {rows.map((r, idx) => (
                  <Radar
                    key={r.id}
                    name={r.full_name}
                    dataKey={`t_${r.id}`}
                    stroke={palette[idx % palette.length]}
                    fill={palette[idx % palette.length]}
                    fillOpacity={0.45}
                  />
                ))}
                <Tooltip />
                <Legend />
              </RadarChart>
            ) : (
              <RadarChart cx="50%" cy="50%" outerRadius={90} data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar
                  name={selected?.full_name ?? t("radar.technician", "Tecnico")}
                  dataKey="value"
                  stroke={pcReadyChartColors[0]}
                  fill={pcReadyChartColors[0]}
                  fillOpacity={0.6}
                />
                <Tooltip />
                <Legend />
              </RadarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
