import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { getAuditLog, exportAuditLog, type ActivityLogEntry, type AuditLogFilters } from "@/lib/audit-log";
import { downloadCsv } from "@/lib/downloads";

export function useAdminAudit(args: {
  accessToken: string | undefined;
  isAdmin: boolean;
  auditPageSize?: number;
}) {
  const { accessToken, isAdmin, auditPageSize = 25 } = args;
  const loadAuditLog = useServerFn(getAuditLog);
  const exportAudit = useServerFn(exportAuditLog);

  const [auditEntries, setAuditEntries] = useState<ActivityLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({});
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAudit = useCallback(
    async (page = 1, filters: AuditLogFilters = {}) => {
      if (!accessToken || !isAdmin) return;
      setLoadingAudit(true);
      try {
        const data = await loadAuditLog({
          data: {
            accessToken,
            page,
            pageSize: auditPageSize,
            filters,
          },
        });
        setAuditEntries(data.entries);
        setAuditTotal(data.total);
        setAuditPage(page);
        setAuditFilters(filters);
      } catch (error) {
        toast.error(getAdminErrorMessage(error, "Impossibile caricare il log di audit"));
      } finally {
        setLoadingAudit(false);
      }
    },
    [accessToken, isAdmin, loadAuditLog, auditPageSize],
  );

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  async function handleExportAudit() {
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
      toast.error(getAdminErrorMessage(error, "Esportazione non riuscita"));
    }
  }

  return {
    auditEntries,
    auditTotal,
    auditPage,
    auditFilters,
    setAuditFilters,
    loadingAudit,
    loadAudit,
    handleExportAudit,
    auditPageSize,
  };
}
