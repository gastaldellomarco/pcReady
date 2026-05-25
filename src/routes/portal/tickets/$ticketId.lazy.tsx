import { createLazyFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusTimeline } from "@/components/portal/StatusTimeline";
import { PageFetchError } from "@/components/page-states";
import { getPortalTicketDetail, submitPortalTicketFeedback } from "@/lib/portal-tickets";

export const Route = createLazyFileRoute("/portal/tickets/$ticketId")({
  component: PortalTicketDetailPage,
});

function PortalTicketDetailPage() {
  const { ticketId } = useParams({ from: "/portal/tickets/$ticketId" });
  const loadTicket = useServerFn(getPortalTicketDetail);
  const submitFeedback = useServerFn(submitPortalTicketFeedback);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const load = useCallback(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    loadTicket({ data: { token, ticketId } })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [loadTicket, ticketId]);

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
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="h-8 w-3/4 max-w-md animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-16 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  const ticket = data.ticket;
  const isClosed = ["ready", "completed", "archived"].includes(ticket.status);

  async function saveFeedback() {
    const token = localStorage.getItem("pcready_portal_token") || "";
    setFeedbackBusy(true);
    try {
      await submitFeedback({ data: { token, ticketId, rating, comment } });
      toast.success("Grazie per il feedback");
      setRetryKey((key) => key + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore invio feedback");
    } finally {
      setFeedbackBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <a href="/portal/tickets" className="text-sm text-muted-foreground hover:text-foreground">
        ← Torna ai ticket
      </a>
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
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
          {ticket.notes || "-"}
        </p>
      </section>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Note pubbliche del tecnico</h2>
        {ticket.public_notes ? (
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {ticket.public_notes}
          </p>
        ) : null}
        {data.publicNotes?.length ? (
          <div className="mt-3 space-y-3">
            {data.publicNotes.map((note: any) => (
              <div key={note.id} className="rounded-md border bg-background p-3 text-sm">
                <div className="mb-1 text-xs text-muted-foreground">
                  {note.author?.full_name || "Tecnico"} ·{" "}
                  {new Date(note.created_at).toLocaleString("it-IT")}
                </div>
                <div className="whitespace-pre-line">{note.content}</div>
              </div>
            ))}
          </div>
        ) : !ticket.public_notes ? (
          <p className="mt-2 text-sm text-muted-foreground">Nessuna nota pubblica disponibile.</p>
        ) : null}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Storico stati</h2>
        <StatusTimeline history={data.history} />
      </section>
      {isClosed && (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Feedback sul ticket</h2>
          {data.feedback ? (
            <div className="mt-2 text-sm text-muted-foreground">
              Valutazione inviata: {"★".repeat(data.feedback.rating)}
              {"☆".repeat(5 - data.feedback.rating)}
              {data.feedback.comment ? (
                <p className="mt-2 whitespace-pre-line">{data.feedback.comment}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <select
                className="pc-input"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} stelle
                  </option>
                ))}
              </select>
              <textarea
                className="pc-input min-h-24 w-full"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Commento opzionale"
              />
              <Button onClick={() => void saveFeedback()} disabled={feedbackBusy}>
                {feedbackBusy ? "Invio..." : "Invia feedback"}
              </Button>
            </div>
          )}
        </section>
      )}
      {isClosed && (
        <a className="pc-btn pc-btn-primary" href={`/portal/documents?ticket=${ticket.id}`}>
          Scarica verbale PDF
        </a>
      )}
    </div>
  );
}
