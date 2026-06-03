import { Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWidgetAnnotations } from "@/hooks/useWidgetAnnotations";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/pcready";
import type { WidgetAnnotationRow } from "@/lib/widget-annotations";

interface WidgetAnnotationBadgeProps {
  widgetId: string;
}

/**
 * Inline annotation badge rendered on each dashboard widget.
 * Shows a sticky-note icon with a dot indicator when annotations exist.
 * Clicking opens a popover for viewing, adding, editing, and deleting notes.
 */
export function WidgetAnnotationBadge({ widgetId }: WidgetAnnotationBadgeProps) {
  const { session } = useAuth();
  const { annotations, isLoading, create, update, remove, isPending } =
    useWidgetAnnotations(session?.access_token, widgetId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [noteDate, setNoteDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState("");

  const count = annotations.length;

  function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed || !session?.access_token) return;
    create(
      {
        widget_id: widgetId,
        text: trimmed,
        note_date: noteDate || undefined,
      },
      {
        onSuccess: () => {
          setText("");
          setNoteDate("");
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  }

  function startEdit(a: WidgetAnnotationRow) {
    setEditingId(a.id);
    setEditText(a.text);
    setEditDate(a.note_date ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
    setEditDate("");
  }

  function saveEdit(annotationId: string) {
    const trimmed = editText.trim();
    if (!trimmed) return;
    update(
      {
        annotationId,
        updates: {
          text: trimmed,
          note_date: editDate || null,
        },
      },
      {
        onSuccess: () => cancelEdit(),
      },
    );
  }

  function handleDelete(annotationId: string) {
    remove(annotationId);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="absolute top-2 right-2 z-10 flex items-center justify-center size-7 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface2)] max-sm:opacity-100"
          title="Note widget"
          aria-label="Apri note widget"
        >
          <StickyNote className="size-4 text-text2" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[var(--accent)]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex flex-col max-h-[360px]">
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-[13px] font-semibold">Note</span>
            {count > 0 && (
              <span className="text-[11px] text-text3 font-mono">{count}</span>
            )}
          </div>

          <div className="overflow-y-auto flex-1 px-3 py-2 space-y-2">
            {isLoading && (
              <div className="text-[12px] text-text3 py-2">Caricamento...</div>
            )}

            {!isLoading &&
              annotations.map((a) => (
                <div
                  key={a.id}
                  className="group/item rounded-md border px-2 py-1.5"
                  style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                >
                  {editingId === a.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        className="w-full text-[12px] rounded border px-2 py-1 resize-none"
                        style={{ borderColor: "var(--border)", background: "var(--surface1)" }}
                        rows={2}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          className="flex-1 text-[11px] rounded border px-2 py-0.5"
                          style={{ borderColor: "var(--border)", background: "var(--surface1)" }}
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                        <button
                          className="text-[11px] text-[var(--accent)] font-medium"
                          onClick={() => saveEdit(a.id)}
                          disabled={isPending}
                        >
                          Salva
                        </button>
                        <button
                          className="text-[11px] text-text3"
                          onClick={cancelEdit}
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[12.5px] leading-snug text-text1 line-clamp-2">
                        {a.text}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5">
                          {a.note_date && (
                            <span
                              className="inline-block text-[10.5px] rounded-full px-1.5 py-px font-medium"
                              style={{
                                background: "var(--accent2)",
                                color: "var(--accent)",
                              }}
                            >
                              {fmtDate(a.note_date)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <button
                            className="p-0.5 rounded hover:bg-[var(--surface3)]"
                            title="Modifica"
                            onClick={() => startEdit(a)}
                          >
                            <Pencil className="size-3 text-text3" />
                          </button>
                          <button
                            className="p-0.5 rounded hover:bg-[var(--surface3)]"
                            title="Elimina"
                            onClick={() => handleDelete(a.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="size-3 text-[var(--danger)]" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

            {!isLoading && !annotations.length && (
              <div className="text-[12px] text-text3 py-2 text-center">
                Nessuna nota per questo widget.
              </div>
            )}
          </div>

          <div
            className="border-t px-3 py-2 space-y-1.5"
            style={{ borderColor: "var(--border)" }}
          >
            <textarea
              className="w-full text-[12px] rounded border px-2 py-1 resize-none"
              style={{ borderColor: "var(--border)", background: "var(--surface1)" }}
              placeholder="Aggiungi una nota..."
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="flex-1 text-[11px] rounded border px-2 py-0.5"
                style={{ borderColor: "var(--border)", background: "var(--surface1)" }}
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
              />
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm h-7 text-[11px]"
                onClick={handleAdd}
                disabled={!text.trim() || isPending}
              >
                <Plus className="size-3 mr-1" />
                Aggiungi
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
