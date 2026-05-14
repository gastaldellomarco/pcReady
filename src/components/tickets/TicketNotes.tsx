import { MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import ticketNotesQueries from "@/lib/queries/ticketNotes";

const { useTicketNotes, useCreateTicketNote } = ticketNotesQueries as any;

interface TicketNote {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: { full_name: string; initials: string } | null;
}

interface TicketNoteAuthor {
  id: string;
  full_name: string;
  initials: string;
}

export function TicketNotes({ ticketId, onChanged }: { ticketId: string; onChanged?: () => void }) {
  const { user, canEdit } = useAuth();
  const notesQuery = useTicketNotes(ticketId);
  const notes = (notesQuery.data ?? []) as TicketNote[];
  const createNoteMut = useCreateTicketNote();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {}, [notesQuery.data]);

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canEdit) return toast.error("Permessi insufficienti");
    const text = content.trim();
    if (!text) return toast.error("Inserisci una nota");
    setSubmitting(true);
    try {
      await createNoteMut.mutateAsync({ ticket_id: ticketId, author_id: user.id, content: text, is_internal: isInternal });
      setContent("");
      toast.success("Nota aggiunta");
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Errore inserimento nota");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="mt-5 rounded-lg p-3"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-text3" />
          <h3 className="text-[13px] font-bold">Note</h3>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-mono text-text3" style={{ background: "var(--surface3)" }}>
            {notes.length}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {notesQuery.isLoading && <div className="text-[12px] text-text3">Caricamento note...</div>}
        {!notesQuery.isLoading && (!notesQuery.data || !notesQuery.data.length) && (
          <div className="text-[12px] text-text3">Nessuna nota inserita</div>
        )}
        {notesQuery.data?.map((note: any) => (
          <article key={note.id} className="rounded-md border bg-background p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
                {note.author?.initials || "??"}
              </span>
              <span className="text-[12px] font-semibold">{note.author?.full_name || "Utente"}</span>
              <span className="text-[11px] text-text3">{fmtDateTime(note.created_at)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${note.is_internal ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {note.is_internal ? "Interna" : "Visibile cliente"}
              </span>
            </div>
            <p className="whitespace-pre-line text-[12.5px] text-text2">{note.content}</p>
          </article>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={addNote} className="space-y-2">
          <textarea
            className="pc-input min-h-20 w-full"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Aggiungi aggiornamento interno o nota visibile al cliente..."
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[12px] text-text2">
              <input
                type="checkbox"
                checked={!isInternal}
                onChange={(event) => setIsInternal(!event.target.checked)}
              />
              Visibile al cliente
            </label>
            <button type="submit" className="pc-btn pc-btn-primary pc-btn-sm" disabled={submitting}>
              {submitting ? "Salvataggio..." : "Aggiungi nota"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
