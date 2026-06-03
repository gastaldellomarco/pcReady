/**
 * useAdminAuditFilters: gestisce filtri, search, date presets per il log di audit.
 * SCOPO SINGOLO: stato dei filtri + azioni per modificarli.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditLogFilters } from "@/lib/audit-log";

/**
 *
 */
export type DatePreset = "today" | "yesterday" | "last7" | "last30" | "custom" | "";

/**
 *
 */
export function useAdminAuditFilters(args: {
  loadAudit: (page: number, filters: AuditLogFilters) => Promise<void>;
  initialFilters?: AuditLogFilters;
}) {
  const { loadAudit, initialFilters: initFilters } = args;

  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({});
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const initialLoadDone = useRef(false);

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateSearch = useCallback(
    (search: string) => {
      const newFilters = { ...auditFilters, search: search || undefined };
      setAuditFilters(newFilters);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        void loadAudit(1, newFilters);
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
      void loadAudit(1, newFilters);
    },
    [auditFilters, loadAudit],
  );

  function resetFilters() {
    setAuditFilters({});
    setDatePreset("");
    void loadAudit(1, {});
  }

  // Initial load on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      if (initFilters && Object.keys(initFilters).length > 0) {
        setAuditFilters(initFilters);
      }
    }
  }, [initFilters]);

  return {
    auditFilters,
    setAuditFilters,
    datePreset,
    updateSearch,
    applyDatePreset,
    resetFilters,
  };
}
