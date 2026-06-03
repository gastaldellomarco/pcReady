import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { listPortalTickets, listPortalDevices } from "@/lib/portal-tickets";

export const Route = createLazyFileRoute("/portal/tickets/")({
  component: PortalTicketsPage,
});

function PortalTicketsPage() {
  const listTickets = useServerFn(listPortalTickets);
  const loadDevices = useServerFn(listPortalDevices);
  const [tickets, setTickets] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<"all" | "open" | "in-progress" | "completed">("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "status" | "priority">("created_at");
  const [deviceId, setDeviceId] = useState("");

  const load = useCallback(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    listTickets({ data: { token, status, q, sortBy, sortDir: "desc", deviceId: deviceId || null } })
      .then((result) => setTickets((result.tickets as any[]) || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [listTickets, q, sortBy, status, deviceId]);

  useEffect(() => {
    load();
  }, [load, retryKey]);

  // Load devices for filter
  useEffect(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) return;
    loadDevices({ data: { token } })
      .then((result) => setDevices((result.devices as any[]) || []))
      .catch(() => setDevices([]));
  }, [loadDevices]);

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
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="pc-input"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Cerca codice o titolo..."
        />
        <select
          className="pc-input"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">Tutti</option>
          <option value="open">Aperti</option>
          <option value="in-progress">In lavorazione</option>
          <option value="completed">Completati</option>
        </select>
        <select
          className="pc-input"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
        >
          <option value="created_at">Ordina per data</option>
          <option value="status">Ordina per stato</option>
          <option value="priority">Ordina per priorità</option>
        </select>
        <select
          className="pc-input"
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
        >
          <option value="">Tutti i dispositivi</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.model} · {device.serial || device.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </div>
      {!tickets.length ? (
        <PageEmptyState
          variant="portal"
          title="Nessun ticket"
          description={
            deviceId
              ? "Nessun ticket trovato per il dispositivo selezionato."
              : "Non risultano ticket per il tuo account. Puoi aprirne uno nuovo quando necessario."
          }
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
