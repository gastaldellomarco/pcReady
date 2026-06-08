import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  addMinutes,
  differenceInMinutes,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AgendaView } from "@/components/calendar/AgendaView";
import { CalendarToolbar } from "@/components/calendar/CalendarToolbar";
import { DayView } from "@/components/calendar/DayView";
import { getTechColor } from "@/components/calendar/eventColors";
import { EventModal } from "@/components/calendar/EventModal";
import { MonthView } from "@/components/calendar/MonthView";
import { WeekView } from "@/components/calendar/WeekView";
import { LoadingSkeleton } from "@/components/RouteHelpers";
import { useAuth } from "@/lib/auth-context";
import { downloadIcal } from "@/lib/calendar-ical";
import {
  useCalendarEvents,
  useUpdateCalendarEvent,
  type CalendarColorMode,
  type CalendarEvent,
} from "@/lib/queries/calendar";
import { listTechnicians } from "@/lib/technicians";
import type {
  CalendarDraftRange,
  CalendarView,
  TechnicianOption,
} from "@/components/calendar/types";

export const Route = createLazyFileRoute("/_app/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { t } = useTranslation("calendar");
  const { session, profile, canEdit } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [filterTechId, setFilterTechId] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<CalendarColorMode>("type");
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [defaultHour, setDefaultHour] = useState<number | null>(null);
  const [defaultEndDate, setDefaultEndDate] = useState<Date | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);

  // ── Date range based on view ─────────────────────────────────────────────
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (view === "month") {
      return {
        rangeStart: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
        rangeEnd: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
      };
    }
    if (view === "week") {
      return {
        rangeStart: startOfWeek(currentDate, { weekStartsOn: 1 }),
        rangeEnd: endOfWeek(currentDate, { weekStartsOn: 1 }),
      };
    }
    if (view === "agenda") {
      return {
        rangeStart: startOfMonth(currentDate),
        rangeEnd: endOfMonth(currentDate),
      };
    }
    return {
      rangeStart: startOfDay(currentDate),
      rangeEnd: endOfDay(currentDate),
    };
  }, [view, currentDate]);

  // ── Calendar events query ────────────────────────────────────────────────
  const eventsQuery = useCalendarEvents({
    rangeStart,
    rangeEnd,
    assigneeId: filterTechId,
    eventType: null,
  });

  // ── Load technicians on mount ────────────────────────────────────────────
  const loadTechniciansServerFn = useServerFn(listTechnicians);

  useEffect(() => {
    if (!session?.access_token) return;
    loadTechniciansServerFn({ data: { accessToken: session.access_token } })
      .then((t) => setTechnicians(Array.isArray(t) ? t : []))
      .catch(() => toast.error(t("errors.loadTechnicians", "Impossibile caricare i tecnici")));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t and toast are stable; load when token changes
  }, [session?.access_token, loadTechniciansServerFn]);

  // ── Tech color map ───────────────────────────────────────────────────────
  const techColorMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    technicians.forEach((tech, index) => {
      map[tech.id] = getTechColor(index);
    });
    return map;
  }, [technicians]);

  // ── Mutation for drag & drop ─────────────────────────────────────────────
  const updateMutation = useUpdateCalendarEvent();

  // ── Navigation handlers ──────────────────────────────────────────────────
  function handlePrev() {
    setCurrentDate((d) => {
      if (view === "month") return subMonths(d, 1);
      if (view === "week") return subWeeks(d, 1);
      if (view === "agenda") return subMonths(d, 1);
      return subDays(d, 1);
    });
  }

  function handleNext() {
    setCurrentDate((d) => {
      if (view === "month") return addMonths(d, 1);
      if (view === "week") return addWeeks(d, 1);
      if (view === "agenda") return addMonths(d, 1);
      return addDays(d, 1);
    });
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  // ── Event creation handlers ──────────────────────────────────────────────
  function onDayClick(date: Date) {
    setDefaultDate(date);
    setDefaultHour(null);
    setDefaultEndDate(null);
    setSelectedEvent(null);
    setEventModalOpen(true);
  }

  function onSlotClick(date: Date, hour: number) {
    setDefaultDate(date);
    setDefaultHour(hour);
    setDefaultEndDate(null);
    setSelectedEvent(null);
    setEventModalOpen(true);
  }

  function onEventClick(event: CalendarEvent) {
    setSelectedEvent(event);
    setEventModalOpen(true);
  }

  function onSlotRangeSelect(range: CalendarDraftRange) {
    setDefaultDate(range.start);
    setDefaultHour(range.start.getHours());
    setDefaultEndDate(range.end);
    setSelectedEvent(null);
    setEventModalOpen(true);
  }

  // ── Drag & drop handler ──────────────────────────────────────────────────
  function onEventDrop(eventId: string, newDate: Date) {
    const events = eventsQuery.data ?? [];
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const targetId = event.occurrence_id ?? event.id;

    const originalStart = new Date(event.start_at);
    const originalEnd = new Date(event.end_at);
    const durationMinutes = differenceInMinutes(originalEnd, originalStart);

    // Preserve the time-of-day from the original event
    const newStart = new Date(newDate);
    newStart.setHours(
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
    );
    const newEnd = addMinutes(newStart, durationMinutes);

    updateMutation.mutate(
      {
        id: targetId,
        data: {
          start_at: newStart.toISOString(),
          end_at: newEnd.toISOString(),
        },
      },
      {
        onError: () => toast.error(t("errors.moveEvent", "Impossibile spostare l'evento")),
      },
    );
  }

  // ── iCal export ──────────────────────────────────────────────────────────
  function handleExportIcal() {
    const events = eventsQuery.data ?? [];
    const filtered = filterTechId ? events.filter((e) => e.assignee_id === filterTechId) : events;
    downloadIcal(filtered, "pcready-calendario.ics");
  }

  // ── Error handling ───────────────────────────────────────────────────────
  useEffect(() => {
    if (eventsQuery.isError) {
      toast.error(t("errors.loadEvents", "Impossibile caricare gli eventi del calendario"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t and toast are stable
  }, [eventsQuery.isError]);

  // ── Render ───────────────────────────────────────────────────────────────
  const events = eventsQuery.data ?? [];

  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <CalendarToolbar
        currentDate={currentDate}
        view={view}
        technicians={technicians}
        filterTechId={filterTechId}
        colorMode={colorMode}
        onNavigatePrev={handlePrev}
        onNavigateNext={handleNext}
        onNavigateToday={handleToday}
        onViewChange={setView}
        onFilterTechChange={setFilterTechId}
        onColorModeChange={setColorMode}
        onExportIcal={handleExportIcal}
        onCreateEvent={() => {
          setDefaultDate(new Date());
          setDefaultHour(null);
          setSelectedEvent(null);
          setEventModalOpen(true);
        }}
        canEdit={canEdit}
      />
      <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {eventsQuery.isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              background: "rgba(255, 255, 255, 0.6)",
            }}
          >
            <LoadingSkeleton />
          </div>
        )}
        {view === "month" && (
          <MonthView
            currentDate={currentDate}
            events={events}
            techColorMap={techColorMap}
            colorMode={colorMode}
            onDayClick={onDayClick}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
          />
        )}
        {view === "week" && (
          <WeekView
            currentDate={currentDate}
            events={events}
            techColorMap={techColorMap}
            colorMode={colorMode}
            onSlotClick={onSlotClick}
            onSlotRangeSelect={onSlotRangeSelect}
            onEventClick={onEventClick}
          />
        )}
        {view === "day" && (
          <DayView
            currentDate={currentDate}
            events={events}
            techColorMap={techColorMap}
            colorMode={colorMode}
            onSlotClick={onSlotClick}
            onSlotRangeSelect={onSlotRangeSelect}
            onEventClick={onEventClick}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            events={events}
            techColorMap={techColorMap}
            colorMode={colorMode}
            onEventClick={onEventClick}
          />
        )}
      </div>
      <EventModal
        open={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        defaultDate={defaultDate}
        defaultHour={defaultHour}
        defaultEndDate={defaultEndDate}
        technicians={technicians}
        currentUserId={profile?.id ?? ""}
        canEdit={canEdit}
        onSaved={() => {
          setEventModalOpen(false);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
