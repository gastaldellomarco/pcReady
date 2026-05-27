/**
 * useAdminAuditExport: gestisce esportazione CSV, PDF e raggruppamento timeline.
 * SCOPO SINGOLO: logiche di formattazione/export del log di audit.
 */
import { createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { exportAuditLog, type ActivityLogEntry, type AuditLogFilters } from "@/lib/audit-log";
import { downloadCsv } from "@/lib/downloads";

export function useAdminAuditExport(args: {
  accessToken: string | undefined;
  auditFilters: AuditLogFilters;
  auditEntries: ActivityLogEntry[];
  auditTotal: number;
}) {
  const { accessToken, auditFilters, auditEntries, auditTotal } = args;
  const exportAudit = useServerFn(exportAuditLog);

  async function handleExportCsv() {
    if (!accessToken) return;
    try {
      const data = await exportAudit({
        data: {
          accessToken,
          filters: auditFilters,
        },
      });
      downloadCsv(data.csv, data.filename);
      toast.success("File CSV esportato");
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Esportazione CSV non riuscita"));
    }
  }

  async function handleExportPdf() {
    if (!accessToken) return;
    if (auditEntries.length === 0) {
      toast.error("Nessun log da esportare");
      return;
    }
    toast.info("Generazione report PDF...");
    try {
      const filterParts: string[] = [];
      if (auditFilters.actionType) filterParts.push(`azione:${auditFilters.actionType}`);
      if (auditFilters.user) filterParts.push(`utente:${auditFilters.user}`);
      if (auditFilters.entityType) filterParts.push(`entita:${auditFilters.entityType}`);
      if (auditFilters.dateFrom || auditFilters.dateTo) {
        const from = auditFilters.dateFrom
          ? new Date(auditFilters.dateFrom).toLocaleDateString("it-IT")
          : "...";
        const to = auditFilters.dateTo
          ? new Date(auditFilters.dateTo).toLocaleDateString("it-IT")
          : "...";
        filterParts.push(`date:${from}-${to}`);
      }

      const dateLabel = new Date().toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const [{ downloadPdf }, { AuditLogReportPdf }] = await Promise.all([
        import("@/components/pcready/pdf/export"),
        import("@/components/admin/AuditLogReportPdf"),
      ]);

      const pdfElement = createElement(AuditLogReportPdf, {
        entries: auditEntries,
        dateLabel,
        organizationName: (globalThis as any).organizationName || "PCReady",
        exportUser: "Admin",
        filterSummary: filterParts.join(" | ") || "nessun filtro",
        totalCount: auditTotal,
      });

      await downloadPdf(
        pdfElement as unknown as ReactElement<DocumentProps>,
        `pcready-audit-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("Report PDF generato");
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Generazione PDF non riuscita"));
    }
  }

  // Group entries by day for timeline view
  function getTimelineGroups(): Map<string, ActivityLogEntry[]> {
    const groups = new Map<string, ActivityLogEntry[]>();
    for (const entry of auditEntries) {
      const date = new Date(entry.created_at);
      const key = date.toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return groups;
  }

  return {
    handleExportCsv,
    handleExportPdf,
    getTimelineGroups,
  };
}
