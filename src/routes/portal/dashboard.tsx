import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { getPortalDashboard } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/dashboard")({
  component: PortalDashboardPage,
});

function portalToken() {
  return typeof window === "undefined" ? "" : localStorage.getItem("pcready_portal_token") || "";
}

function PortalDashboardPage() {
  const loadDashboard = useServerFn(getPortalDashboard);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = portalToken();
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    loadDashboard({ data: { token } }).then(setData).catch((err) => setError(err.message));
  }, [loadDashboard]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Caricamento...</p>;

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
        <div className="space-y-3">{data.recentTickets.map((ticket: any) => <TicketCard key={ticket.id} ticket={ticket} />)}</div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button asChild><a href="/portal/tickets/new">Apri nuovo ticket</a></Button>
        <Button variant="outline" asChild><a href="/portal/documents">Scarica documenti</a></Button>
      </div>
    </div>
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
