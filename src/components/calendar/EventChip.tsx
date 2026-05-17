import type { CalendarEvent } from '@/lib/queries/calendar';
import { EVENT_TYPE_COLORS } from './eventColors';
import { cn } from '@/lib/utils';

interface EventChipProps {
  event: CalendarEvent;
  techColorMap: Record<string, string>;
  colorMode: 'type' | 'technician';
  onClick: (event: CalendarEvent) => void;
}

export function EventChip({ event, techColorMap, colorMode, onClick }: EventChipProps) {
  const typeColors = EVENT_TYPE_COLORS[event.event_type];

  let bg = typeColors.bg;
  let fg = typeColors.fg;
  let borderColor = typeColors.border;

  // Override with technician color if applicable
  if (colorMode === 'technician' && event.assignee_id && techColorMap[event.assignee_id]) {
    const techColor = techColorMap[event.assignee_id];
    bg = `${techColor}22`; // ~13% opacity background
    fg = techColor;
    borderColor = techColor;
  }

  // Override with custom event color if set
  if (event.color) {
    bg = `${event.color}22`;
    fg = event.color;
    borderColor = event.color;
  }

  return (
    <div
      className={cn(
        'w-full rounded-sm text-xs px-1.5 py-0.5 cursor-pointer',
        'flex items-center gap-1 overflow-hidden',
        'transition-opacity hover:opacity-80 select-none',
      )}
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${borderColor}`,
        minHeight: '20px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      title={event.title}
    >
      {/* Type indicator dot */}
      <span
        className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ background: fg }}
        aria-hidden="true"
      />
      <span className="truncate leading-none">{event.title}</span>
    </div>
  );
}
