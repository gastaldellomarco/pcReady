import { useMemo, useRef } from 'react';
import {
  format,
  isToday,
  isSameDay,
  getHours,
  getMinutes,
  differenceInMinutes,
  parseISO,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

import type { CalendarEvent } from '@/lib/queries/calendar';
import { EVENT_TYPE_COLORS } from './eventColors';
import { pcReadyColors } from '@/lib/design-system';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 60; // px per hour
const TOTAL_HOURS = 24;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  techColorMap: Record<string, string>;
  colorMode: 'type' | 'technician';
  onSlotClick: (date: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface EventColors {
  bg: string;
  fg: string;
  border: string;
}

function resolveEventColors(
  event: CalendarEvent,
  techColorMap: Record<string, string>,
  colorMode: 'type' | 'technician',
): EventColors {
  const typeColors = EVENT_TYPE_COLORS[event.event_type];
  let bg = typeColors.bg;
  let fg = typeColors.fg;
  let border = typeColors.border;

  if (colorMode === 'technician' && event.assignee_id && techColorMap[event.assignee_id]) {
    const c = techColorMap[event.assignee_id];
    bg = `${c}22`;
    fg = c;
    border = c;
  }

  if (event.color) {
    bg = `${event.color}22`;
    fg = event.color;
    border = event.color;
  }

  return { bg, fg, border };
}

/** Returns absolute top offset and height (px) for the full 24-hour day grid. */
function positionEvent(event: CalendarEvent): { top: number; height: number } {
  const start = parseISO(event.start_at);
  const end = parseISO(event.end_at);

  const top = (getHours(start) + getMinutes(start) / 60) * HOUR_HEIGHT;
  const durationMin = differenceInMinutes(end, start);
  const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 30);

  return { top, height };
}

// ---------------------------------------------------------------------------
// DayView
// ---------------------------------------------------------------------------

export function DayView({
  currentDate,
  events,
  techColorMap,
  colorMode,
  onSlotClick,
  onEventClick,
}: DayViewProps) {
  const { t } = useTranslation("calendar");
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = isToday(currentDate);

  const hours = useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => i), []);

  const dayEvents = useMemo(
    () => events.filter((e) => !e.all_day && isSameDay(parseISO(e.start_at), currentDate)),
    [events, currentDate],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Day header ──────────────────────────────────────────── */}
      <div
        className={cn('flex flex-shrink-0 items-center px-4 py-3 border-b', today && '')}
        style={{
          borderColor: pcReadyColors.border,
          background: today ? pcReadyColors.primaryLight : pcReadyColors.surface,
        }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: pcReadyColors.textSecondary }}>
            {format(currentDate, 'EEEE', { locale: it })}
          </p>
          <p
            className="text-2xl font-bold leading-none"
            style={{ color: today ? pcReadyColors.primary : pcReadyColors.textPrimary }}
          >
            {format(currentDate, 'd')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: pcReadyColors.textSecondary }}>
            {format(currentDate, 'MMMM yyyy', { locale: it })}
          </p>
        </div>

        <div className="ml-auto text-sm" style={{ color: pcReadyColors.textSecondary }}>
          {t("dayView.eventCount", "{{count}} evento", { count: dayEvents.length })}
        </div>
      </div>

      {/* ── Scrollable time grid ────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Time gutter */}
          <div
            className="w-16 flex-shrink-0 relative border-r"
            style={{ borderColor: pcReadyColors.border }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-xs leading-none"
                style={{
                  top: `${hour * HOUR_HEIGHT - 8}px`,
                  color: pcReadyColors.textMuted,
                }}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Single day column */}
          <div className="flex-1 relative">
            {/* Hour slot grid lines + click targets */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-b hover:bg-blue-50/30 transition-colors cursor-pointer"
                style={{
                  top: `${hour * HOUR_HEIGHT}px`,
                  height: `${HOUR_HEIGHT}px`,
                  borderColor: pcReadyColors.border,
                }}
                onClick={() => onSlotClick(currentDate, hour)}
              />
            ))}

            {/* Timed events — positioned absolutely */}
            {dayEvents.map((event) => {
              const { top, height } = positionEvent(event);
              const colors = resolveEventColors(event, techColorMap, colorMode);
              const typeLabel = EVENT_TYPE_COLORS[event.event_type].label;
              const durationMin = Math.round(
                differenceInMinutes(parseISO(event.end_at), parseISO(event.start_at)),
              );

              return (
                <div
                  key={event.id}
                  className="absolute left-1 right-2 rounded-md px-2 py-1 overflow-hidden z-10 cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
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
                  {/* Title */}
                  <p className="font-semibold text-sm leading-tight truncate">{event.title}</p>

                  {/* Type badge */}
                  {height > 50 && (
                    <span
                      className="inline-block text-xs px-1 rounded mt-0.5"
                      style={{
                        background: colors.border,
                        color: '#fff',
                        fontSize: '10px',
                      }}
                    >
                      {typeLabel}
                    </span>
                  )}

                  {/* Assignee */}
                  {height > 70 && event.assignee_name && (
                    <p className="text-xs mt-0.5 truncate opacity-80">{event.assignee_name}</p>
                  )}

                  {/* Duration */}
                  {height > 90 && (
                    <p className="text-xs mt-0.5 opacity-70">
                      {durationMin >= 60
                        ? `${Math.floor(durationMin / 60)}h ${durationMin % 60 > 0 ? `${durationMin % 60}min` : ''}`
                        : `${durationMin} min`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
