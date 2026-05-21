import React from "react";
import {
  BrandedPage,
  PdfSection,
  PdfTable,
  type PdfColumn,
} from "@/components/pcready/pdf/shared";
import type { ActivityLogEntry } from "@/lib/audit-log";

export function AuditLogReportPdf({
  entries,
  dateLabel,
  organizationName,
  exportUser,
  filterSummary,
  totalCount,
}: {
  entries: ActivityLogEntry[];
  dateLabel: string;
  organizationName?: string;
  exportUser: string;
  filterSummary: string;
  totalCount: number;
}) {
  const columns: PdfColumn<ActivityLogEntry>[] = [
    {
      key: "date",
      label: "Data/Ora",
      width: "16%",
      mono: true,
      value: (row) => {
        const d = new Date(row.created_at);
        return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      },
    },
    {
      key: "actor",
      label: "Utente",
      width: "14%",
      value: (row) => row.actor_name || "Sistema",
    },
    {
      key: "action",
      label: "Azione",
      width: "14%",
      value: (row) => row.action_type || row.type,
    },
    {
      key: "message",
      label: "Dettaglio",
      width: "32%",
      value: (row) => row.message,
    },
    {
      key: "entity",
      label: "Entita",
      width: "12%",
      value: (row) => row.entity_type || "-",
    },
    {
      key: "severity",
      label: "Esito",
      width: "12%",
      value: (row) => {
        if (row.severity === "critical") return "ERRORE";
        if (row.severity === "warning") return "WARNING";
        return "OK";
      },
    },
  ];

  const [pdfModule, setPdfModule] = React.useState<any>(null);

  React.useEffect(() => {
    let mounted = true;
    import("@react-pdf/renderer")
      .then((m) => {
        if (mounted) setPdfModule(m);
      })
      .catch(() => {
        // swallow: consumers should handle absence
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!pdfModule) {
    // PDF lib not loaded yet — render a lightweight placeholder or nothing.
    return (
      <BrandedPage
        title="Report Audit Log"
        meta={`${dateLabel} - ${totalCount} eventi | Export: ${exportUser}`}
        organizationName={organizationName}
      >
        <PdfSection
          title="Log di Audit"
          meta={`${totalCount} eventi trovati${filterSummary !== "nessun filtro" ? ` | Filtri: ${filterSummary}` : ""}`}
        >
          <PdfTable rows={entries.slice(0, 100)} columns={columns} />
        </PdfSection>
      </BrandedPage>
    );
  }

  const { Document } = pdfModule;

  return (
    <Document author={organizationName || "PCReady"} title="Report Audit Log">
      <BrandedPage
        title="Report Audit Log"
        meta={`${dateLabel} - ${totalCount} eventi | Export: ${exportUser}`}
        organizationName={organizationName}
      >
        <PdfSection
          title="Log di Audit"
          meta={`${totalCount} eventi trovati${filterSummary !== "nessun filtro" ? ` | Filtri: ${filterSummary}` : ""}`}
        >
          <PdfTable rows={entries.slice(0, 100)} columns={columns} />
        </PdfSection>
      </BrandedPage>
    </Document>
  );
}
