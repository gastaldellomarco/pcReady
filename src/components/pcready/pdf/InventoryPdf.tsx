import { Document } from "@react-pdf/renderer";
import { fmtDate } from "@/lib/pcready";
import { BrandedPage, PdfTable, StatStrip, type PdfColumn } from "./shared";
import { pdfPalette } from "./theme";

export type DevicePdfStatus = "available" | "assigned" | "maintenance" | "retired";

export interface DevicePdfRow {
  id: string;
  serial: string | null;
  model: string;
  os: string | null;
  status: DevicePdfStatus;
  client: string;
  assigned_to: string | null;
  updated_at: string;
}

const DEVICE_STATUS_META: Record<DevicePdfStatus, { label: string; color: string }> = {
  available: { label: "Disponibile", color: pdfPalette.success },
  assigned: { label: "Assegnato", color: pdfPalette.accent },
  maintenance: { label: "Manutenzione", color: pdfPalette.warn },
  retired: { label: "Dismesso", color: pdfPalette.gray },
};

export function InventoryPdf({ rows }: { rows: DevicePdfRow[] }) {
  const counts: Record<DevicePdfStatus, number> = {
    available: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0,
  };
  rows.forEach((row) => {
    counts[row.status] += 1;
  });

  const columns: PdfColumn<DevicePdfRow>[] = [
    { key: "id", label: "ID", width: 60, mono: true, value: (row) => row.id.slice(0, 8) },
    { key: "model", label: "Modello", width: 130, value: (row) => row.model },
    { key: "serial", label: "Seriale", width: 86, mono: true, value: (row) => row.serial || "-" },
    { key: "os", label: "OS", width: 112, value: (row) => row.os || "-" },
    {
      key: "status",
      label: "Stato",
      width: 96,
      badge: (row) => ({
        label: DEVICE_STATUS_META[row.status].label,
        color: DEVICE_STATUS_META[row.status].color,
        backgroundColor: statusSoftColor(row.status),
      }),
      value: (row) => DEVICE_STATUS_META[row.status].label,
    },
    { key: "client", label: "Cliente", width: 132, value: (row) => row.client },
    { key: "user", label: "Utente", width: 94, value: (row) => row.assigned_to || "-" },
    { key: "updated", label: "Aggiornato", width: 70, value: (row) => fmtDate(row.updated_at) },
  ];

  return (
    <Document author="PCReady" title="Inventario dispositivi">
      <BrandedPage title="Inventario dispositivi" meta={`${rows.length} dispositivi`}>
        <StatStrip
          stats={[
            { label: "Disponibili", value: counts.available, color: pdfPalette.success },
            { label: "Assegnati", value: counts.assigned, color: pdfPalette.accent },
            { label: "Manutenzione", value: counts.maintenance, color: pdfPalette.warn },
            { label: "Dismessi", value: counts.retired, color: pdfPalette.gray },
          ]}
        />
        <PdfTable rows={rows} columns={columns} />
      </BrandedPage>
    </Document>
  );
}

function statusSoftColor(status: DevicePdfStatus) {
  if (status === "available") return pdfPalette.successSoft;
  if (status === "assigned") return pdfPalette.accentSoft;
  if (status === "maintenance") return pdfPalette.warnSoft;
  return pdfPalette.graySoft;
}
