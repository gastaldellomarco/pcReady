import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("admin");
  const columns: PdfColumn<ActivityLogEntry>[] = [
    {
      key: "date",
      label: t("auditReport.colDateTime", "Data/Ora"),
      width: "16%",
      mono: true,
      value: (row) => {
        const d = new Date(row.created_at);
        return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      },
    },
    {
      key: "actor",
      label: t("auditReport.colUser", "Utente"),
      width: "14%",
      value: (row) => row.actor_name || t("auditReport.actorSystem", "Sistema"),
    },
    {
      key: "action",
      label: t("auditReport.colAction", "Azione"),
      width: "14%",
      value: (row) => row.action_type || row.type,
    },
    {
      key: "message",
      label: t("auditReport.colDetail", "Dettaglio"),
      width: "32%",
      value: (row) => row.message,
    },
    {
      key: "entity",
      label: t("auditReport.colEntity", "Entità"),
      width: "12%",
      value: (row) => row.entity_type || "-",
    },
    {
      key: "severity",
      label: t("auditReport.colOutcome", "Esito"),
      width: "12%",
      value: (row) => {
        if (row.severity === "critical") return t("auditReport.outcomeError", "ERRORE");
        if (row.severity === "warning") return t("auditReport.outcomeWarning", "WARNING");
        return t("auditReport.outcomeOk", "OK");
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
        title={t("auditReport.title", "Report Audit Log")}
        meta={t("auditReport.exportMeta", "{{dateLabel}} - {{count}} eventi | Export: {{user}}", { dateLabel, count: totalCount, user: exportUser })}
        organizationName={organizationName}
      >
        <PdfSection
          title={t("auditReport.sectionTitle", "Log di Audit")}
          meta={`${t("auditReport.events", "{{count}} eventi", { count: totalCount })}${filterSummary !== t("auditReport.noFilter", "nessun filtro") ? ` ${t("auditReport.filterPrefix", " | Filtri: {{summary}}", { summary: filterSummary })}` : ""}`}
        >
          <PdfTable rows={entries.slice(0, 100)} columns={columns} />
        </PdfSection>
      </BrandedPage>
    );
  }

  const { Document } = pdfModule;

  return (
    <Document author={organizationName || "PCReady"} title={t("auditReport.title", "Report Audit Log")}>
      <BrandedPage
        title={t("auditReport.title", "Report Audit Log")}
        meta={t("auditReport.exportMeta", "{{dateLabel}} - {{count}} eventi | Export: {{user}}", { dateLabel, count: totalCount, user: exportUser })}
        organizationName={organizationName}
      >
        <PdfSection
          title={t("auditReport.sectionTitle", "Log di Audit")}
          meta={`${t("auditReport.events", "{{count}} eventi", { count: totalCount })}${filterSummary !== t("auditReport.noFilter", "nessun filtro") ? ` ${t("auditReport.filterPrefix", " | Filtri: {{summary}}", { summary: filterSummary })}` : ""}`}
        >
          <PdfTable rows={entries.slice(0, 100)} columns={columns} />
        </PdfSection>
      </BrandedPage>
    </Document>
  );
}
