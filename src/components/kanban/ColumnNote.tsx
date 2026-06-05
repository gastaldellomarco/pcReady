import { FileText, Pencil, Check } from "lucide-react";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";

/**
 * Inline note area for a Kanban column.
 *
 * When `canEdit` is true the user can click to expand a textarea, type notes,
 * and save on blur / Enter (without shift). Notes are persisted via the parent's
 * save callback and shown to all users.
 */
export function ColumnNote({
  note,
  saving,
  canEdit,
  onSave,
}: {
  note: string;
  saving: boolean;
  canEdit: boolean;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commitRef = useRef(false);

  // Sync when the saved note changes externally
  useEffect(() => {
    if (!editing) setDraft(note);
  }, [note, editing]);

  // Auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editing, draft]);

  function commit() {
    if (commitRef.current) return;
    commitRef.current = true;
    const trimmed = draft.trim();
    if (trimmed !== note) {
      onSave(trimmed);
    }
    setEditing(false);
    // Reset the guard after a tick so subsequent edits can commit again
    setTimeout(() => {
      commitRef.current = false;
    }, 200);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textareaRef.current?.blur();
    }
    if (e.key === "Escape") {
      setDraft(note);
      setEditing(false);
    }
  }

  // ── Empty state (no note, not editing) ──────────────────────────────
  if (!note && !editing) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }}
        className="group flex w-full cursor-text items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[11px] text-text3 transition-colors hover:border-text3 hover:text-text2"
        style={{ borderColor: "var(--border)" }}
      >
        <FileText className="size-3" />
        <span>{saving ? "Salvataggio…" : "Aggiungi nota…"}</span>
      </button>
    );
  }

  // ── Editing state ───────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="relative rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi una nota per questa colonna…"
          aria-label="Nota colonna"
          rows={2}
          className="w-full resize-none rounded-[7px] border-0 bg-transparent px-2.5 py-2 text-[11px] leading-relaxed text-text outline-none placeholder:text-text4"
          autoFocus
        />
        <div
          className="flex items-center justify-between border-t px-2.5 py-1"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="text-[9px] text-text4">
            {saving ? "Salvataggio…" : "Invio per salvare · Esc per annullare"}
          </span>
          <button
            type="button"
            onClick={commit}
            disabled={saving}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors hover:bg-accent/10"
            style={{ color: "var(--accent)" }}
          >
            {saving ? (
              <span className="size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              <Check className="size-3" />
            )}
            {saving ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    );
  }

  // ── Read-only state ─────────────────────────────────────────────────
  return (
    <div
      className="group relative rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <FileText className="size-3 shrink-0" style={{ color: "var(--accent)" }} />
        <span
          className="text-[9.5px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--accent)" }}
        >
          Nota
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDraft(note);
              setEditing(true);
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent/10"
            style={{ color: "var(--accent)" }}
          >
            <Pencil className="h-2.5 w-2.5" />
            Modifica
          </button>
        )}
      </div>
      <p className="whitespace-pre-wrap break-words text-text2">{note}</p>
    </div>
  );
}
