import { Document } from "@react-pdf/renderer";
import type { DashboardAnalytics } from "@/lib/dashboard-analytics";
import {
  BrandedPage,
  ChartGrid,
  ChartPanel,
  DonutChart,
  HorizontalBars,
  MonthlyBars,
  PdfSection,
  PdfTable,
  StatStrip,
  type PdfColumn,
} from "@/components/pcready/pdf/shared";
import { pdfPalette } from "@/components/pcready/pdf/theme";
import { formatAvgDays } from "./analytics-format";

export function AnalyticsReportPdf({
  analytics,
  periodLabel,
  organizationName,
  priorityCounts = { high: 0, med: 0, low: 0 },
}: {
  analytics: DashboardAnalytics;
  periodLabel: string;
  organizationName?: string;
  priorityCounts?: { high: number; med: number; low: number };
}) {
  const monthColumns: PdfColumn<DashboardAnalytics["ticketsByMonth"][number]>[] = [
    { key: "month", label: "Mese", width: "25%", value: (row) => row.label },
    {
      key: "opened",
      label: "Aperti",
      width: "25%",
      mono: true,
      value: (row) => String(row.opened),
    },
    {
      key: "closed",
      label: "Chiusi",
      width: "25%",
      mono: true,
      value: (row) => String(row.closed),
    },
    {
      key: "avg",
      label: "Tempo medio",
      width: "25%",
      mono: true,
      value: (row) => formatAvgDays(row.avg_days),
    },
  ];

  const techColumns: PdfColumn<DashboardAnalytics["technicianKpi"][number]>[] = [
    { key: "name", label: "Tecnico", width: "32%", value: (row) => row.full_name },
    {
      key: "assigned",
      label: "Assegnati",
      width: "16%",
      mono: true,
      value: (row) => String(row.assigned),
    },
    {
      key: "completed",
      label: "Completati",
      width: "16%",
      mono: true,
      value: (row) => String(row.completed),
    },
    {
      key: "avg",
      label: "Tempo medio",
      width: "18%",
      mono: true,
      value: (row) => formatAvgDays(row.avg_days),
    },
    {
      key: "sla",
      label: "SLA OK",
      width: "18%",
      mono: true,
      value: (row) => (row.sla_respected_pct == null ? "n/d" : `${row.sla_respected_pct}%`),
    },
  ];

  return (
    <Document author={organizationName || "PCReady"} title="Report analytics dashboard">
      <BrandedPage
        title="Report analytics dashboard"
        meta={periodLabel}
        organizationName={organizationName}
      >
        <StatStrip
          stats={[
            { label: "Ticket aperti", value: analytics.summary.opened, color: pdfPalette.accent },
            { label: "Ticket chiusi", value: analytics.summary.closed, color: pdfPalette.success },
            {
              label: "Tempo medio",
              value: formatAvgDays(analytics.summary.avgDays),
              color: pdfPalette.warn,
              helper: "risoluzione ticket",
            },
            {
              label: "SLA rispettati",
              value:
                analytics.summary.slaRespectedPct == null
                  ? "n/d"
                  : `${analytics.summary.slaRespectedPct}%`,
              color: pdfPalette.success,
              helper: `${analytics.summary.slaRespected}/${analytics.summary.slaTotal}`,
            },
          ]}
        />
        <PdfSection title="Andamento e distribuzione" meta={periodLabel}>
          <ChartGrid>
            <ChartPanel title="Ticket aperti vs chiusi per mese">
              <MonthlyBars rows={analytics.ticketsByMonth} />
            </ChartPanel>
            <ChartPanel title="Distribuzione priorita ticket">
              <DonutChart
                items={[
                  { label: "Alta", value: priorityCounts.high, color: pdfPalette.danger },
                  { label: "Media", value: priorityCounts.med, color: pdfPalette.warn },
                  { label: "Bassa", value: priorityCounts.low, color: pdfPalette.success },
                ]}
              />
            </ChartPanel>
          </ChartGrid>
        </PdfSection>
        <PdfSection title="Performance tecnici" meta="assegnati vs completati">
          <ChartPanel title="Carico e completamento per tecnico">
            <HorizontalBars
              rows={analytics.technicianKpi.map((row) => ({
                label: row.full_name,
                assigned: row.assigned,
                completed: row.completed,
              }))}
            />
          </ChartPanel>
        </PdfSection>
        <PdfSection title="Dettaglio mensile" meta={`${analytics.ticketsByMonth.length} periodi`}>
          <PdfTable rows={analytics.ticketsByMonth} columns={monthColumns} />
        </PdfSection>
        <PdfSection title="Report SLA" meta="rispetto SLA e tempi per priorita">
          <ChartGrid>
            <ChartPanel title="Tempo medio risoluzione per priorita">
              <HorizontalBars
                rows={(analytics.priorityResolution ?? []).map((row) => ({
                  label: row.label,
                  assigned: row.completed,
                  completed: row.avg_hours ?? 0,
                }))}
              />
            </ChartPanel>
            <ChartPanel title="SLA rispettati nel periodo">
              <DonutChart
                items={[
                  {
                    label: "Rispettati",
                    value: analytics.summary.slaRespected,
                    color: pdfPalette.success,
                  },
                  {
                    label: "Violati",
                    value: Math.max(0, analytics.summary.slaTotal - analytics.summary.slaRespected),
                    color: pdfPalette.danger,
                  },
                ]}
              />
            </ChartPanel>
          </ChartGrid>
        </PdfSection>
        <PdfSection title="Dettaglio tecnici" meta={`${analytics.technicianKpi.length} tecnici`}>
          <PdfTable rows={analytics.technicianKpi} columns={techColumns} />
        </PdfSection>
      </BrandedPage>
    </Document>
  );
}
