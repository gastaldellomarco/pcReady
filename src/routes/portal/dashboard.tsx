import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { getPortalDashboard } from "@/lib/portal-tickets";
import { BundleUsageBar } from "@/components/bundles/BundleBadges";
import { formatBundleHours, formatBundleMoney } from "@/lib/bundles";

export const Route = createFileRoute("/portal/dashboard")({
  component: PortalDashboardPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

function portalToken() {
  return typeof window === "undefined" ? "" : localStorage.getItem("pcready_portal_token") || "";
}

function PortalDashboardPage() {
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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [loadDashboard]);

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
          {data.session.branding?.welcomeMessage || "Panoramica ticket e richieste recenti."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ticket aperti" value={data.stats.open} />
        <Stat label="In lavorazione" value={data.stats.inProgress} />
        <Stat label="Risolti questo mese" value={data.stats.resolvedThisMonth} />
      </div>
      <PortalBundles bundles={data.activeBundles ?? []} />
      <section className="space-y-3">
        <h2 className="font-semibold">Ticket recenti</h2>
        {!data.recentTickets?.length ? (
          <PageEmptyState
            variant="portal"
            title="Nessun ticket recente"
            description="Non ci sono ticket da mostrare in questo momento."
          >
            <Button asChild>
              <a href="/portal/tickets/new">Apri nuovo ticket</a>
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
          <a href="/portal/tickets/new">Apri nuovo ticket</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/portal/documents">Scarica documenti</a>
        </Button>
      </div>
    </div>
  );
}

function PortalBundles({ bundles }: { bundles: any[] }) {
  if (!bundles.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Bundle assistenza attivi</h2>
        <p className="text-sm text-muted-foreground">
          Ore residue, scadenza e stato rinnovo dei pacchetti acquistati.
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
                  <h3 className="font-semibold">{bundle.name ?? "Bundle assistenza"}</h3>
                  <p className="text-sm text-muted-foreground">
                    Canone{" "}
                    {formatBundleMoney(
                      assignment.custom_fee ?? bundle.fee ?? 0,
                      bundle.currency ?? "EUR",
                    )}{" "}
                    · SLA risposta{" "}
                    {assignment.custom_sla_response_hours ?? bundle.sla_response_hours ?? "-"}h
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                  {assignment.auto_renew ? "Rinnovo auto" : "Rinnovo manuale"}
                </span>
              </div>
              <div className="mt-4">
                <BundleUsageBar
                  used={usage.used_hours ?? 0}
                  total={includedHours}
                  label="Ore consumate"
                />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <PortalBundleMetric label="Residue" value={formatBundleHours(remainingHours)} />
                <PortalBundleMetric
                  label="Extra"
                  value={formatBundleMoney(usage.extra_amount ?? 0, bundle.currency ?? "EUR")}
                />
                <PortalBundleMetric label="Scadenza" value={assignment.end_date ?? "Nessuna"} />
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
