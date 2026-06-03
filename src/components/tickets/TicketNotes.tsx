import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TicketAttachments } from "@/components/tickets/TicketAttachments";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import { uploadTicketAttachment } from "@/lib/queries/ticketAttachments";
import ticketNotesQueries from "@/lib/queries/ticketNotes";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";

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

/**
 *
 */
export function TicketNotes({ ticketId, onChanged }: { ticketId: string; onChanged?: () => void }) {
  const { t } = useTranslation("tickets");
  const { user, canEdit, session } = useAuth();
  const notesQuery = useTicketNotes(ticketId);
  const notes = (notesQuery.data ?? []) as TicketNote[];
  const createNoteMut = useCreateTicketNote();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const loadTechnicians = useServerFn(listTechnicians);

  useEffect(() => {
    if (!session?.access_token) return;
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }, [session?.access_token, loadTechnicians]);

  const mentionMatch = content.match(/(^|\s)@([^@\s]*)$/);
  const mentionQuery = mentionMatch?.[2]?.toLowerCase() ?? "";
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    return technicians
      .filter((tech) => tech.full_name.toLowerCase().includes(mentionQuery))
      .slice(0, 6);
  }, [mentionMatch, mentionQuery, technicians]);

  function applyMention(tech: TechnicianOption) {
    setContent((value) => value.replace(/(^|\s)@([^@\s]*)$/, `$1@${tech.full_name} `));
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    const text = content.trim();
    if (!text) return toast.error(t("notes.enterNote", "Inserisci una nota"));
    setSubmitting(true);
    try {
      const note = await createNoteMut.mutateAsync({
        ticket_id: ticketId,
        author_id: user.id,
        content: text,
        is_internal: isInternal,
      });
      for (const file of files) {
        await uploadTicketAttachment({ ticketId, noteId: note?.id, file, uploadedBy: user.id });
      }
      setContent("");
      setFiles([]);
      toast.success(t("notes.addSuccess", "Nota aggiunta"));
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || t("notes.addError", "Errore inserimento nota"));
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
          <MessageSquare className="size-4 text-text3" />
          <h3 className="text-[13px] font-bold">{t("notes.title", "Note")}</h3>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-mono text-text3"
            style={{ background: "var(--surface3)" }}
          >
            {notes.length}
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {notesQuery.isLoading && <div className="text-[12px] text-text3">{t("notes.loadingText", "Caricamento note...")}</div>}
        {!notesQuery.isLoading && (!notesQuery.data || !notesQuery.data.length) && (
          <div className="text-[12px] text-text3">{t("notes.emptyText", "Nessuna nota inserita")}</div>
        )}
        {notesQuery.data?.map((note: any) => (
          <article
            key={note.id}
            className="rounded-md border p-3"
            style={{
              borderColor: note.is_internal ? "rgba(217,119,6,.35)" : "var(--border)",
              background: note.is_internal ? "rgba(253, 230, 138, .25)" : "var(--background)",
            }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
                {note.author?.initials || "??"}
              </span>
              <span className="text-[12px] font-semibold">
                {note.author?.full_name || t("timeTracking.user", "Utente")}
              </span>
              <span className="text-[11px] text-text3">{fmtDateTime(note.created_at)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${note.is_internal ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
              >
                {note.is_internal ? t("notes.internal", "Interna") : t("notes.visibleToClient", "Visibile cliente")}
              </span>
            </div>
            <p className="whitespace-pre-line text-[12.5px] text-text2">{note.content}</p>
            <div className="mt-2">
              <TicketAttachments ticketId={ticketId} noteId={note.id} compact />
            </div>
          </article>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={addNote} className="space-y-2">
          <div className="relative">
            <textarea
              className="pc-input min-h-20 w-full"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t("notes.placeholder", "Aggiungi aggiornamento interno o nota visibile al cliente... usa @nome per menzionare un tecnico")}
              aria-label={t("notes.noteLabel", "Testo della nota")}
            />
            {mentionSuggestions.length > 0 && (
              <div
                className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-md border bg-background shadow-lg"
                style={{ borderColor: "var(--border)" }}
              >
                {mentionSuggestions.map((tech) => (
                  <button
                    key={tech.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-surface2"
                    onClick={() => applyMention(tech)}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
                      {tech.initials}
                    </span>
                    <span>{tech.full_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="pc-btn pc-btn-ghost pc-btn-sm cursor-pointer">
              <Paperclip className="size-3" /> {t("notes.attachFiles", "Allegati nota")}
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files)
                    setFiles((prev) => [...prev, ...Array.from(event.target.files!)]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {files.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]"
                style={{ background: "var(--surface3)" }}
              >
                {file.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[12px] text-text2">
              <input
                type="checkbox"
                checked={!isInternal}
                onChange={(event) => setIsInternal(!event.target.checked)}
              />
              {t("notes.publishVisibleLabel", "Pubblica / visibile al cliente")}
            </label>
            <button type="submit" className="pc-btn pc-btn-primary pc-btn-sm" disabled={submitting}>
              {submitting ? t("notes.saving", "Salvataggio...") : t("notes.addNote", "Aggiungi nota")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
