import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { listPortalTickets } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/tickets/")({
  component: PortalTicketsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

function PortalTicketsPage() {
  const listTickets = useServerFn(listPortalTickets);
  const [tickets, setTickets] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    listTickets({ data: { token } })
      .then((result) => setTickets((result.tickets as any[]) || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [listTickets]);

  useEffect(() => {
    load();
  }, [load, retryKey]);

  if (error) {
    return (
      <PageFetchError variant="portal" message={error} onRetry={() => setRetryKey((k) => k + 1)} />
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
        </div>
        <ListSkeleton rows={5} variant="portal" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ticket</h1>
          <p className="text-sm text-muted-foreground">Consulta lo stato delle richieste aperte.</p>
        </div>
        <Button asChild>
          <a href="/portal/tickets/new">Nuovo ticket</a>
        </Button>
      </div>
      {!tickets.length ? (
        <PageEmptyState
          variant="portal"
          title="Nessun ticket"
          description="Non risultano ticket per il tuo account. Puoi aprirne uno nuovo quando necessario."
        >
          <Button asChild>
            <a href="/portal/tickets/new">Apri ticket</a>
          </Button>
        </PageEmptyState>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}
