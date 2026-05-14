import { Document } from "@react-pdf/renderer";
import type { DashboardAnalytics } from "@/lib/dashboard-analytics";
import { BrandedPage, PdfTable, StatStrip, type PdfColumn } from "@/components/pcready/pdf/shared";
import { pdfPalette } from "@/components/pcready/pdf/theme";
import { formatAvgDays } from "./analytics-format";

export function AnalyticsReportPdf({
  analytics,
  periodLabel,
  organizationName,
}: {
  analytics: DashboardAnalytics;
  periodLabel: string;
  organizationName?: string;
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
    { key: "name", label: "Tecnico", width: "40%", value: (row) => row.full_name },
    {
      key: "assigned",
      label: "Assegnati",
      width: "20%",
      mono: true,
      value: (row) => String(row.assigned),
    },
    {
      key: "completed",
      label: "Completati",
      width: "20%",
      mono: true,
      value: (row) => String(row.completed),
    },
    {
      key: "avg",
      label: "Tempo medio",
      width: "20%",
      mono: true,
      value: (row) => formatAvgDays(row.avg_days),
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
            },
          ]}
        />
        <PdfTable rows={analytics.ticketsByMonth} columns={monthColumns} />
        <PdfTable rows={analytics.technicianKpi} columns={techColumns} />
      </BrandedPage>
    </Document>
  );
}
