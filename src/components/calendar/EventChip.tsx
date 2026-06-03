import { cn } from '@/lib/utils';
import { resolveEventColors } from './eventColors';
import type { CalendarEvent } from '@/lib/queries/calendar';

interface EventChipProps {
  event: CalendarEvent;
  techColorMap: Record<string, string>;
  colorMode: 'type' | 'technician' | 'client';
  onClick: (event: CalendarEvent) => void;
}

/**
 *
 */
export function EventChip({ event, techColorMap, colorMode, onClick }: EventChipProps) {
  const { bg, fg, border } = resolveEventColors(event, techColorMap, colorMode);
  const title = [
    event.title,
    event.assignee_name,
    event.client_name,
    ...(event.tickets ?? []).map((ticket) => ticket.ticket_code),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-sm text-xs px-1.5 py-0.5 cursor-pointer',
        'flex items-center gap-1 overflow-hidden',
        'transition-opacity hover:opacity-80 select-none',
      )}
      style={{
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        minHeight: '20px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      title={title || event.title}
    >
      {/* Type indicator dot */}
      <span
        className="flex-shrink-0 size-1.5 rounded-full"
        style={{ background: fg }}
        aria-hidden="true"
      />
      <span className="truncate leading-none">{event.title}</span>
      {event.tickets?.length ? (
        <span className="ml-auto flex-shrink-0 font-mono text-[10px] opacity-80">
          {event.tickets[0].ticket_code}
        </span>
      ) : null}
    </button>
  );
}
