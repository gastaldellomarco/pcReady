import { useTranslation } from "react-i18next";
import { fmtDateTime } from "@/lib/pcready";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  "in-progress": "bg-blue-100 text-blue-800",
  testing: "bg-purple-100 text-purple-800",
  ready: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-100 text-slate-700",
};

/**
 *
 */
export function TicketCard({ ticket }: { ticket: any }) {
  const { t } = useTranslation("tickets");
  return (
    <a
      href={`/portal/tickets/${ticket.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{ticket.ticket_code}</p>
          <h3 className="mt-1 font-semibold">
            {ticket.title || ticket.model || t("card.titleFallback", "Ticket assistenza")}
          </h3>
          {ticket.public_notes && (
            <p className="mt-2 text-sm text-muted-foreground">{ticket.public_notes}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[ticket.status] || "bg-secondary"}`}
        >
          {ticket.status_label || ticket.status}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{t("card.priority", "Priorità:")} {ticket.priority}</span>
        {ticket.assignee?.full_name ? <span>{t("card.technician", "Tecnico:")} {ticket.assignee.full_name}</span> : null}
        <span>{t("card.opened", "Aperto:")} {fmtDateTime(ticket.created_at)}</span>
        {ticket.closed_at ? <span>{t("card.closed", "Chiuso:")} {fmtDateTime(ticket.closed_at)}</span> : null}
      </div>
    </a>
  );
}
