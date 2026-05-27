/**
 * useAdminAudit: hook orchestratore per il log di audit.
 * COME COMPONE: useAdminAuditData + useAdminAuditFilters + useAdminAuditExport.
 * STESSA INTERFACCIA flat per backward compatibility con AdminAuditTab.tsx.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import {
  getAuditLog,
  getAuditLogKpi,
  getAuditLogUsers,
  type ActivityLogEntry,
  type AuditLogFilters,
  type AuditLogKpi,
  type AuditLogUserOption,
} from "@/lib/audit-log";
import { useAdminAuditFilters } from "./useAdminAuditFilters";
import { useAdminAuditExport } from "./useAdminAuditExport";

export type { DatePreset } from "./useAdminAuditFilters";
export type ViewMode = "table" | "timeline";

export function useAdminAudit(args: {
  accessToken: string | undefined;
  isAdmin: boolean;
  auditPageSize?: number;
  initialFilters?: AuditLogFilters;
  onFiltersChange?: (filters: AuditLogFilters) => void;
}) {
  const {
    accessToken,
    isAdmin,
    auditPageSize: initialPageSize = 25,
    initialFilters: initFilters,
    onFiltersChange,
  } = args;
  const loadAuditLog = useServerFn(getAuditLog);
  const loadKpi = useServerFn(getAuditLogKpi);
  const loadUsers = useServerFn(getAuditLogUsers);

  // --- Data state ---
  const [auditEntries, setAuditEntries] = useState<ActivityLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(initialPageSize);
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

  // Column selection for export
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    "date",
    "actor",
    "action",
    "message",
    "entity",
    "ticket",
  ]);

  // --- Sub-hooks ---
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
        onFiltersChange?.(filters);
      } catch (error) {
        toast.error(getAdminErrorMessage(error, "Impossibile caricare il log di audit"));
      } finally {
        setLoadingAudit(false);
      }
    },
    [accessToken, isAdmin, loadAuditLog, auditPageSize, onFiltersChange],
  );

  const {
    auditFilters,
    setAuditFilters,
    datePreset,
    updateSearch,
    applyDatePreset,
    resetFilters,
  } = useAdminAuditFilters({
    loadAudit,
    initialFilters: initFilters,
  });

  const { handleExportCsv, handleExportPdf, getTimelineGroups } = useAdminAuditExport({
    accessToken,
    auditFilters,
    auditEntries,
    auditTotal,
  });

  // --- KPI ---
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

  // --- Users ---
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

  // Initial load
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current && accessToken && isAdmin) {
      initialLoadDone.current = true;
      void loadAudit(1, initFilters || {});
      void fetchKpi();
      void fetchUsers();
    }
  }, [accessToken, isAdmin, loadAudit, fetchKpi, fetchUsers, initFilters]);

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
