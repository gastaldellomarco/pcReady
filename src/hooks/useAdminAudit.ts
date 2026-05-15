import { useCallback, useEffect, useState, useRef, createElement } from "react";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import {
  getAuditLog,
  exportAuditLog,
  getAuditLogKpi,
  getAuditLogUsers,
  type ActivityLogEntry,
  type AuditLogFilters,
  type AuditLogKpi,
  type AuditLogUserOption,
} from "@/lib/audit-log";
import { downloadCsv } from "@/lib/downloads";
import { downloadPdf } from "@/components/pcready/pdf/export";
import { AuditLogReportPdf } from "@/components/admin/AuditLogReportPdf";

export type ViewMode = "table" | "timeline";

export type DatePreset = "today" | "yesterday" | "last7" | "last30" | "custom" | "";

export function useAdminAudit(args: {
  accessToken: string | undefined;
  isAdmin: boolean;
  auditPageSize?: number;
}) {
  const { accessToken, isAdmin, auditPageSize: initialPageSize = 25 } = args;
  const loadAuditLog = useServerFn(getAuditLog);
  const exportAudit = useServerFn(exportAuditLog);
  const loadKpi = useServerFn(getAuditLogKpi);
  const loadUsers = useServerFn(getAuditLogUsers);

  const [auditEntries, setAuditEntries] = useState<ActivityLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(initialPageSize);
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({});
  const [loadingAudit, setLoadingAudit] = useState(false);

  // KPI
  const [kpi, setKpi] = useState<AuditLogKpi>({
    eventsToday: 0,
    events7d: 0,
    recentErrors: 0,
  });
  const [loadingKpi, setLoadingKpi] = useState(false);

  // Users for dropdown
  const [userOptions, setUserOptions] = useState<AuditLogUserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Date preset
  const [datePreset, setDatePreset] = useState<DatePreset>("");

  // Column selection for export
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "date",
    "actor",
    "action",
    "message",
    "entity",
    "ticket",
  ]);

  const initialLoadDone = useRef(false);

  // Load KPI
  const fetchKpi = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    setLoadingKpi(true);
    try {
      const data = await loadKpi({ data: { accessToken } });
      setKpi(data);
    } catch {
      // Silently fail for KPI
    } finally {
      setLoadingKpi(false);
    }
  }, [accessToken, isAdmin, loadKpi]);

  // Load user options
  const fetchUsers = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    setLoadingUsers(true);
    try {
      const data = await loadUsers({ data: { accessToken } });
      setUserOptions(data);
    } catch {
      // Silently fail
    } finally {
      setLoadingUsers(false);
    }
  }, [accessToken, isAdmin, loadUsers]);

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

  // Debounced search reload
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateSearch = useCallback(
    (search: string) => {
      const newFilters = { ...auditFilters, search: search || undefined };
      setAuditFilters(newFilters);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        loadAudit(1, newFilters);
      }, 400);
    },
    [auditFilters, loadAudit],
  );

  const applyDatePreset = useCallback(
    (preset: DatePreset) => {
      setDatePreset(preset);
      const now = new Date();
      let dateFrom: string | undefined;
      let dateTo: string | undefined;

      switch (preset) {
        case "today": {
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        }
        case "yesterday": {
          const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          dateFrom = new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
          ).toISOString();
          dateTo = new Date(
            yesterday.getFullYear(),
            yesterday.getMonth(),
            yesterday.getDate(),
            23,
            59,
            59,
            999,
          ).toISOString();
          break;
        }
        case "last7": {
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        }
        case "last30": {
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        }
      }

      const newFilters = { ...auditFilters, dateFrom, dateTo };
      setAuditFilters(newFilters);
      loadAudit(1, newFilters);
    },
    [auditFilters, loadAudit],
  );

  useEffect(() => {
    if (!initialLoadDone.current && accessToken && isAdmin) {
      initialLoadDone.current = true;
      void loadAudit();
      void fetchKpi();
      void fetchUsers();
    }
  }, [accessToken, isAdmin, loadAudit, fetchKpi, fetchUsers]);

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
        const from = auditFilters.dateFrom ? new Date(auditFilters.dateFrom).toLocaleDateString("it-IT") : "...";
        const to = auditFilters.dateTo ? new Date(auditFilters.dateTo).toLocaleDateString("it-IT") : "...";
        filterParts.push(`date:${from}-${to}`);
      }

      const dateLabel = new Date().toLocaleDateString("it-IT", {
        day: "2-digit", month: "long", year: "numeric",
      });

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

  function resetFilters() {
    setAuditFilters({});
    setDatePreset("");
    loadAudit(1, {});
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

  const totalPages = Math.ceil(auditTotal / auditPageSize) || 1;

  return {
    // Data
    auditEntries,
    auditTotal,
    auditPage,
    auditPageSize,
    totalPages,
    auditFilters,
    loadingAudit,
    // KPI
    kpi,
    loadingKpi,
    fetchKpi,
    // Users
    userOptions,
    loadingUsers,
    // View mode
    viewMode,
    setViewMode,
    // Date preset
    datePreset,
    applyDatePreset,
    // Export columns
    selectedColumns,
    setSelectedColumns,
    // Actions
    setAuditFilters,
    loadAudit,
    updateSearch,
    handleExportCsv,
    handleExportPdf,
    resetFilters,
    getTimelineGroups,
    setAuditPageSize,
  };
}
