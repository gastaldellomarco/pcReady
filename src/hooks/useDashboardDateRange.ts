/**
 * useDashboardDateRange: gestisce dateFrom/dateTo e valori derivati (range, periodLabel).
 * SCOPO SINGOLO: stato del range date e helper di formattazione.
 */
import { useMemo, useState } from "react";
import {
  defaultDateRange,
  endOfDayIso,
  formatPeriodLabel,
  startOfDayIso,
} from "@/lib/dashboard-helpers";

export function useDashboardDateRange() {
  const defaultRange = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const range = useMemo(() => {
    const from = startOfDayIso(dateFrom);
    const to = endOfDayIso(dateTo);
    return {
      from,
      to,
      days: Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000)),
    };
  }, [dateFrom, dateTo]);

  const periodLabel = useMemo(
    () => formatPeriodLabel(range.from, range.to),
    [range.from, range.to],
  );

  return {
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    range,
    periodLabel,
  };
}
