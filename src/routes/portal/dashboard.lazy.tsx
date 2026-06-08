import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BundleUsageBar } from "@/components/bundles/BundleBadges";
import { CardGridSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatBundleHours, formatBundleMoney } from "@/lib/bundles";
import { pcReadyColors } from "@/lib/design-system";
import { getPortalDashboard } from "@/lib/portal-tickets";

export const Route = createLazyFileRoute("/portal/dashboard")({
  component: PortalDashboardPage,
});

function portalToken() {
  return typeof window === "undefined" ? "" : localStorage.getItem("pcready_portal_token") || "";
}

const BUNDLE_EXPIRY_WARN_DAYS = 30;

function PortalDashboardPage() {
  const { t } = useTranslation("dashboard");
  const loadDashboard = useServerFn(getPortalDashboard);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(() => {
    const token = portalToken();
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    loadDashboard({ data: { token } })
      .then(setData)
      .catch((err: unknown) => {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "message" in err
              ? String((err as any).message)
              : t("portal.networkError", "Errore di rete");
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [loadDashboard, t]);

  useEffect(() => {
    load();
  }, [load, retryKey]);

  if (error) {
    return (
      <PageFetchError variant="portal" message={error} onRetry={() => setRetryKey((k) => k + 1)} />
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
        </div>
        <CardGridSkeleton cards={3} columnsClass="grid gap-4 sm:grid-cols-3" variant="portal" />
        <ListSectionSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{data.session.clientName}</h1>
        <p className="text-sm text-muted-foreground">
          {data.session.branding?.welcomeMessage ||
            t("portal.welcomeDesc", "Panoramica ticket e richieste recenti.")}
        </p>
      </div>

      {/* ── Bundle / Contract expiry banner ── */}
      <BundleExpiryBanner bundles={data.activeBundles ?? []} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("portal.openTickets", "Ticket aperti")} value={data.stats.open} />
        <Stat label={t("portal.inProgress", "In lavorazione")} value={data.stats.inProgress} />
        <Stat
          label={t("portal.resolvedThisMonth", "Risolti questo mese")}
          value={data.stats.resolvedThisMonth}
        />
      </div>

      {/* ── Ticket volume chart (6 months) ── */}
      {data.ticketVolume?.length > 0 && <TicketVolumeChart data={data.ticketVolume} />}

      {/* ── Service status / uptime ── */}
      {data.services?.length > 0 && <ServiceStatusSection services={data.services} />}

      <PortalBundles bundles={data.activeBundles ?? []} />
      <section className="space-y-3">
        <h2 className="font-semibold">{t("portal.recentTickets", "Ticket recenti")}</h2>
        {!data.recentTickets?.length ? (
          <PageEmptyState
            variant="portal"
            title={t("portal.noRecentTickets", "Nessun ticket recente")}
            description={t(
              "portal.noTicketsToShow",
              "Non ci sono ticket da mostrare in questo momento.",
            )}
          >
            <Button asChild>
              <a href="/portal/tickets/new">{t("portal.openNewTicket", "Apri nuovo ticket")}</a>
            </Button>
          </PageEmptyState>
        ) : (
          <div className="space-y-3">
            {data.recentTickets.map((ticket: any) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </section>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href="/portal/tickets/new">{t("portal.openNewTicket", "Apri nuovo ticket")}</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/portal/documents">{t("portal.downloadDocs", "Scarica documenti")}</a>
        </Button>
      </div>
    </div>
  );
}

// ── Bundle Expiry Banner ──────────────────────────────────────────────────

function BundleExpiryBanner({ bundles }: { bundles: any[] }) {
  if (!bundles.length) return null;

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + BUNDLE_EXPIRY_WARN_DAYS);

  const expiring = bundles.filter((b) => {
    if (!b.end_date) return false;
    const endDate = new Date(b.end_date);
    return endDate <= thirtyDaysFromNow && endDate >= now;
  });

  if (!expiring.length) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {expiring.length === 1 ? "Contratto in scadenza" : "Contratti in scadenza"}
          </h3>
          <ul className="mt-1.5 space-y-1">
            {expiring.map((b) => {
              const bundleName = b.bundle?.name || "Bundle assistenza";
              const endDate = new Date(b.end_date);
              const daysLeft = Math.max(
                1,
                Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
              );
              return (
                <li key={b.id} className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>{bundleName}</strong> — scade {endDate.toLocaleDateString("it-IT")} (
                  {daysLeft} {daysLeft === 1 ? "giorno" : "giorni"} rimanenti)
                  {b.auto_renew ? " · Rinnovo automatico" : ""}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
            Per evitare interruzioni del servizio, contatta il supporto per il rinnovo.
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
              asChild
            >
              <a href="/portal/tickets/new">Contatta il supporto</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ticket Volume Chart ───────────────────────────────────────────────────

function TicketVolumeChart({
  data,
}: {
  data: { label: string; opened: number; closed: number }[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Andamento ticket</h2>
        <p className="text-sm text-muted-foreground">Ticket aperti e chiusi negli ultimi 6 mesi.</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <ChartContainer
          config={{
            opened: { label: "Aperti", color: pcReadyColors.primary },
            closed: { label: "Chiusi", color: pcReadyColors.success },
          }}
          className="h-[200px] w-full"
        >
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="4 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="opened" fill="var(--color-opened)" radius={[4, 4, 0, 0]} barSize={24} />
            <Bar dataKey="closed" fill="var(--color-closed)" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ChartContainer>
      </div>
    </section>
  );
}

// ── Service Status Section ────────────────────────────────────────────────

interface ServiceItem {
  name: string;
  status: "operational" | "degraded" | "outage";
  updated_at?: string;
  note?: string;
}

const SERVICE_STATUS_CONFIG = {
  operational: {
    icon: CheckCircle2,
    label: "Operativo",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/50",
  },
  degraded: {
    icon: AlertCircle,
    label: "Degradato",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
  },
  outage: {
    icon: XCircle,
    label: "Fuori servizio",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800/50",
  },
};

function ServiceStatusSection({ services }: { services: ServiceItem[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Stato dei servizi</h2>
        <p className="text-sm text-muted-foreground">
          Monitoraggio in tempo reale dei servizi gestiti.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const cfg = SERVICE_STATUS_CONFIG[svc.status] || SERVICE_STATUS_CONFIG.operational;
          const Icon = cfg.icon;
          return (
            <div key={svc.name} className={`rounded-lg border p-4 ${cfg.border} ${cfg.bg}`}>
              <div className="flex items-center gap-2.5">
                <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">{svc.name}</h3>
                  <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                </div>
              </div>
              {svc.note && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{svc.note}</p>
              )}
              {svc.updated_at && (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="size-3" />
                  Aggiornato: {new Date(svc.updated_at).toLocaleString("it-IT")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Bundles ───────────────────────────────────────────────────────────────

function PortalBundles({ bundles }: { bundles: any[] }) {
  const { t } = useTranslation("dashboard");
  if (!bundles.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">{t("portal.activeBundles", "Bundle assistenza attivi")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "portal.bundleDesc",
            "Ore residue, scadenza e stato rinnovo dei pacchetti acquistati.",
          )}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {bundles.map((assignment) => {
          const bundle = assignment.bundle ?? {};
          const usage = assignment.usage ?? {};
          const includedHours = assignment.custom_included_hours ?? bundle.included_hours ?? null;
          const remainingHours = usage.remaining_hours ?? null;
          return (
            <div key={assignment.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {bundle.name ?? t("portal.bundleName", "Bundle assistenza")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("portal.bundleFee", "Canone")}{" "}
                    {formatBundleMoney(
                      assignment.custom_fee ?? bundle.fee ?? 0,
                      bundle.currency ?? "EUR",
                    )}{" "}
                    · {t("portal.slaResponse", "SLA risposta")}{" "}
                    {assignment.custom_sla_response_hours ?? bundle.sla_response_hours ?? "-"}h
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                  {assignment.auto_renew
                    ? t("portal.autoRenew", "Rinnovo auto")
                    : t("portal.manualRenew", "Rinnovo manuale")}
                </span>
              </div>
              <div className="mt-4">
                <BundleUsageBar
                  used={usage.used_hours ?? 0}
                  total={includedHours}
                  label={t("portal.hoursUsed", "Ore consumate")}
                />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <PortalBundleMetric
                  label={t("portal.remaining", "Residue")}
                  value={formatBundleHours(remainingHours)}
                />
                <PortalBundleMetric
                  label={t("portal.extra", "Extra")}
                  value={formatBundleMoney(usage.extra_amount ?? 0, bundle.currency ?? "EUR")}
                />
                <PortalBundleMetric
                  label={t("portal.expiry", "Scadenza")}
                  value={assignment.end_date ?? t("portal.none", "Nessuna")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PortalBundleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-2">
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function ListSectionSkeleton() {
  return (
    <section className="space-y-3">
      <div className="h-5 w-40 animate-pulse rounded-md bg-muted" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}
