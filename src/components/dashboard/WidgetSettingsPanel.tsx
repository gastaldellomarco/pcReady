import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DASHBOARD_WIDGETS } from "./widget-registry";
import type { WidgetLayoutItem, WidgetId } from "./widget-registry";

interface WidgetSettingsPanelProps {
  allWidgets: WidgetLayoutItem[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  onToggleVisibility: (widgetId: WidgetId) => void;
  onClose: () => void;
}

function SortableWidgetItem({
  widget,
  onToggleVisibility,
}: {
  widget: WidgetLayoutItem;
  onToggleVisibility: (widgetId: WidgetId) => void;
}) {
  const { t } = useTranslation("dashboard");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const entry = DASHBOARD_WIDGETS.find((w) => w.id === widget.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-surface2 px-3 py-2.5 text-[12.5px]"
    >
      <button
        className="touch-target cursor-grab touch-none text-text3 hover:text-text2 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={t("widgets.dragToReorder", "Trascina per riordinare")}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{entry?.label ?? widget.id}</div>
        <div className="text-[11px] text-text3 truncate">{entry?.description ?? ""}</div>
      </div>
      <button
        className={`touch-target rounded transition-colors hover:bg-surface3 ${
          widget.visible ? "text-accent" : "text-text3"
        }`}
        onClick={() => onToggleVisibility(widget.id)}
        aria-label={widget.visible ? t("widgets.hideWidget", "Nascondi widget") : t("widgets.showWidget", "Mostra widget")}
        title={widget.visible ? t("widgets.hide", "Nascondi") : t("widgets.show", "Mostra")}
      >
        {widget.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </button>
    </div>
  );
}

/**
 *
 */
export function WidgetSettingsPanel({
  allWidgets,
  onReorder,
  onToggleVisibility,
  onClose,
}: WidgetSettingsPanelProps) {
  const { t } = useTranslation("dashboard");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = allWidgets.findIndex((w) => w.id === active.id);
    const newIndex = allWidgets.findIndex((w) => w.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div role="button" tabIndex={-1} className="absolute inset-0 bg-black/30" onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      <div
        className="relative h-full w-full max-w-sm overflow-y-auto border-l border-border bg-white shadow-xl dark:bg-surface"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t("widgets.widgetPanelTitle", "Gestione widget")}</h3>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm p-1"
            onClick={onClose}
            aria-label={t("widgets.close", "Chiudi")}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-[11px] text-text3 mb-3">
            {t("widgets.widgetPanelDesc", "Trascina per riordinare. Usa l'icona occhio per mostrare/nascondere widget.")}
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={allWidgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {allWidgets.map((widget) => (
                  <SortableWidgetItem
                    key={widget.id}
                    widget={widget}
                    onToggleVisibility={onToggleVisibility}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
