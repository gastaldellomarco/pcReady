import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
  differenceInMinutes,
  parseISO,
} from "date-fns";
import { it } from "date-fns/locale";
import { useMemo, useRef, useState } from "react";

import { pcReadyColors } from "@/lib/design-system";
import { resolveEventColors } from "./eventColors";
import type { CalendarDraftRange } from "./types";
import type { CalendarEvent } from "@/lib/queries/calendar";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 6;
const END_HOUR = 22;
const VISIBLE_HOURS = END_HOUR - START_HOUR; // 16 rows

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  techColorMap: Record<string, string>;
  colorMode: "type" | "technician" | "client";
  onSlotClick: (date: Date, hour: number) => void;
  onSlotRangeSelect?: (range: CalendarDraftRange) => void;
  onEventClick: (event: CalendarEvent) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns top offset and height (in px) for an event within the visible grid. */
function positionEvent(event: CalendarEvent): { top: number; height: number } {
  const start = parseISO(event.start_at);
  const end = parseISO(event.end_at);

  const top = (getHours(start) - START_HOUR + getMinutes(start) / 60) * HOUR_HEIGHT;
  const durationMin = differenceInMinutes(end, start);
  const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 30);

  return { top, height };
}

// ---------------------------------------------------------------------------
// WeekView
// ---------------------------------------------------------------------------

/**
 *
 */
export function WeekView({
  currentDate,
  events,
  techColorMap,
  colorMode,
  onSlotClick,
  onSlotRangeSelect,
  onEventClick,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dayKey: string; startHour: number; endHour: number } | null>(null);

  const days = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const hours = useMemo(() => Array.from({ length: VISIBLE_HOURS }, (_, i) => START_HOUR + i), []);

  // Filter events to only those falling within the visible hour range (non-all-day)
  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      map[key] = events.filter((e) => !e.all_day && isSameDay(parseISO(e.start_at), day));
    }
    return map;
  }, [days, events]);

  function finishDrag(day: Date, dayKey: string, hour: number) {
    if (!drag || drag.dayKey !== dayKey) return;
    const startHour = Math.min(drag.startHour, hour);
    const endHour = Math.max(drag.startHour, hour) + 1;
    const start = new Date(day);
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(day);
    end.setHours(Math.min(endHour, 23), endHour > 23 ? 59 : 0, 0, 0);
    const didDrag = Math.abs(hour - drag.startHour) > 0;
    setDrag(null);
    if (didDrag && onSlotRangeSelect) onSlotRangeSelect({ start, end });
    else onSlotClick(day, hour);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header row ─────────────────────────────────────────── */}
      <div className="flex shrink-0 border-b" style={{ borderColor: pcReadyColors.border }}>
        {/* Time gutter spacer */}
        <div className="w-14 shrink-0" />

        {days.map((day) => {
          const todayDay = isToday(day);
          return (
            <div
              key={format(day, "yyyy-MM-dd")}
              className="flex-1 text-center py-2 border-l"
              style={{
                borderColor: pcReadyColors.border,
                background: todayDay ? pcReadyColors.primaryLight : undefined,
              }}
            >
              <div className="text-xs" style={{ color: pcReadyColors.textSecondary }}>
                {format(day, "EEE", { locale: it })}
              </div>
              <div
                className="text-sm font-semibold"
                style={{ color: todayDay ? pcReadyColors.primary : pcReadyColors.textPrimary }}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable time grid ────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: `${VISIBLE_HOURS * HOUR_HEIGHT}px` }}>
          {/* Time gutter */}
          <div
            className="w-14 shrink-0 relative border-r"
            style={{ borderColor: pcReadyColors.border }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-xs leading-none"
                style={{
                  top: `${(hour - START_HOUR) * HOUR_HEIGHT - 8}px`,
                  color: pcReadyColors.textMuted,
                }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay[key] ?? [];

            return (
              <div
                key={key}
                className="flex-1 relative border-l"
                style={{ borderColor: pcReadyColors.border }}
              >
                {/* Hour slot grid lines + clickable zones */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-b hover:bg-blue-50/40 transition-colors cursor-pointer"
                    style={{
                      top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                      borderColor: pcReadyColors.border,
                    }}
                    onMouseDown={() => setDrag({ dayKey: key, startHour: hour, endHour: hour })}
                    onMouseEnter={() => {
                      if (drag?.dayKey === key) setDrag({ ...drag, endHour: hour });
                    }}
                    onMouseUp={() => finishDrag(day, key, hour)}
                  />
                ))}

                {drag?.dayKey === key && (
                  <div
                    className="absolute left-0.5 right-0.5 rounded border-2 border-dashed pointer-events-none z-20"
                    style={{
                      top: `${(Math.min(drag.startHour, drag.endHour) - START_HOUR) * HOUR_HEIGHT}px`,
                      height: `${(Math.abs(drag.endHour - drag.startHour) + 1) * HOUR_HEIGHT}px`,
                      borderColor: pcReadyColors.primary,
                      background: "rgba(37, 99, 235, 0.08)",
                    }}
                  />
                )}

                {/* Timed events */}
                {dayEvents.map((event) => {
                  const { top, height } = positionEvent(event);
                  const colors = resolveEventColors(event, techColorMap, colorMode);

                  return (
                    <div
                      key={event.id}
                      className="absolute left-0.5 right-0.5 rounded text-xs px-1.5 py-0.5 overflow-hidden z-10 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        background: colors.bg,
                        color: colors.fg,
                        border: `1px solid ${colors.border}`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      <p className="font-medium truncate leading-tight">{event.title}</p>
                      {height > 44 && event.assignee_initials && (
                        <p className="text-xs opacity-75 truncate" style={{ color: colors.fg }}>
                          {event.assignee_initials}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
