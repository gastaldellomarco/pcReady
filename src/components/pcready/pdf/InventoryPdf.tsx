import { Document } from "@react-pdf/renderer";
import { fmtDate } from "@/lib/pcready";
import { getDeviceCategoryLabel } from "@/lib/device-taxonomy";
import { getWarrantyStatus, WARRANTY_STATUS_META, type WarrantyStatus } from "@/lib/warranty";
import { BrandedPage, PdfSection, PdfTable, StatStrip, type PdfColumn } from "./shared";
import { pdfPalette } from "./theme";

export type DevicePdfStatus = "available" | "assigned" | "maintenance" | "retired";

export interface DevicePdfRow {
  id: string;
  asset_tag?: string | null;
  serial: string | null;
  model: string;
  category?: string | null;
  device_type?: string | null;
  os: string | null;
  status: DevicePdfStatus;
  client: string;
  assigned_to: string | null;
  updated_at: string;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  warranty_type?: string | null;
  warranty_provider?: string | null;
  warranty_notes?: string | null;
}

const DEVICE_STATUS_META: Record<DevicePdfStatus, { label: string; color: string }> = {
  available: { label: "Disponibile", color: pdfPalette.success },
  assigned: { label: "Assegnato", color: pdfPalette.accent },
  maintenance: { label: "In manutenzione", color: pdfPalette.warn },
  retired: { label: "Dismesso", color: pdfPalette.danger },
};

export function InventoryPdf({
  rows,
  organizationName,
  variant = "inventory",
}: {
  rows: DevicePdfRow[];
  organizationName?: string;
  variant?: "inventory" | "warranty";
}) {
  const counts: Record<DevicePdfStatus, number> = {
    available: 0,
    assigned: 0,
    maintenance: 0,
    retired: 0,
  };
  rows.forEach((row) => {
    counts[row.status] += 1;
  });

  const warrantyCounts = rows.reduce(
    (acc, row) => {
      const status = getWarrantyStatus(row.warranty_expiry_date);
      acc[status] += 1;
      return acc;
    },
    { valid: 0, expiring: 0, urgent: 0, expired: 0, missing: 0 } as Record<WarrantyStatus, number>,
  );
  const warrantyRows = rows
    .filter((row) => ["expiring", "urgent"].includes(getWarrantyStatus(row.warranty_expiry_date)))
    .sort((a, b) =>
      String(a.warranty_expiry_date || "").localeCompare(String(b.warranty_expiry_date || "")),
    );

  const columns: PdfColumn<DevicePdfRow>[] = [
    {
      key: "id",
      label: "Asset",
      width: 72,
      mono: true,
      value: (row) => row.asset_tag || row.id.slice(0, 8),
    },
    { key: "model", label: "Modello", width: 110, value: (row) => row.model },
    {
      key: "category",
      label: "Categoria",
      width: 82,
      value: (row) => getDeviceCategoryLabel(row.category),
    },
    { key: "type", label: "Tipo", width: 82, value: (row) => row.device_type || "-" },
    { key: "serial", label: "S/N prod.", width: 78, mono: true, value: (row) => row.serial || "-" },
    { key: "os", label: "OS", width: 92, value: (row) => row.os || "-" },
    {
      key: "status",
      label: "Stato",
      width: 86,
      badge: (row) => ({
        label: DEVICE_STATUS_META[row.status].label,
        color: DEVICE_STATUS_META[row.status].color,
        backgroundColor: statusSoftColor(row.status),
      }),
      value: (row) => DEVICE_STATUS_META[row.status].label,
    },
    { key: "client", label: "Cliente", width: 104, value: (row) => row.client },
    { key: "user", label: "Utente", width: 78, value: (row) => row.assigned_to || "-" },
    { key: "updated", label: "Agg.", width: 56, value: (row) => fmtDate(row.updated_at) },
  ];

  const warrantyColumns: PdfColumn<DevicePdfRow>[] = [
    {
      key: "id",
      label: "Asset",
      width: 62,
      mono: true,
      value: (row) => row.asset_tag || row.id.slice(0, 8),
    },
    { key: "model", label: "Modello", width: 105, value: (row) => row.model },
    { key: "type", label: "Tipo", width: 78, value: (row) => row.device_type || "-" },
    { key: "serial", label: "S/N prod.", width: 78, mono: true, value: (row) => row.serial || "-" },
    { key: "client", label: "Cliente", width: 110, value: (row) => row.client },
    {
      key: "purchase",
      label: "Acquisto",
      width: 70,
      value: (row) => (row.purchase_date ? fmtDate(row.purchase_date) : "-"),
    },
    {
      key: "expiry",
      label: "Scadenza",
      width: 70,
      value: (row) => (row.warranty_expiry_date ? fmtDate(row.warranty_expiry_date) : "-"),
    },
    { key: "type", label: "Tipo", width: 60, value: (row) => row.warranty_type || "-" },
    {
      key: "provider",
      label: "Fornitore",
      width: 90,
      value: (row) => row.warranty_provider || "-",
    },
    {
      key: "warranty_status",
      label: "Stato",
      width: 82,
      badge: (row) => {
        const status = getWarrantyStatus(row.warranty_expiry_date);
        const meta = WARRANTY_STATUS_META[status];
        return { label: meta.label, color: meta.color, backgroundColor: meta.background };
      },
      value: (row) => WARRANTY_STATUS_META[getWarrantyStatus(row.warranty_expiry_date)].label,
    },
  ];

  const activeColumns = variant === "warranty" ? warrantyColumns : columns;

  return (
    <Document
      author={organizationName || "PCReady"}
      title={variant === "warranty" ? "Report garanzie dispositivi" : "Inventario dispositivi"}
    >
      <BrandedPage
        title={variant === "warranty" ? "Report garanzie dispositivi" : "Inventario dispositivi"}
        meta={`${rows.length} dispositivi`}
        organizationName={organizationName}
      >
        <StatStrip
          stats={
            variant === "warranty"
              ? [
                  { label: "In garanzia", value: warrantyCounts.valid, color: pdfPalette.success },
                  { label: "In scadenza", value: warrantyCounts.expiring, color: pdfPalette.warn },
                  { label: "Urgenti", value: warrantyCounts.urgent, color: pdfPalette.warn },
                  { label: "Scadute", value: warrantyCounts.expired, color: pdfPalette.danger },
                  { label: "N/D", value: warrantyCounts.missing, color: pdfPalette.muted },
                ]
              : [
                  { label: "Disponibili", value: counts.available, color: pdfPalette.success },
                  { label: "Assegnati", value: counts.assigned, color: pdfPalette.accent },
                  { label: "Manutenzione", value: counts.maintenance, color: pdfPalette.warn },
                  { label: "Dismessi", value: counts.retired, color: pdfPalette.danger },
                ]
          }
        />
        {variant === "warranty" && (
          <PdfSection
            title="In scadenza nei prossimi 90 giorni"
            meta={`${warrantyRows.length} righe`}
          >
            <PdfTable rows={warrantyRows} columns={warrantyColumns} />
          </PdfSection>
        )}
        <PdfSection
          title={variant === "warranty" ? "Dettaglio garanzie" : "Dettaglio dispositivi"}
          meta={`${rows.length} righe`}
        >
          <PdfTable rows={rows} columns={activeColumns} />
        </PdfSection>
      </BrandedPage>
    </Document>
  );
}

function statusSoftColor(status: DevicePdfStatus) {
  if (status === "available") return pdfPalette.successSoft;
  if (status === "assigned") return pdfPalette.accentSoft;
  if (status === "maintenance") return pdfPalette.warnSoft;
  return pdfPalette.dangerSoft;
}
