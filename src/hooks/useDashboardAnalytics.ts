/**
 * useDashboardAnalytics: gestisce il caricamento degli analytics dashboard.
 * SCOPO SINGOLO: fetch e stato dei dati analytics.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardAnalytics, type DashboardAnalytics } from "@/lib/dashboard-analytics";

export function useDashboardAnalytics(args: {
  accessToken: string | undefined;
  range: { from: string; to: string };
}) {
  const { accessToken, range } = args;
  const loadAnalytics = useServerFn(getDashboardAnalytics);

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setAnalyticsLoading(true);
    loadAnalytics({
      data: { accessToken, dateFrom: range.from, dateTo: range.to },
    })
      .then((data) => setAnalytics(data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, [accessToken, loadAnalytics, range.from, range.to]);

  return {
    analytics,
    analyticsLoading,
  };
}
