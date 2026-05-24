import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { DashboardAnalytics } from "@/lib/dashboard-analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import TechnicianRadarWidget from "./TechnicianRadarWidget";
import { formatAvgDays } from "./analytics-format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  FileDown,
  FileText,
  BarChart3,
  LineChart as LineChartIcon,
} from "lucide-react";
import { pcReadyColors } from "@/lib/design-system";

interface AnalyticsCardProps {
  analytics: DashboardAnalytics | null;
  loading: boolean;
  periodLabel: string;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
}

type ChartStyle = "bar" | "line";

export function AnalyticsCard({
  analytics,
  loading,
  periodLabel,
  onDownloadPdf,
  onDownloadCsv,
}: AnalyticsCardProps) {
  const { t } = useTranslation("dashboard");
  const [chartType, setChartType] = useState<ChartStyle>("bar");
  const monthly = analytics?.ticketsByMonth ?? [];
  const technicians = analytics?.technicianKpi ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px]">
      <div className="pc-card">
        <div className="pc-card-hd">
          <div>
            <span className="pc-card-title">{t("analytics.monthlyReport", "Report Mensile")}</span>
            <div className="text-[11px] text-text3">{periodLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
              <button
                className={`p-1 rounded ${chartType === "bar" ? "bg-white dark:bg-surface3 shadow-sm" : "text-text3 hover:text-text2"}`}
                onClick={() => setChartType("bar")}
                title={t("analytics.barChart", "Grafico a barre")}
                aria-label={t("analytics.barChart", "Grafico a barre")}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                className={`p-1 rounded ${chartType === "line" ? "bg-white dark:bg-surface3 shadow-sm" : "text-text3 hover:text-text2"}`}
                onClick={() => setChartType("line")}
                title={t("analytics.lineChart", "Grafico a linee")}
                aria-label={t("analytics.lineChart", "Grafico a linee")}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={!analytics || loading}>
                  {t("analytics.export", "Esporta")}
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDownloadCsv} disabled={!analytics || loading}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {t("analytics.exportCsv", "Esporta CSV")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDownloadPdf} disabled={!analytics || loading}>
                  <FileText className="mr-2 h-4 w-4" />
                  {t("analytics.monthlyPdf", "Report Mensile PDF")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="pc-card-body flex flex-col gap-5">
          {loading ? (
            <AnalyticsSkeleton />
          ) : (
            <>
              <ChartContainer
                config={{
                  opened: { label: t("analytics.opened", "Aperti"), color: pcReadyColors.primary },
                  closed: { label: t("analytics.closed", "Chiusi"), color: pcReadyColors.success },
                }}
                className="h-[250px] w-full"
              >
                {chartType === "bar" ? (
                  <BarChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="opened" fill="var(--color-opened)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="closed" fill="var(--color-closed)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="opened"
                      stroke="var(--color-opened)"
                      strokeWidth={2}
                      dot
                    />
                    <Line
                      type="monotone"
                      dataKey="closed"
                      stroke="var(--color-closed)"
                      strokeWidth={2}
                      dot
                    />
                  </LineChart>
                )}
              </ChartContainer>

              <div>
                <div className="text-xs font-semibold mb-2">{t("analytics.avgResolution", "Tempo medio di risoluzione")}</div>
                <ChartContainer
                  config={{ avg_days: { label: t("analytics.avgTime", "Tempo medio"), color: pcReadyColors.warning } }}
                  className="h-[190px] w-full"
                >
                  <LineChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}${t("stats.days", "g")}`}
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
            <span className="pc-card-title">{t("analytics.technicianPerformance", "Performance tecnici")}</span>
            <div className="text-[11px] text-text3">{t("analytics.technicianSubtitle", "Assegnati, completati e tempi medi")}</div>
          </div>
          <span className="text-[11px] text-text3 font-mono">{t("analytics.technicianCount", "{{count}} tecnici", { count: technicians.length })}</span>
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
