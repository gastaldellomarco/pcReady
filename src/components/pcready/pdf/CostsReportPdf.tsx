import { Document } from "@react-pdf/renderer";
import { BrandedPage, PdfSection, PdfTable, type PdfColumn, StatStrip } from "@/components/pcready/pdf/shared";
import { pdfPalette } from "@/components/pcready/pdf/theme";

type TicketCostRow = {
  id: string;
  ticket_code: string;
  client_id: string | null;
  client_name: string | null;
  assignee_id: string | null;
  technician_name: string | null;
  status: string;
  priority: string;
  ticket_type: string;
  created_at: string;
  completed_at: string | null;
  billable_hours: number | null;
  hourly_rate: number | null;
  material_cost: number | null;
  labor_cost: number | null;
  total_cost: number | null;
  tracked_minutes: number | null;
};

type CostGroup = { name: string; hours: number; total: number; materials: number; labor: number };

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    money(value),
  );
}

function formatHours(value: unknown) {
  return `${money(value).toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
}

export function CostsReportPdf({
  rows,
  summary,
  period,
  byClient,
  byTechnician,
}: {
  rows: TicketCostRow[];
  summary: {
    ticketTotal: number;
    labor: number;
    materials: number;
    hours: number;
    recurring: number;
    estimatedRevenue: number;
  };
  period: string;
  byClient: CostGroup[];
  byTechnician: CostGroup[];
}) {
  const ticketColumns: PdfColumn<TicketCostRow>[] = [
    { key: "ticket", label: "Ticket", width: "14%", value: (row) => row.ticket_code },
    { key: "client", label: "Cliente", width: "28%", value: (row) => row.client_name ?? "-" },
    { key: "tech", label: "Tecnico", width: "20%", value: (row) => row.technician_name ?? "-" },
    {
      key: "hours",
      label: "Ore",
      width: "10%",
      mono: true,
      value: (row) => formatHours(money(row.billable_hours)),
    },
    {
      key: "materials",
      label: "Materiali",
      width: "14%",
      mono: true,
      value: (row) => formatCurrency(row.material_cost),
    },
    {
      key: "total",
      label: "Totale",
      width: "14%",
      mono: true,
      value: (row) => formatCurrency(row.total_cost),
    },
  ];
  const groupColumns: PdfColumn<CostGroup>[] = [
    { key: "name", label: "Nome", width: "55%", value: (row) => row.name },
    {
      key: "hours",
      label: "Ore",
      width: "20%",
      mono: true,
      value: (row) => formatHours(row.hours),
    },
    {
      key: "total",
      label: "Totale",
      width: "25%",
      mono: true,
      value: (row) => formatCurrency(row.total),
    },
  ];

  return (
    <Document author="PCReady" title="Report costi">
      <BrandedPage title="Report costi" meta={period}>
        <StatStrip
          stats={[
            {
              label: "Totale ticket",
              value: formatCurrency(summary.ticketTotal),
              color: pdfPalette.accent,
            },
            { label: "Manodopera", value: formatCurrency(summary.labor), color: pdfPalette.info },
            {
              label: "Materiali",
              value: formatCurrency(summary.materials),
              color: pdfPalette.warn,
            },
            {
              label: "Margine stimato",
              value: formatCurrency(summary.estimatedRevenue - summary.materials),
              color: pdfPalette.success,
            },
          ]}
        />
        <PdfSection title="Costi per cliente" meta={`${byClient.length} clienti`}>
          <PdfTable rows={byClient} columns={groupColumns} />
        </PdfSection>
        <PdfSection title="Costi per tecnico" meta={`${byTechnician.length} tecnici`}>
          <PdfTable rows={byTechnician} columns={groupColumns} />
        </PdfSection>
        <PdfSection title="Dettaglio ticket" meta={`${rows.length} ticket`}>
          <PdfTable rows={rows.slice(0, 40)} columns={ticketColumns} />
        </PdfSection>
      </BrandedPage>
    </Document>
  );
}
