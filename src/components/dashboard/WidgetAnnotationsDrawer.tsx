import { Pencil, StickyNote, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DASHBOARD_WIDGETS, type WidgetId } from "@/components/dashboard/widget-registry";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useWidgetAnnotations } from "@/hooks/useWidgetAnnotations";
import { useAuth } from "@/lib/auth-context";
import { fmtDate, fmtDateTime } from "@/lib/pcready";
import type { WidgetAnnotationRow } from "@/lib/widget-annotations";

interface WidgetAnnotationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WIDGET_LABELS = new Map(
  DASHBOARD_WIDGETS.map((w) => [w.id, w.label]),
);

function widgetLabel(widgetId: string) {
  return WIDGET_LABELS.get(widgetId as WidgetId) ?? widgetId;
}

/**
 * Aggregated annotations drawer listing all personal widget notes.
 * Groups notes by widget with tab-based filtering.
 * Provides inline editing and deletion of annotations.
 */
export function WidgetAnnotationsDrawer({ open, onOpenChange }: WidgetAnnotationsDrawerProps) {
  const { session } = useAuth();
  const { annotations, isLoading, update, remove, isPending } =
    useWidgetAnnotations(session?.access_token);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editDate, setEditDate] = useState("");

  const widgetIdsWithNotes = useMemo(() => {
    const ids = new Set<string>();
    annotations.forEach((a) => ids.add(a.widget_id));
    return Array.from(ids).sort();
  }, [annotations]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return annotations;
    return annotations.filter((a) => a.widget_id === activeTab);
  }, [annotations, activeTab]);

  const grouped = useMemo(() => {
    const map = new Map<string, WidgetAnnotationRow[]>();
    filtered.forEach((a) => {
      const list = map.get(a.widget_id) || [];
      list.push(a);
      map.set(a.widget_id, list);
    });
    return map;
  }, [filtered]);

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh] overflow-y-auto px-4 pb-8 pt-2 safe-area-bottom">
        <DrawerHeader className="px-0">
          <DrawerTitle className="text-[16px] flex items-center gap-2">
            <StickyNote className="size-4" />
            Le mie annotazioni
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-4">
          {isLoading && (
            <div className="text-sm text-text3 py-8 text-center">
              Caricamento annotazioni...
            </div>
          )}

          {!isLoading && !annotations.length && (
            <div className="text-sm text-text3 py-8 text-center space-y-2">
              <StickyNote className="size-8 mx-auto opacity-30" />
              <p>Nessuna annotazione.</p>
              <p className="text-xs">
                Clicca l'icona 📝 su un widget per aggiungerne una.
              </p>
            </div>
          )}

          {!isLoading && annotations.length > 0 && (
            <>
              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                <button
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    activeTab === "all"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--surface2)] text-text2 hover:bg-[var(--surface3)]"
                  }`}
                  onClick={() => setActiveTab("all")}
                >
                  Tutti ({annotations.length})
                </button>
                {widgetIdsWithNotes.map((id) => (
                  <button
                    key={id}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      activeTab === id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface2)] text-text2 hover:bg-[var(--surface3)]"
                    }`}
                    onClick={() => setActiveTab(id)}
                  >
                    {widgetLabel(id)}
                  </button>
                ))}
              </div>

              {/* Grouped notes */}
              {Array.from(grouped.entries()).map(([widgetId, notes]) => (
                <div key={widgetId}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text3 mb-2">
                    {widgetLabel(widgetId)}
                  </h4>
                  <div className="space-y-2">
                    {notes.map((a) => (
                      <div
                        key={a.id}
                        className="group/item rounded-lg border px-3 py-2.5"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface2)",
                        }}
                      >
                        {editingId === a.id ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full text-[13px] rounded border px-2 py-1.5 resize-none"
                              style={{
                                borderColor: "var(--border)",
                                background: "var(--surface1)",
                              }}
                              rows={2}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                className="flex-1 text-[12px] rounded border px-2 py-1"
                                style={{
                                  borderColor: "var(--border)",
                                  background: "var(--surface1)",
                                }}
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                              <button
                                className="text-[12px] text-[var(--accent)] font-medium"
                                onClick={() => saveEdit(a.id)}
                                disabled={isPending}
                              >
                                Salva
                              </button>
                              <button
                                className="text-[12px] text-text3"
                                onClick={cancelEdit}
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[13px] leading-relaxed text-text1">
                              {a.text}
                            </p>
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="flex items-center gap-2">
                                {a.note_date && (
                                  <span
                                    className="inline-block text-[11px] rounded-full px-2 py-px font-medium"
                                    style={{
                                      background: "var(--accent2)",
                                      color: "var(--accent)",
                                    }}
                                  >
                                    {fmtDate(a.note_date)}
                                  </span>
                                )}
                                <span className="text-[10.5px] text-text3 font-mono">
                                  {fmtDateTime(a.created_at)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button
                                  className="p-1 rounded hover:bg-[var(--surface3)]"
                                  title="Modifica"
                                  onClick={() => startEdit(a)}
                                >
                                  <Pencil className="size-3.5 text-text3" />
                                </button>
                                <button
                                  className="p-1 rounded hover:bg-[var(--surface3)]"
                                  title="Elimina"
                                  onClick={() => handleDelete(a.id)}
                                  disabled={isPending}
                                >
                                  <Trash2 className="size-3.5 text-[var(--danger)]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
