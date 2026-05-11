import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { TicketCard } from "@/components/portal/TicketCard";
import { Button } from "@/components/ui/button";
import { listPortalTickets } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/tickets/")({
  component: PortalTicketsPage,
});

function PortalTicketsPage() {
  const listTickets = useServerFn(listPortalTickets);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) window.location.href = "/portal";
    else listTickets({ data: { token } }).then((result) => setTickets(result.tickets as any[]));
  }, [listTickets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ticket</h1>
          <p className="text-sm text-muted-foreground">Consulta lo stato delle richieste aperte.</p>
        </div>
        <Button asChild><a href="/portal/tickets/new">Nuovo ticket</a></Button>
      </div>
      <div className="space-y-3">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</div>
      {!tickets.length && <p className="text-sm text-muted-foreground">Nessun ticket disponibile.</p>}
    </div>
  );
}
