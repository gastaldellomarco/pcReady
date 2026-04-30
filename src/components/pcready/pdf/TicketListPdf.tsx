import { Document } from "@react-pdf/renderer";
import {
  PRIORITY_LABEL,
  STATUS_META,
  fmtDate,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/pcready";
import { BrandedPage, PdfTable, StatStrip, type PdfColumn } from "./shared";
import { pdfPalette } from "./theme";

export interface TicketPdfRow {
  ticket_code: string;
  client: string;
  model: string;
  serial: string | null;
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string | null;
  created_at: string;
}

export function TicketListPdf({ rows }: { rows: TicketPdfRow[] }) {
  const priorityCounts: Record<TicketPriority, number> = { high: 0, med: 0, low: 0 };
  rows.forEach((row) => {
    priorityCounts[row.priority] += 1;
  });

  const columns: PdfColumn<TicketPdfRow>[] = [
    { key: "code", label: "ID", width: 64, mono: true, value: (row) => row.ticket_code },
    { key: "model", label: "Modello", width: 96, value: (row) => row.model },
    { key: "serial", label: "Seriale", width: 72, mono: true, value: (row) => row.serial || "-" },
    { key: "client", label: "Cliente", width: 116, value: (row) => row.client },
    { key: "requester", label: "Richiedente", width: 104, value: (row) => row.requester },
    {
      key: "priority",
      label: "Priorita",
      width: 62,
      badge: (row) => ({
        label: PRIORITY_LABEL[row.priority],
        color: priorityColor(row.priority),
        backgroundColor: prioritySoftColor(row.priority),
      }),
      value: (row) => PRIORITY_LABEL[row.priority],
    },
    {
      key: "status",
      label: "Stato",
      width: 82,
      badge: (row) => ({
        label: STATUS_META[row.status].label,
        color: STATUS_META[row.status].color,
        backgroundColor: statusSoftColor(row.status),
      }),
      value: (row) => STATUS_META[row.status].label,
    },
    {
      key: "assignee",
      label: "Assegnatario",
      width: 100,
      value: (row) => row.assignee || "Non assegnato",
    },
    { key: "created", label: "Creato", width: 58, value: (row) => fmtDate(row.created_at) },
  ];

  return (
    <Document author="PCReady" title="Ticket PC">
      <BrandedPage title="Ticket PC" meta={`${rows.length} ticket`}>
        <StatStrip
          stats={[
            { label: "Priorita alta", value: priorityCounts.high, color: pdfPalette.danger },
            { label: "Priorita media", value: priorityCounts.med, color: pdfPalette.warn },
            { label: "Priorita bassa", value: priorityCounts.low, color: pdfPalette.success },
          ]}
        />
        <PdfTable rows={rows} columns={columns} />
      </BrandedPage>
    </Document>
  );
}

function priorityColor(priority: TicketPriority) {
  if (priority === "high") return pdfPalette.danger;
  if (priority === "med") return pdfPalette.warn;
  return pdfPalette.success;
}

function prioritySoftColor(priority: TicketPriority) {
  if (priority === "high") return pdfPalette.dangerSoft;
  if (priority === "med") return pdfPalette.warnSoft;
  return pdfPalette.successSoft;
}

function statusSoftColor(status: TicketStatus) {
  if (status === "pending") return pdfPalette.warnSoft;
  if (status === "in-progress") return pdfPalette.accentSoft;
  if (status === "testing") return pdfPalette.purpleSoft;
  return pdfPalette.successSoft;
}
