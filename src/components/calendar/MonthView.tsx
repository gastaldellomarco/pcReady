import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import type { CalendarEvent } from "@/lib/queries/calendar";
import { pcReadyColors } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { EventChip } from "./EventChip";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  techColorMap: Record<string, string>;
  colorMode: "type" | "technician";
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventDrop: (eventId: string, newDate: Date) => void;
}

// ---------------------------------------------------------------------------
// Draggable chip wrapper
// ---------------------------------------------------------------------------

interface DraggableChipProps {
  event: CalendarEvent;
  techColorMap: Record<string, string>;
  colorMode: "type" | "technician";
  onEventClick: (event: CalendarEvent) => void;
}

function DraggableChip({ event, techColorMap, colorMode, onEventClick }: DraggableChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
    >
      <EventChip
        event={event}
        techColorMap={techColorMap}
        colorMode={colorMode}
        onClick={onEventClick}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable day cell
// ---------------------------------------------------------------------------

interface DroppableDayProps {
  date: Date;
  dayEvents: CalendarEvent[];
  isCurrentMonth: boolean;
  techColorMap: Record<string, string>;
  colorMode: "type" | "technician";
  onDayClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

function DroppableDay({
  date,
  dayEvents,
  isCurrentMonth,
  techColorMap,
  colorMode,
  onDayClick,
  onEventClick,
}: DroppableDayProps) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dateKey}`, data: { date } });

  const today = isToday(date);
  const visible = dayEvents.slice(0, 3);
  const extra = dayEvents.length - 3;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-25 p-1 border-b border-r flex flex-col cursor-pointer",
        !isCurrentMonth && "opacity-40",
        isOver && "ring-2 ring-inset ring-blue-400",
      )}
      style={{
        background: isOver
          ? pcReadyColors.primaryLight
          : !isCurrentMonth
            ? pcReadyColors.surface
            : pcReadyColors.card,
        borderColor: pcReadyColors.border,
      }}
      onClick={() => onDayClick(date)}
    >
      {/* Date number */}
      <div className="flex justify-end mb-1">
        <span
          className={cn(
            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
            today ? "font-bold text-white" : "",
          )}
          style={
            today ? { background: pcReadyColors.primary } : { color: pcReadyColors.textPrimary }
          }
        >
          {format(date, "d")}
        </span>
      </div>

      {/* Events list */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        {visible.map((ev) => (
          <DraggableChip
            key={ev.id}
            event={ev}
            techColorMap={techColorMap}
            colorMode={colorMode}
            onEventClick={onEventClick}
          />
        ))}
        {extra > 0 && (
          <span
            className="text-xs px-1.5 cursor-default"
            style={{ color: pcReadyColors.textSecondary }}
          >
            +{extra} altri
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MonthView
// ---------------------------------------------------------------------------

const DAY_HEADERS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function MonthView({
  currentDate,
  events,
  techColorMap,
  colorMode,
  onDayClick,
  onEventClick,
  onEventDrop,
}: MonthViewProps) {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  // Build the 6×7 grid of days
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentDate]);

  // Group events by ISO date key
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const key = format(new Date(ev.start_at), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  function handleDragStart(e: DragStartEvent) {
    const ev = e.active.data.current?.event as CalendarEvent | undefined;
    if (ev) setActiveEvent(ev);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveEvent(null);
    const { active, over } = e;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith("day-")) return;

    const dateStr = overId.replace("day-", ""); // "YYYY-MM-DD"
    const targetDate = new Date(`${dateStr}T00:00:00`);
    onEventDrop(String(active.id), targetDate);
  }

  function handleDragCancel() {
    setActiveEvent(null);
  }

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col h-full select-none">
        {/* Day-of-week headers */}
        <div
          className="grid grid-cols-7 border-l border-t"
          style={{ borderColor: pcReadyColors.border }}
        >
          {DAY_HEADERS.map((header) => (
            <div
              key={header}
              className="text-center text-xs font-semibold py-2 border-r border-b"
              style={{
                color: pcReadyColors.textSecondary,
                background: pcReadyColors.surface,
                borderColor: pcReadyColors.border,
              }}
            >
              {header}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div
          className="grid grid-cols-7 border-l flex-1"
          style={{ borderColor: pcReadyColors.border }}
        >
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            return (
              <DroppableDay
                key={key}
                date={day}
                dayEvents={eventsByDay[key] ?? []}
                isCurrentMonth={isSameMonth(day, currentDate)}
                techColorMap={techColorMap}
                colorMode={colorMode}
                onDayClick={onDayClick}
                onEventClick={onEventClick}
              />
            );
          })}
        </div>
      </div>

      {/* Drag overlay — shows a chip preview while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeEvent ? (
          <div className="shadow-lg rounded-sm opacity-95 pointer-events-none w-32">
            <EventChip
              event={activeEvent}
              techColorMap={techColorMap}
              colorMode={colorMode}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
