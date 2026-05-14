import { createFileRoute, Link } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense } from "react";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketStatus, fmtDateTime } from "@/lib/pcready";
import { StatusBadge, AssigneeChip } from "@/components/pcready/StatusBadge";
import { openTicketDetail } from "@/lib/use-detail";
import { useAuth } from "@/lib/auth-context";
import { useDashboardData } from "@/hooks/useDashboardData";
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
import {
  TrendingUp,
  Activity,
  Boxes,
  Clock,
  CircleCheck,
  ArrowRight,
} from "lucide-react";

const AnalyticsCard = lazy(() =>
  import("@/components/dashboard/AnalyticsCard").then((module) => ({
    default: module.AnalyticsCard,
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

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <DashboardStatCard
          label="Ticket totali"
          value={total}
          accent="var(--accent)"
          sub="totali"
          icon={<Boxes className="w-5 h-5" />}
        />
        <DashboardStatCard
          label="Dispositivi totali"
          value={devices.length}
          accent="var(--accent2)"
          sub="totali"
          icon={<Boxes className="w-5 h-5" />}
        />
        <DashboardStatCard
          label="Clienti attivi"
          value={activeClientsCount}
          accent="var(--purple)"
          sub="nel periodo"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <DashboardStatCard
          label="In lavorazione"
          value={counts["in-progress"]}
          accent="var(--warn)"
          sub="nel periodo"
          valueColor="var(--accent)"
          icon={<Clock className="w-5 h-5" />}
          href={"/tickets?status=in-progress"}
          highlight
        />
        <DashboardStatCard
          label="Pronti"
          value={counts.ready}
          accent="var(--success)"
          sub="nel periodo"
          valueColor="var(--success)"
          icon={<CircleCheck className="w-5 h-5" />}
        />
        <DashboardStatCard
          label="In attesa"
          value={counts.pending}
          accent="var(--purple)"
          sub="nel periodo"
          valueColor="var(--purple)"
          icon={<Activity className="w-5 h-5" />}
          href={"/tickets?status=pending"}
          highlight
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Panoramica dispositivi & ticket</h3>
          <div className="text-xs text-text3">Trend e widget di riepilogo filtrati per periodo</div>
        </div>
        <DateRangePicker
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
      </div>

      <Suspense
        fallback={
          <div className="pc-card pc-card-body text-sm text-text3">Caricamento analytics...</div>
        }
      >
        <AnalyticsCard
          analytics={analytics}
          loading={analyticsLoading}
          periodLabel={periodLabel}
          onDownloadPdf={async () => {
            if (!analytics) return;
            const settings = session?.access_token
              ? await loadSettings({ data: { accessToken: session.access_token } }).catch(
                  () => null,
                )
              : null;
            const org = settings?.organization_name;
            await downloadPdf(
              <AnalyticsReportPdf
                analytics={analytics}
                periodLabel={periodLabel}
                organizationName={org}
              />,
              buildDownloadFileName("pcready-dashboard-report", "pdf", { dated: true }),
            );
          }}
          onDownloadCsv={() => analytics && downloadAnalyticsCsv(analytics)}
        />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Dispositivi senza ticket attivo</span>
            <span className="text-[11px] text-text3 font-mono">{devicesWithoutTicket.length}</span>
          </div>
          <div className="pc-card-body">
            <div className="flex items-center gap-3">
              <div className="text-[22px] font-bold">{devicesWithoutTicket.length}</div>
              <div className="flex-1">
                <DashboardAreaSpark
                  data={computeDailyCounts(
                    devices,
                    "created_at",
                    range.days,
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
            <span className="text-[11px] text-text3 font-mono">{ticketsWithoutDeviceCount}</span>
          </div>
          <div className="pc-card-body">
            <div className="flex items-center gap-3">
              <div className="text-[22px] font-bold">{ticketsWithoutDeviceCount}</div>
              <div className="flex-1">
                <DashboardAreaSpark
                  data={computeDailyCounts(
                    tickets.filter((tt) => !tt.device),
                    "created_at",
                    range.days,
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
            <span className="text-[11px] text-text3 font-mono">{periodLabel}</span>
          </div>
          <div className="pc-card-body">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <DashboardAreaSparkMulti
                  series={[
                    {
                      data: computeDailyCounts(
                        tickets.filter((tt) => tt.status !== "ready"),
                        "created_at",
                        range.days,
                      ),
                      color: "#ef4444",
                      label: "Ticket aperti",
                    },
                    {
                      data: computeDailyCounts(
                        devices.filter((d) => d.status === "available"),
                        "created_at",
                        range.days,
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
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
                      style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 6).map((t) => (
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
                      <AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} />
                    </td>
                  </tr>
                ))}
                {!tickets.length && (
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
            <span className="text-[11px] text-text3 font-mono">{total} totali</span>
          </div>
          <div className="pc-card-body">
            <div className="flex gap-4 items-center lg:items-stretch">
              <div className="flex-shrink-0 flex items-center justify-center px-2">
                <DashboardDonut
                  data={Object.entries(counts).map(([s, n]) => ({ status: s as TicketStatus, n }))}
                  total={total}
                  hideLegend={true}
                />
              </div>
              <div className="flex-1 flex items-center">
                <div className="w-full">
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(counts)
                      .map(([s, n]) => ({ status: s as TicketStatus, n }))
                      .map((d) => (
                        <div
                          key={d.status}
                          className="flex items-center justify-between text-[12px]"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ background: STATUS_META[d.status].color }}
                            />
                            <span className="text-text2">{STATUS_META[d.status].label}</span>
                          </div>
                          <div className="font-mono text-text3">{d.n}</div>
                        </div>
                      ))}
                  </div>
                  <div className="text-sm text-text3 mt-3">{total} ticket totali</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
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
              {dedupLogs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-[10px] px-[12px] py-[10px] rounded-[7px] text-[12px]"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
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
                    {l.actor?.initials ?? (l.type === "auto" ? "A" : l.type === "user" ? "U" : "-")}
                  </span>
                  <span className="flex-1 text-text2">{l.message}</span>
                  <span className="text-[10.5px] text-text3 font-mono whitespace-nowrap">
                    {fmtDateTime(l.created_at)}
                  </span>
                </div>
              ))}
              {!dedupLogs.length && (
                <div className="text-center text-text3 text-sm py-4">Nessuna attivita</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
