import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "./keys";
import {
  fetchCalendarEvents,
  fetchCalendarTicketOptions,
  fetchCalendarClientOptions,
  createCalendarEvent,
  updateCalendarEvent,
  updateRecurringOccurrence,
  deleteCalendarEvent,
  type CalendarEventType,
  type CalendarColorMode,
  type RecurrenceFrequency,
  type ReminderChannel,
  type AvailabilityStatus,
  type CalendarClientOption,
  type CalendarTicketLink,
  type CalendarReminder,
  type CalendarEvent,
  type CalendarEventFilters,
  type CreateCalendarEventData,
  type UpdateCalendarEventData,
} from "@/lib/data/calendar";

// ── Re-export types ──────────────────────────────────────────────────

export type {
  CalendarEventType,
  CalendarColorMode,
  RecurrenceFrequency,
  ReminderChannel,
  AvailabilityStatus,
  CalendarClientOption,
  CalendarTicketLink,
  CalendarReminder,
  CalendarEvent,
  CalendarEventFilters,
  CreateCalendarEventData,
  UpdateCalendarEventData,
};

// ── Re-export raw fetch/mutation functions ───────────────────────────

export {
  fetchCalendarEvents,
  fetchCalendarTicketOptions,
  fetchCalendarClientOptions,
  createCalendarEvent,
  updateCalendarEvent,
  updateRecurringOccurrence,
  deleteCalendarEvent,
};

// ── Hooks ────────────────────────────────────────────────────────────

export function useCalendarEvents(filters: CalendarEventFilters) {
  return useQuery({
    queryKey: [
      ...QUERY_KEYS.calendarEvents,
      filters.rangeStart.toISOString(),
      filters.rangeEnd.toISOString(),
      filters.assigneeId ?? null,
      filters.eventType ?? null,
    ],
    queryFn: () => fetchCalendarEvents(filters),
    staleTime: 60_000,
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ data, createdBy }: { data: CreateCalendarEventData; createdBy: string }) =>
      createCalendarEvent(data, createdBy),
    onSuccess() {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.calendarEvents });
    },
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCalendarEventData }) =>
      updateCalendarEvent(id, data),
    onSuccess() {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.calendarEvents });
    },
  });
}

export function useUpdateRecurringOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      event,
      data,
      createdBy,
    }: {
      event: CalendarEvent;
      data: UpdateCalendarEventData;
      createdBy: string;
    }) => updateRecurringOccurrence(event, data, createdBy),
    onSuccess() {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.calendarEvents });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess() {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.calendarEvents });
    },
  });
}
