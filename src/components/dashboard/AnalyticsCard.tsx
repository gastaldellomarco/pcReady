import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { DashboardAnalytics } from "@/lib/dashboard-analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import TechnicianRadarWidget from "./TechnicianRadarWidget";
import { formatAvgDays } from "./analytics-format";

interface AnalyticsCardProps {
  analytics: DashboardAnalytics | null;
  loading: boolean;
  periodLabel: string;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
}

export function AnalyticsCard({
  analytics,
  loading,
  periodLabel,
  onDownloadPdf,
  onDownloadCsv,
}: AnalyticsCardProps) {
  const monthly = analytics?.ticketsByMonth ?? [];
  const technicians = analytics?.technicianKpi ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px]">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <span className="pc-card-title">Report Mensile</span>
            <div className="text-[11px] text-text3">{periodLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={onDownloadCsv}
              disabled={!analytics || loading}
            >
              CSV
            </button>
            <button
              className="pc-btn pc-btn-primary pc-btn-sm"
              onClick={onDownloadPdf}
              disabled={!analytics || loading}
            >
              Scarica Report
            </button>
          </div>
        </div>
        <div className="pc-card-body flex flex-col gap-5">
          {loading ? (
            <AnalyticsSkeleton />
          ) : (
            <>
              <ChartContainer
                config={{
                  opened: { label: "Aperti", color: "#1B4FD8" },
                  closed: { label: "Chiusi", color: "#16A34A" },
                }}
                className="h-[250px] w-full"
              >
                <BarChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="opened" fill="var(--color-opened)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="closed" fill="var(--color-closed)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>

              <div>
                <div className="text-xs font-semibold mb-2">Tempo medio di risoluzione</div>
                <ChartContainer
                  config={{ avg_days: { label: "Tempo medio", color: "#EF9827" } }}
                  className="h-[190px] w-full"
                >
                  <LineChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}g`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent formatter={(value) => formatAvgDays(Number(value))} />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_days"
                      stroke="var(--color-avg_days)"
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <span className="pc-card-title">Performance tecnici</span>
            <div className="text-[11px] text-text3">Assegnati, completati e tempi medi</div>
          </div>
          <span className="text-[11px] text-text3 font-mono">{technicians.length} tecnici</span>
        </div>
        {loading ? (
          <div className="pc-card-body">
            <AnalyticsSkeleton />
          </div>
        ) : (
          <div className="pc-card-body">
            <TechnicianRadarWidget />
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-8 rounded bg-surface2" />
      <div className="h-40 rounded bg-surface2" />
      <div className="h-8 rounded bg-surface2" />
    </div>
  );
}
