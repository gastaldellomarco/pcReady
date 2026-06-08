import { useQueryClient } from "@tanstack/react-query";
import { History, Pencil, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/page-states";
import { Modal } from "@/components/pcready/Modal";
import { Field } from "@/components/ui/form-field";
import { errorMessage } from "@/lib/errors";
import { fmtDate } from "@/lib/pcready";
import queries from "@/lib/queries/clients";

/**
 *
 */
export function ClientNotesPanel({
  clientId,
  canEdit,
  canDelete,
  userId,
}: {
  clientId: string;
  canEdit: boolean;
  canDelete: boolean;
  userId: string | null;
}) {
  const { t } = useTranslation("clients");
  const qc = useQueryClient();
  const notesQuery = (queries as any).useClientNotes(clientId);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const revisionsQuery = (queries as any).useClientNoteRevisions(historyNoteId);
  const notes = (notesQuery.data ?? []) as import("@/lib/queries/clients").ClientNote[];

  async function saveNote() {
    if (!canEdit || !content.trim()) return;
    setBusy(true);
    try {
      if (editingId) await (queries as any).updateClientNote(editingId, content, userId);
      else await (queries as any).createClientNote(clientId, content, userId);
      setContent("");
      setEditingId(null);
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "notes"] });
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "activity"] });
      toast.success(t("notes.saved", "Nota salvata"));
    } catch (error) {
      toast.error(errorMessage(error, t("notes.saveError", "Errore salvataggio nota")));
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(noteId: string) {
    if (!canDelete) return;
    setBusy(true);
    try {
      await (queries as any).deleteClientNote(noteId);
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "notes"] });
      toast.success(t("notes.deleted", "Nota eliminata"));
    } catch (error) {
      toast.error(errorMessage(error, t("notes.deleteError", "Errore eliminazione nota")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card-body space-y-4">
      <div
        className="rounded-md border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <Field label={t("notes.editorLabel", "Nota interna")}>
          <textarea
            className="pc-input min-h-[110px]"
            value={content}
            disabled={!canEdit || busy}
            maxLength={5000}
            onChange={(event) => setContent(event.target.value)}
          />
        </Field>
        <div className="mt-3 flex justify-end gap-2">
          {editingId && (
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              type="button"
              onClick={() => {
                setEditingId(null);
                setContent("");
              }}
            >
              {t("form.cancel", "Annulla")}
            </button>
          )}
          <button
            className="pc-btn pc-btn-primary pc-btn-sm"
            type="button"
            disabled={!canEdit || busy || !content.trim()}
            onClick={() => void saveNote()}
          >
            <Save className="size-3" />{" "}
            {editingId ? t("notes.update", "Aggiorna nota") : t("notes.add", "Aggiungi nota")}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {notesQuery.isLoading ? (
          <ListSkeleton rows={3} variant="app" />
        ) : notes.length ? (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border p-3"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-xs text-text3">
                  {note.author?.full_name || t("notes.unknownAuthor", "Autore non disponibile")} -{" "}
                  {fmtDate(note.updated_at)}
                </div>
                <div className="flex gap-1">
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-xs"
                    type="button"
                    onClick={() => setHistoryNoteId(note.id)}
                  >
                    <History className="size-3" /> {t("notes.history", "Storico")}
                  </button>
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-xs"
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      setEditingId(note.id);
                      setContent(note.content);
                    }}
                  >
                    <Pencil className="size-3" /> {t("form.edit", "Modifica")}
                  </button>
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-xs"
                    type="button"
                    disabled={!canDelete}
                    onClick={() => void removeNote(note.id)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text2">{note.content}</p>
            </div>
          ))
        ) : (
          <div
            className="rounded-md border border-dashed p-8 text-center text-sm text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            {t("notes.empty", "Nessuna nota interna per questo cliente.")}
          </div>
        )}
      </div>
      <Modal
        open={!!historyNoteId}
        onClose={() => setHistoryNoteId(null)}
        title={t("notes.historyTitle", "Storico modifiche")}
      >
        <div className="space-y-2">
          {revisionsQuery.isLoading ? (
            <ListSkeleton rows={3} variant="app" />
          ) : ((revisionsQuery.data ?? []) as import("@/lib/queries/clients").ClientNoteRevision[])
              .length ? (
            (
              (revisionsQuery.data ?? []) as import("@/lib/queries/clients").ClientNoteRevision[]
            ).map((revision) => (
              <div
                key={revision.id}
                className="rounded-md border p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-xs text-text3">
                  {revision.author?.full_name || "-"} - {fmtDate(revision.changed_at)}
                </div>
                <div className="mt-2 text-xs text-text3">{t("notes.previous", "Prima")}</div>
                <p className="whitespace-pre-wrap text-sm text-text2">
                  {revision.previous_content}
                </p>
              </div>
            ))
          ) : (
            <div className="text-sm text-text3">
              {t("notes.noRevisions", "Nessuna modifica registrata.")}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
