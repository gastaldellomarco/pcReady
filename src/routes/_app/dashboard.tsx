import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { PageErrorBoundary } from "@/components/page-states";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketStatus, fmtDateTime, fmtDate } from "@/lib/pcready";
import { StatusBadge, AssigneeChip } from "@/components/pcready/StatusBadge";
import { openDeviceDetail, openTicketDetail } from "@/lib/use-detail";
import { useAuth } from "@/lib/auth-context";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { downloadAnalyticsCsv, computeDailyCounts } from "@/lib/dashboard-helpers";
import {
  DashboardStatCard,
  DashboardDonut,
  dashboardDeviceLabel,
  DashboardAreaSpark,
  DashboardAreaSparkMulti,
} from "@/components/dashboard/DashboardStatWidgets";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import TechnicianHeatmapWidget from "@/components/dashboard/TechnicianHeatmapWidget";
import { downloadPdf } from "@/components/pcready/pdf/export";
import { AnalyticsReportPdf } from "@/components/dashboard/AnalyticsReportPdf";
import { getPublicAppSettings } from "@/lib/app-settings";
import { buildDownloadFileName } from "@/lib/downloads";
import { CriticalEventsWidget } from "@/components/dashboard/CriticalEventsWidget";
import { OverdueTicketsWidget } from "@/components/dashboard/OverdueTicketsWidget";
import { TeamActivityWidget } from "@/components/dashboard/TeamActivityWidget";
import { WidgetSettingsPanel } from "@/components/dashboard/WidgetSettingsPanel";
import type { WidgetId } from "@/components/dashboard/widget-registry";
import {
  fetchMaintenanceDashboard,
  getMaintenanceStatus,
  MAINTENANCE_STATUS_META,
  type MaintenanceSchedule,
} from "@/lib/maintenance";
import {
  daysUntil,
  getWarrantyStatus,
  WARRANTY_STATUS_META,
  type WarrantyStatus,
} from "@/lib/warranty";
import {
  TrendingUp,
  Activity,
  Boxes,
  Clock,
  CircleCheck,
  ArrowRight,
  Settings2,
  ListChecks as ListChecksIcon,
} from "lucide-react";

const AnalyticsCard = lazy(() =>
  import("@/components/dashboard/AnalyticsCard").then((module) => ({
    default: module.AnalyticsCard,
  })),
);

type ChecklistDashboardStats = {
  total: number;
  completed: number;
  completedPct: number;
  avgCompletionLabel: string;
  topTemplate: { title: string; count: number } | null;
  topTechnician: { id: string; completed: number; total: number; pct: number } | null;
};

async function fetchCustomerSatisfactionStats() {
  const { data, error } = await (supabase as any).from("ticket_feedback").select("rating");
  if (error) {
    if (error.code === "42P01") return { average: null as number | null, count: 0 };
    throw error;
  }
  const ratings = ((data ?? []) as Array<{ rating: number }>)
    .map((row) => row.rating)
    .filter(Boolean);
  const average = ratings.length
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
    : null;
  return { average, count: ratings.length };
}

