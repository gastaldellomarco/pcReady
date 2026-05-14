import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useDashboardSnapshot,
  type DashboardDeviceRow,
  type DashboardLogRow,
  type DashboardTicketRow,
} from "@/lib/queries/dashboard";
import { getDashboardAnalytics, type DashboardAnalytics } from "@/lib/dashboard-analytics";
import {
  defaultDateRange,
  endOfDayIso,
  formatPeriodLabel,
  startOfDayIso,
} from "@/lib/dashboard-helpers";

export function useDashboardData(args: {
  accessToken: string | undefined;
  setPendingCount: (n: number) => void;
}) {
  const { accessToken, setPendingCount } = args;
  const loadAnalytics = useServerFn(getDashboardAnalytics);

  const defaultRange = useMemo(() => defaultDateRange(), []);
  const [tickets, setTickets] = useState<DashboardTicketRow[]>([]);
  const [logs, setLogs] = useState<DashboardLogRow[]>([]);
  const [devices, setDevices] = useState<DashboardDeviceRow[]>([]);
  const [devicesWithoutTicket, setDevicesWithoutTicket] = useState<DashboardDeviceRow[]>([]);
  const [ticketsWithoutDeviceCount, setTicketsWithoutDeviceCount] = useState<number>(0);
  const [activeClientsCount, setActiveClientsCount] = useState<number>(0);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const dedupLogs = useMemo(() => {
    const arr = Array.isArray(logs) ? logs : [];
    const seen = new Set<string>();
    const out: typeof arr = [];
    for (const l of arr) {
      const key = `${l.message}|${String(l.created_at).slice(0, 19)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
    }
    return out;
  }, [logs]);

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

  const snap = useDashboardSnapshot({ from: range.from, to: range.to });
  const refetchDashboard = snap.refetch;
  const lastSnapshotError = useRef<string | null>(null);

  useEffect(() => {
    if (snap.isSuccess) lastSnapshotError.current = null;
  }, [snap.isSuccess]);

  useEffect(() => {
    if (!snap.isError || !snap.error) return;
    const msg = snap.error instanceof Error ? snap.error.message : String(snap.error);
    if (lastSnapshotError.current === msg) return;
    lastSnapshotError.current = msg;
    toast.error("Errore nel caricamento della dashboard", { description: msg });
  }, [snap.isError, snap.error]);

  useEffect(() => {
    if (snap.data) {
      setTickets(snap.data.tickets);
      setLogs(snap.data.logs);
      setDevices(snap.data.devices);
      setDevicesWithoutTicket(snap.data.devicesWithoutTicket);
      setTicketsWithoutDeviceCount(snap.data.ticketsWithoutDeviceCount ?? 0);
      setActiveClientsCount(snap.data.activeClientsCount ?? 0);
    }
  }, [snap.data]);

  useEffect(() => {
    const tables = [
      "tickets",
      "devices",
      "clients",
      "activity_log",
      "ticket_device_assignments",
    ] as const;
    const channel = supabase.channel(`dashboard-kpi:${range.from}:${range.to}`);
    const onChange = () => {
      void refetchDashboard();
    };
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
    }
    void channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refetchDashboard, range.from, range.to]);

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

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, "in-progress": 0, testing: 0, ready: 0 };
    tickets.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
    });
    return c;
  }, [tickets]);

  useEffect(() => {
    setPendingCount(counts.pending || 0);
  }, [counts.pending, setPendingCount]);

  const total = tickets.length;

  return {
    tickets,
    logs,
    devices,
    devicesWithoutTicket,
    ticketsWithoutDeviceCount,
    activeClientsCount,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    analytics,
    analyticsLoading,
    dedupLogs,
    range,
    periodLabel,
    counts,
    total,
  };
}
