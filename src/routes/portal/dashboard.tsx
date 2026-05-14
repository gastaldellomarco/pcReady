import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { getPortalDashboard } from "@/lib/portal-tickets";

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
        <p className="text-sm text-muted-foreground">Panoramica ticket e richieste recenti.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ticket aperti" value={data.stats.open} />
        <Stat label="In lavorazione" value={data.stats.inProgress} />
        <Stat label="Risolti questo mese" value={data.stats.resolvedThisMonth} />
      </div>
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