async function fetchChecklistStats(): Promise<ChecklistDashboardStats> {
  const { data, error } = await (supabase as any)
    .from("ticket_checklist_instances")
    .select("title, status, created_at, completed_at, assigned_to");
  if (error) {
    if (error.code === "42P01") {
      return {
        total: 0,
        completed: 0,
        completedPct: 0,
        avgCompletionLabel: "n/d",
        topTemplate: null,
        topTechnician: null,
      };
    }
    throw error;
  }

  const rows = (data ?? []) as Array<{
    title: string | null;
    status: string | null;
    created_at: string | null;
    completed_at: string | null;
    assigned_to: string | null;
  }>;
  const total = rows.length;
  const completedRows = rows.filter((row) => row.status === "completed");
  const completed = completedRows.length;
  const completedPct = total ? Math.round((completed / total) * 100) : 0;
  const durations = completedRows
    .map((row) => {
      const start = row.created_at ? new Date(row.created_at).getTime() : NaN;
      const end = row.completed_at ? new Date(row.completed_at).getTime() : NaN;
      return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : null;
    })
    .filter((value): value is number => value != null);
  const avgMs = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;
  const templateCounts = new Map<string, number>();
  rows.forEach((row) => {
    const title = row.title || "Checklist";
    templateCounts.set(title, (templateCounts.get(title) ?? 0) + 1);
  });
  const topTemplate =
    Array.from(templateCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([title, count]) => ({ title, count }))[0] ?? null;
  const technicianStats = new Map<string, { completed: number; total: number }>();
  rows.forEach((row) => {
    if (!row.assigned_to) return;
    const current = technicianStats.get(row.assigned_to) ?? { completed: 0, total: 0 };
    current.total += 1;
    if (row.status === "completed") current.completed += 1;
    technicianStats.set(row.assigned_to, current);
  });
  const topTechnician =
    Array.from(technicianStats.entries())
      .map(([id, stat]) => ({
        id,
        completed: stat.completed,
        total: stat.total,
        pct: stat.total ? Math.round((stat.completed / stat.total) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct || b.completed - a.completed)[0] ?? null;

  return {
    total,
    completed,
    completedPct,
    avgCompletionLabel: avgMs == null ? "n/d" : formatAverageDuration(avgMs),
    topTemplate,
    topTechnician,
  };
}

function formatAverageDuration(ms: number) {
  const hours = Math.max(1, Math.round(ms / 36_000) / 100);
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}g`;
}

const TechnicianStatsWidgetLazy = lazy(() =>
  import("@/components/dashboard/TechnicianStatsWidget").then((module) => ({
    default: module.default,
  })),
);

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - PCReady" },
      {
        name: "description",
        content: "Panoramica ticket, pipeline e attivita recente in PCReady.",
      },
    ],
  }),
  component: DashboardPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

function DashboardPage() {
  const { setPendingCount } = useTickets();
  const { session } = useAuth();
  const loadSettings = useServerFn(getPublicAppSettings);
  const {
    tickets,
    devices,
    devicesWithoutTicket,
    warrantyDevices,
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
  } = useDashboardData({
    accessToken: session?.access_token,
    setPendingCount,
  });
  const { visibleWidgets, allWidgets, editMode, setEditMode, reorder, toggleVisibility } =
    useDashboardLayout();
  const checklistStatsQuery = useQuery({
    queryKey: ["dashboard", "checklist-stats"],
    queryFn: fetchChecklistStats,
  });
  const satisfactionQuery = useQuery({
    queryKey: ["dashboard", "customer-satisfaction"],
    queryFn: fetchCustomerSatisfactionStats,
  });

  const priorityCounts = useMemo(
    () =>
      tickets.reduce(
        (acc, ticket) => {
          acc[ticket.priority] += 1;
          return acc;
        },
        { high: 0, med: 0, low: 0 },
      ),
    [tickets],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Header with title and widget settings */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <div className="text-xs text-text3">Panoramica generale delle attivita</div>
        </div>
        <button
          className="pc-btn pc-btn-ghost pc-btn-sm"
          onClick={() => setEditMode(!editMode)}
          title="Gestione widget"
        >
          <Settings2 className="w-4 h-4 mr-1" />
          Widget
        </button>
      </div>

      {/* Widget settings panel */}
      {editMode && (
        <WidgetSettingsPanel
          allWidgets={allWidgets}
          onReorder={reorder}
          onToggleVisibility={toggleVisibility}
          onClose={() => setEditMode(false)}
        />
      )}

      {/* Render widgets in configured order */}
      {visibleWidgets.map((w) =>
        renderWidget(w.id, {
          tickets,
          devices,
          devicesWithoutTicket,
          warrantyDevices,
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
          priorityCounts,
          checklistStats: checklistStatsQuery.data ?? null,
          satisfactionStats: satisfactionQuery.data ?? null,
          loadSettings,
          session,
        }),
      )}
    </div>
  );
}

type WidgetContext = {
  tickets: any[];
  devices: any[];
  devicesWithoutTicket: any[];
  warrantyDevices: any[];
  ticketsWithoutDeviceCount: number;
  activeClientsCount: number;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  analytics: any;
  analyticsLoading: boolean;
  dedupLogs: any[];
  range: { from: string; to: string; days: number };
  periodLabel: string;
  counts: Record<string, number>;
  total: number;
  priorityCounts: { high: number; med: number; low: number };
  checklistStats: ChecklistDashboardStats | null;
  satisfactionStats: { average: number | null; count: number } | null;
  loadSettings: any;
  session: any;
};

function renderWidget(id: WidgetId, ctx: WidgetContext) {
  switch (id) {
    case "stat-cards":
      return (
        <div key="stat-cards" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <DashboardStatCard
            label="Ticket totali"
            value={ctx.total}
            accent="var(--accent)"
            sub="totali"
            icon={<Boxes className="w-5 h-5" />}
            href="/tickets"
          />
          <DashboardStatCard
            label="Dispositivi totali"
            value={ctx.devices.length}
            accent="var(--accent2)"
            sub="totali"
            icon={<Boxes className="w-5 h-5" />}
            href="/inventory"
          />
          <DashboardStatCard
            label="Clienti attivi"
            value={ctx.activeClientsCount}
            accent="var(--purple)"
            sub="nel periodo"
            icon={<TrendingUp className="w-5 h-5" />}
            href="/clients"
          />
          <DashboardStatCard
            label="SLA rispettati"
            value={
              ctx.analytics?.summary?.slaRespectedPct == null
                ? "n/d"
                : `${ctx.analytics.summary.slaRespectedPct}%`
            }
            accent="var(--success)"
            sub={`${ctx.analytics?.summary?.slaRespected ?? 0}/${ctx.analytics?.summary?.slaTotal ?? 0} nel periodo`}
            valueColor="var(--success)"
            icon={<Clock className="w-5 h-5" />}
            href="/tickets"
          />
          <DashboardStatCard
            label="In lavorazione"
            value={ctx.counts["in-progress"]}
            accent="var(--warn)"
            sub="nel periodo"
            valueColor="var(--accent)"
            icon={<Clock className="w-5 h-5" />}
            href={"/tickets?status=in-progress"}
            highlight
          />
          <DashboardStatCard
            label="Pronti"
            value={ctx.counts.ready}
            accent="var(--success)"
            sub="nel periodo"
            valueColor="var(--success)"
            icon={<CircleCheck className="w-5 h-5" />}
            href="/tickets?status=ready"
          />
          <DashboardStatCard
            label="In attesa"
            value={ctx.counts.pending}
            accent="var(--purple)"
            sub="nel periodo"
            valueColor="var(--purple)"
            icon={<Activity className="w-5 h-5" />}
            href={"/tickets?status=pending"}
            highlight
          />
          <DashboardStatCard
            label="Checklist completate"
            value={ctx.checklistStats ? `${ctx.checklistStats.completedPct}%` : "n/d"}
            accent="var(--success)"
            sub={
              ctx.checklistStats
                ? `${ctx.checklistStats.completed}/${ctx.checklistStats.total} totali`
                : "nessun dato"
            }
            valueColor="var(--success)"
            icon={<CircleCheck className="w-5 h-5" />}
            href="/tickets"
          />
          <DashboardStatCard
            label="Soddisfazione clienti"
            value={
              ctx.satisfactionStats?.average == null ? "n/d" : `${ctx.satisfactionStats.average}/5`
            }
            accent="var(--success)"
            sub={ctx.satisfactionStats ? `${ctx.satisfactionStats.count} feedback` : "nessun dato"}
            valueColor="var(--success)"
            icon={<CircleCheck className="w-5 h-5" />}
            href="/tickets"
          />
          <DashboardStatCard
            label="Tempo medio checklist"
            value={ctx.checklistStats?.avgCompletionLabel ?? "n/d"}
            accent="var(--accent)"
            sub="per completamento"
            icon={<Clock className="w-5 h-5" />}
            href="/tickets"
          />
          <DashboardStatCard
            label="Template più usato"
            value={ctx.checklistStats?.topTemplate?.title ?? "n/d"}
            accent="var(--purple)"
            sub={
              ctx.checklistStats?.topTemplate
                ? `${ctx.checklistStats.topTemplate.count} istanze`
                : "nessun dato"
            }
            icon={<ListChecksIcon className="w-5 h-5" />}
            href="/checklist"
          />
          <DashboardStatCard
            label="% checklist per tecnico"
            value={
              ctx.checklistStats?.topTechnician ? `${ctx.checklistStats.topTechnician.pct}%` : "n/d"
            }
            accent="var(--success)"
            sub={
              ctx.checklistStats?.topTechnician
                ? `${ctx.checklistStats.topTechnician.completed}/${ctx.checklistStats.topTechnician.total} completate · ${ctx.checklistStats.topTechnician.id.slice(0, 8)}`
                : "nessun assegnatario"
            }
            icon={<CircleCheck className="w-5 h-5" />}
            href="/tickets"
          />
        </div>
      );

    case "warranty-overview": {
      const warrantyCounts = warrantySummary(ctx.warrantyDevices);
      const expiringRows = ctx.warrantyDevices
        .filter((device) =>
          ["urgent", "expiring"].includes(getWarrantyStatus(device.warranty_expiry_date)),
        )
        .sort((a, b) =>
          String(a.warranty_expiry_date || "").localeCompare(String(b.warranty_expiry_date || "")),
        )
        .slice(0, 8);
      return (
        <div key="warranty-overview" className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          <div className="pc-card lg:col-span-1">
            <div className="pc-card-hd">
              <span className="pc-card-title">Garanzie dispositivi</span>
              <Link
                to="/inventory"
                search={() => ({ warranty: "all" }) as any}
                className="pc-btn pc-btn-ghost pc-btn-sm"
              >
                Inventario <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="pc-card-body grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  ["valid", "In garanzia"],
                  ["expiring", "In scadenza"],
                  ["urgent", "Urgenti"],
                  ["expired", "Scadute"],
                  ["missing", "N/D"],
                ] as [WarrantyStatus, string][]
              ).map(([status, label]) => {
                const meta = WARRANTY_STATUS_META[status];
                return (
                  <div
                    key={status}
                    className="rounded-lg border px-3 py-2"
                    style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                  >
                    <div className="text-[10px] uppercase text-text3">{label}</div>
                    <div
                      className="mt-1 font-mono text-lg font-semibold"
                      style={{ color: meta.color }}
                    >
                      {warrantyCounts[status]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="pc-card lg:col-span-2">
            <div className="pc-card-hd">
              <span className="pc-card-title">Garanzie in scadenza (prossimi 90 giorni)</span>
              <span className="text-[11px] text-text3 font-mono">{expiringRows.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["Asset", "Scadenza", "Stato", "Fornitore"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expiringRows.map((device) => {
                    const status = getWarrantyStatus(device.warranty_expiry_date);
                    const meta = WARRANTY_STATUS_META[status];
                    const days = daysUntil(device.warranty_expiry_date);
                    return (
                      <tr
                        key={device.id}
                        className="border-b cursor-pointer hover:bg-surface2"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => openDeviceDetail(device.id)}
                      >
                        <td className="px-[14px] py-[10px] text-[12.5px]">
                          <span className="font-semibold">{device.model}</span>
                          <div className="font-mono text-[11px] text-text3">
                            {device.serial || device.id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="px-[14px] py-[10px] text-[12px]">
                          {device.warranty_expiry_date ? fmtDate(device.warranty_expiry_date) : "—"}
                          <div className="text-[11px] text-text3">
                            {days == null ? "" : `${days} giorni`}
                          </div>
                        </td>
                        <td className="px-[14px] py-[10px]">
                          <span
                            className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color: meta.color,
                              background: meta.background,
                              borderColor: meta.color,
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-[14px] py-[10px] text-[12px] text-text2">
                          {device.warranty_provider || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {!expiringRows.length && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-text3">
                        Nessuna garanzia in scadenza nei prossimi 90 giorni.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    case "maintenance-overview":
      return <MaintenanceOverviewWidget key="maintenance-overview" />;

    case "analytics-card":
      return (
        <div key="analytics-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Panoramica dispositivi & ticket</h3>
              <div className="text-xs text-text3">
                Trend e widget di riepilogo filtrati per periodo
              </div>
            </div>
            <DateRangePicker
              from={ctx.dateFrom}
              to={ctx.dateTo}
              onChange={(from, to) => {
                ctx.setDateFrom(from);
                ctx.setDateTo(to);
              }}
            />
          </div>
          <PageErrorBoundary>
            <Suspense
              fallback={
                <div className="pc-card pc-card-body text-sm text-text3">
                  Caricamento analytics...
                </div>
              }
            >
              <AnalyticsCard
                analytics={ctx.analytics}
                loading={ctx.analyticsLoading}
                periodLabel={ctx.periodLabel}
                onDownloadPdf={async () => {
                  if (!ctx.analytics) return;
                  const settings = ctx.session?.access_token
                    ? await ctx
                        .loadSettings({
                          data: { accessToken: ctx.session.access_token },
                        })
                        .catch(() => null)
                    : null;
                  const org = settings?.organization_name;
                  await downloadPdf(
                    <AnalyticsReportPdf
                      analytics={ctx.analytics}
                      periodLabel={ctx.periodLabel}
                      organizationName={org}
                      priorityCounts={ctx.priorityCounts}
                    />,
                    buildDownloadFileName("pcready-dashboard-report", "pdf", {
                      dated: true,
                    }),
                  );
                }}
                onDownloadCsv={() => ctx.analytics && downloadAnalyticsCsv(ctx.analytics)}
              />
            </Suspense>
          </PageErrorBoundary>
        </div>
      );

    case "devices-without-ticket":
      return (
        <div key="devices-without-ticket" className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          <div className="pc-card">
            <div className="pc-card-hd">
              <span className="pc-card-title">Dispositivi senza ticket attivo</span>
              <span className="text-[11px] text-text3 font-mono">
                {ctx.devicesWithoutTicket.length}
              </span>
            </div>
            <div className="pc-card-body">
              <div className="flex items-center gap-3">
                <div className="text-[22px] font-bold">{ctx.devicesWithoutTicket.length}</div>
                <div className="flex-1">
                  <DashboardAreaSpark
                    data={computeDailyCounts(
                      ctx.devices,
                      "created_at",
                      ctx.range.days,
                      (d) => d.status === "available",
                    )}
                    color="#3b82f6"
                  />
                </div>
                <Link
                  to="/inventory"
                  search={() => ({ filter: "without_ticket" }) as any}
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                >
                  Vedi dispositivi
                </Link>
              </div>
            </div>
          </div>

          <div className="pc-card">
            <div className="pc-card-hd">
              <span className="pc-card-title">Ticket senza dispositivo associato</span>
              <span className="text-[11px] text-text3 font-mono">
                {ctx.ticketsWithoutDeviceCount}
              </span>
            </div>
            <div className="pc-card-body">
              <div className="flex items-center gap-3">
                <div className="text-[22px] font-bold">{ctx.ticketsWithoutDeviceCount}</div>
                <div className="flex-1">
                  <DashboardAreaSpark
                    data={computeDailyCounts(
                      ctx.tickets.filter(
                        (tt: any) =>
                          !tt.device &&
                          (tt.status as string) !== "archived" &&
                          tt.status !== "ready",
                      ),
                      "created_at",
                      ctx.range.days,
                    )}
                    color="#f97316"
                  />
                </div>
                <Link
                  to="/tickets"
                  search={() => ({ filter: "without_device" }) as any}
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                >
                  Vedi ticket
                </Link>
              </div>
            </div>
          </div>

          <div className="pc-card">
            <div className="pc-card-hd">
              <span className="pc-card-title">Trend: Ticket aperti vs Asset disponibili</span>
              <span className="text-[11px] text-text3 font-mono">{ctx.periodLabel}</span>
            </div>
            <div className="pc-card-body">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <DashboardAreaSparkMulti
                    series={[
                      {
                        data: computeDailyCounts(
                          ctx.tickets.filter((tt: any) => tt.status !== "ready"),
                          "created_at",
                          ctx.range.days,
                        ),
                        color: "#ef4444",
                        label: "Ticket aperti",
                      },
                      {
                        data: computeDailyCounts(
                          ctx.devices.filter((d: any) => d.status === "available"),
                          "created_at",
                          ctx.range.days,
                        ),
                        color: "#10b981",
                        label: "Asset disponibili",
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "tickets-without-device":
    case "trend-chart":
      // These are rendered as part of the "devices-without-ticket" grid group
      return null;

    case "recent-tickets":
      return (
        <div key="recent-tickets" className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
          <div className="pc-card">
            <div className="pc-card-hd">
              <span className="pc-card-title">Ticket recenti</span>
              <Link
                to="/tickets"
                search={() => ({ export: false }) as any}
                className="pc-btn pc-btn-ghost pc-btn-sm"
              >
                Vedi tutti <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {["ID", "Asset", "Stato", "Assegnatario"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                        style={{
                          background: "var(--surface2)",
                          borderColor: "var(--border)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ctx.tickets.slice(0, 6).map((t: any) => (
                    <tr
                      key={t.id}
                      className="border-b cursor-pointer hover:bg-surface2 transition-colors"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => openTicketDetail(t.id)}
                    >
                      <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                        {t.ticket_code}
                      </td>
                      <td className="px-[14px] py-[10px] text-[12.5px]">
                        {dashboardDeviceLabel(t)}
                        <div className="text-[11px] text-text3">{t.client}</div>
                      </td>
                      <td className="px-[14px] py-[10px]">
                        <StatusBadge status={t.status as TicketStatus} />
                      </td>
                      <td className="px-[14px] py-[10px]">
                        <AssigneeChip
                          initials={t.assignee?.initials}
                          name={t.assignee?.full_name}
                        />
                      </td>
                    </tr>
                  ))}
                  {!ctx.tickets.length && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-text3 text-sm">
                        Nessun ticket. Creane uno con il pulsante in alto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pc-card dashboard-widget">
            <div className="pc-card-hd">
              <span className="pc-card-title">Distribuzione stati</span>
              <span className="text-[11px] text-text3 font-mono">{ctx.total} totali</span>
            </div>
            <div className="pc-card-body">
              <div className="flex gap-4 items-center lg:items-stretch">
                <div className="flex-shrink-0 flex items-center justify-center px-2">
                  <Link to="/kanban" className="block hover:opacity-85 transition-opacity">
                    <DashboardDonut
                      data={Object.entries(ctx.counts).map(([s, n]) => ({
                        status: s as TicketStatus,
                        n,
                      }))}
                      total={ctx.total}
                      hideLegend={true}
                    />
                  </Link>
                </div>
                <div className="flex-1 flex items-center">
                  <div className="w-full">
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(ctx.counts)
                        .map(([s, n]) => ({
                          status: s as TicketStatus,
                          n,
                        }))
                        .map((d) => (
                          <Link
                            key={d.status}
                            to="/tickets"
                            search={{ status: d.status }}
                            className="flex items-center justify-between text-[12px] hover:bg-[var(--surface2)] rounded px-1 -mx-1 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{
                                  background: STATUS_META[d.status].color,
                                }}
                              />
                              <span className="text-text2">{STATUS_META[d.status].label}</span>
                            </div>
                            <div className="font-mono text-text3">{d.n}</div>
                          </Link>
                        ))}
                    </div>
                    <div className="text-sm text-text3 mt-3">{ctx.total} ticket totali</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case "status-distribution":
      // This is included within "recent-tickets" grid
      return null;

    case "technician-heatmap":
      return (
        <div key="technician-heatmap" className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
          <TechnicianHeatmapWidget />
          <div className="pc-card">
            <div className="pc-card-hd">
              <span className="pc-card-title">Attivita recente</span>
              <Link to="/automations" className="pc-btn pc-btn-ghost pc-btn-sm">
                Log completo <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="pc-card-body">
              <div className="flex flex-col gap-[7px]">
                {ctx.dedupLogs.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-start gap-[10px] px-[12px] py-[10px] rounded-[7px] text-[12px]"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      title={l.actor?.full_name ?? (l.type === "user" ? "Utente" : "Sistema")}
                      aria-label={`Azione eseguita da: ${l.actor?.full_name ?? (l.type === "user" ? "Utente" : "Sistema")}`}
                      style={{
                        background:
                          l.type === "auto"
                            ? "var(--accent2)"
                            : l.type === "user"
                              ? "var(--success-bg)"
                              : "var(--surface3)",
                        color:
                          l.type === "auto"
                            ? "var(--accent)"
                            : l.type === "user"
                              ? "var(--success)"
                              : "var(--text3)",
                      }}
                    >
                      {l.actor?.initials ??
                        (l.type === "auto" ? "A" : l.type === "user" ? "U" : "-")}
                    </span>
                    <span className="flex-1 text-text2">{l.message}</span>
                    <span className="text-[10.5px] text-text3 font-mono whitespace-nowrap">
                      {fmtDateTime(l.created_at)}
                    </span>
                  </div>
                ))}
                {!ctx.dedupLogs.length && (
                  <div className="text-center text-text3 text-sm py-4">Nessuna attivita</div>
                )}
              </div>
            </div>
          </div>
        </div>
      );

    case "recent-activity":
      // This is included within "technician-heatmap" grid
      return null;

    case "overdue-tickets":
      return (
        <div key="overdue-tickets" className="grid grid-cols-1 gap-[18px]">
          <OverdueTicketsWidget />
        </div>
      );

    case "team-activity":
      return (
        <div key="team-activity" className="grid grid-cols-1 gap-[18px]">
          <TeamActivityWidget />
        </div>
      );

    case "technician-stats":
      return (
        <div key="technician-stats" className="grid grid-cols-1 gap-[18px]">
          <Suspense
            fallback={
              <div className="pc-card pc-card-body text-sm text-text3">
                Caricamento statistiche tecnici...
              </div>
            }
          >
            <TechnicianStatsWidgetLazy />
          </Suspense>
        </div>
      );

    case "critical-events":
      return (
        <div key="critical-events" className="grid grid-cols-1 gap-[18px]">
          <CriticalEventsWidget accessToken={ctx.session?.access_token} />
        </div>
      );

    default:
      return null;
  }
}

function MaintenanceOverviewWidget() {
  const query = useQuery({
    queryKey: ["dashboard", "maintenance-overview"],
    queryFn: fetchMaintenanceDashboard,
  });
  const upcoming = query.data?.upcoming ?? [];
  const overdueCount = query.data?.overdueCount ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
      <div className="pc-card lg:col-span-2">
        <div className="pc-card-hd">
          <span className="pc-card-title">Prossime manutenzioni pianificate</span>
          <Link to="/inventory" className="pc-btn pc-btn-ghost pc-btn-sm">
            Calendario <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["Intervento", "Dispositivo", "Scadenza", "Stato"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map((item: MaintenanceSchedule) => {
                const status = getMaintenanceStatus(item);
                const meta = MAINTENANCE_STATUS_META[status];
                return (
                  <tr
                    key={item.id}
                    className="border-b cursor-pointer hover:bg-surface2"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => openDeviceDetail(item.device_id)}
                  >
                    <td className="px-[14px] py-[10px] text-[12.5px] font-semibold">
                      {item.title}
                    </td>
                    <td className="px-[14px] py-[10px] text-[12px]">
                      {item.device?.model || "Dispositivo"}
                      <div className="font-mono text-[11px] text-text3">
                        {item.device?.serial || item.device_id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-[14px] py-[10px] text-[12px]">
                      {fmtDate(item.next_due_date)}
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          color: meta.color,
                          background: meta.background,
                          borderColor: meta.color,
                        }}
                      >
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!upcoming.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-text3">
                    {query.isLoading
                      ? "Caricamento manutenzioni..."
                      : "Nessuna manutenzione pianificata."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="pc-card">
        <div className="pc-card-hd">
          <span className="pc-card-title">Scadute non eseguite</span>
        </div>
        <div className="pc-card-body">
          <div
            className="text-[32px] font-bold"
            style={{ color: overdueCount ? "#B91C1C" : "var(--success)" }}
          >
            {overdueCount}
          </div>
          <div className="mt-1 text-xs text-text3">
            Manutenzioni con prossima scadenza superata e non completate.
          </div>
          <Link to="/inventory" className="pc-btn pc-btn-primary pc-btn-sm mt-4">
            Apri calendario manutenzioni
          </Link>
        </div>
      </div>
    </div>
  );
}

function warrantySummary(devices: any[]) {
  return devices.reduce(
    (acc, device) => {
      acc[getWarrantyStatus(device.warranty_expiry_date)] += 1;
      return acc;
    },
    { valid: 0, expiring: 0, urgent: 0, expired: 0, missing: 0 } as Record<WarrantyStatus, number>,
  );
}
