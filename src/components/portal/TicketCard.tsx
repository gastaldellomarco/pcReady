export function TicketCard({ ticket }: { ticket: any }) {
  return (
    <a
      href={`/portal/tickets/${ticket.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{ticket.ticket_code}</p>
          <h3 className="mt-1 font-semibold">{ticket.title || ticket.model || "Ticket assistenza"}</h3>
          {ticket.public_notes && <p className="mt-2 text-sm text-muted-foreground">{ticket.public_notes}</p>}
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
          {ticket.status_label || ticket.status}
        </span>
      </div>
    </a>
  );
}