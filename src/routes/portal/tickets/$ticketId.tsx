import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { StatusTimeline } from "@/components/portal/StatusTimeline";
import { getPortalTicketDetail } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/tickets/$ticketId")({
  component: PortalTicketDetailPage,
});

function PortalTicketDetailPage() {
  const { ticketId } = useParams({ from: "/portal/tickets/$ticketId" });
  const loadTicket = useServerFn(getPortalTicketDetail);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    loadTicket({ data: { token, ticketId } }).then(setData).catch((err) => setError(err.message));
  }, [loadTicket, ticketId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Caricamento...</p>;

  const ticket = data.ticket;

  return (
    <div className="space-y-6">
      <a href="/portal/tickets" className="text-sm text-muted-foreground hover:text-foreground">← Torna ai ticket</a>
      <div className="rounded-lg border bg-card p-4">
        <p className="font-mono text-xs text-muted-foreground">{ticket.ticket_code}</p>
        <h1 className="mt-1 text-2xl font-bold">{ticket.model || "Ticket assistenza"}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Stato: {ticket.status}</span>
          <span>Priorità: {ticket.priority}</span>
          {ticket.assignee?.full_name && <span>Tecnico: {ticket.assignee.full_name}</span>}
        </div>
      </div>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Descrizione</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{ticket.notes || "-"}</p>
      </section>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Note pubbliche del tecnico</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{ticket.public_notes || "Nessuna nota pubblica disponibile."}</p>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Storico stati</h2>
        <StatusTimeline history={data.history} />
      </section>
      {ticket.status === "ready" && (
        <a className="pc-btn pc-btn-primary" href={`/portal/documents?ticket=${ticket.id}`}>Scarica verbale PDF</a>
      )}
    </div>
  );
}
