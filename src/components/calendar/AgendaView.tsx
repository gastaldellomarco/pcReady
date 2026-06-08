import { format, isToday, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarClock, Link as LinkIcon, Repeat, UserRound } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { pcReadyColors } from "@/lib/design-system";
import { openTicketDetail } from "@/lib/detail-navigation";
import { resolveEventColors } from "./eventColors";
import type { CalendarEvent } from "@/lib/queries/calendar";

interface AgendaViewProps {
  events: CalendarEvent[];
  techColorMap: Record<string, string>;
  colorMode: "type" | "technician" | "client";
  onEventClick: (event: CalendarEvent) => void;
}

function formatTimeRange(event: CalendarEvent) {
  if (event.all_day) return "Tutto il giorno";
  return `${format(parseISO(event.start_at), "HH:mm")} - ${format(parseISO(event.end_at), "HH:mm")}`;
}

/**
 *
 */
export function AgendaView({ events, techColorMap, colorMode, onEventClick }: AgendaViewProps) {
  const { t } = useTranslation("calendar");

  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(parseISO(event.start_at), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (!groups.length) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm"
        style={{ color: pcReadyColors.textSecondary }}
      >
        {t("agenda.empty", "Nessun evento nel periodo selezionato")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50/70">
      <div className="mx-auto max-w-5xl px-4 py-4">
        {groups.map(([dayKey, dayEvents]) => {
          const date = new Date(`${dayKey}T00:00:00`);
          return (
            <section key={dayKey} className="mb-5">
              <div
                className="sticky top-0 z-10 -mx-4 border-b bg-slate-50/95 px-4 py-2 backdrop-blur"
                style={{ borderColor: pcReadyColors.border }}
              >
                <h2
                  className="text-sm font-semibold capitalize"
                  style={{
                    color: isToday(date) ? pcReadyColors.primary : pcReadyColors.textPrimary,
                  }}
                >
                  {format(date, "EEEE d MMMM", { locale: it })}
                </h2>
              </div>
              <div
                className="divide-y rounded-md border bg-white"
                style={{ borderColor: pcReadyColors.border }}
              >
                {dayEvents.map((event) => {
                  const colors = resolveEventColors(event, techColorMap, colorMode);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick(event)}
                      className="grid w-full cursor-pointer grid-cols-[92px_1fr] gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 border-0 bg-transparent"
                      style={{ borderColor: pcReadyColors.border }}
                    >
                      <div className="text-xs font-semibold" style={{ color: colors.fg }}>
                        {formatTimeRange(event)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: colors.border }}
                            aria-hidden="true"
                          />
                          <span
                            className="truncate text-sm font-semibold"
                            style={{ color: pcReadyColors.textPrimary }}
                          >
                            {event.title}
                          </span>
                          {event.is_recurring_instance && (
                            <Repeat
                              className="h-3.5 w-3.5"
                              style={{ color: pcReadyColors.textMuted }}
                            />
                          )}
                          {event.event_type === "availability" && event.availability_status && (
                            <Badge variant="secondary" className="text-[11px]">
                              {t(`availability.${event.availability_status}`)}
                            </Badge>
                          )}
                        </div>
                        <div
                          className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                          style={{ color: pcReadyColors.textSecondary }}
                        >
                          {event.assignee_name && (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="h-3.5 w-3.5" />
                              {event.assignee_name}
                            </span>
                          )}
                          {event.client_name && <span>{event.client_name}</span>}
                          {event.reminders?.length ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {event.reminders.length}
                            </span>
                          ) : null}
                          {event.tickets?.map((ticket) => (
                            <button
                              key={ticket.id}
                              type="button"
                              className="inline-flex items-center gap-1 font-mono font-semibold text-blue-700 hover:underline cursor-pointer"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                openTicketDetail(ticket.id);
                              }}
                            >
                              <LinkIcon className="h-3.5 w-3.5" />
                              {ticket.ticket_code}
                            </button>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
