import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMilliseconds,
  format,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "./keys";

/**
 *
 */
export type CalendarEventType = "intervention" | "deadline" | "appointment" | "availability";
/**
 *
 */
export type CalendarColorMode = "type" | "technician" | "client";
/**
 *
 */
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "custom";
/**
 *
 */
export type ReminderChannel = "email" | "in_app";
/**
 *
 */
export type AvailabilityStatus = "available" | "vacation" | "sick_leave" | "unavailable";

/**
 *
 */
export interface CalendarClientOption {
  id: string;
  name: string;
  company_name: string | null;
}

/**
 *
 */
export interface CalendarTicketLink {
  id: string;
  ticket_code: string;
  client: string | null;
  client_id: string | null;
}

/**
 *
 */
export interface CalendarReminder {
  id?: string;
  offset_minutes: number;
  channel: ReminderChannel;
  sent_at?: string | null;
}

/**
 *
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  event_type: CalendarEventType;
  ticket_id: string | null;
  assignee_id: string | null;
  client_id: string | null;
  color: string | null;
  estimated_duration_minutes: number | null;
  notes: string | null;
  availability_status: AvailabilityStatus | null;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  recurrence_until: string | null;
  recurrence_count: number | null;
  recurrence_days: string[] | null;
  recurrence_series_id: string | null;
  recurrence_parent_id: string | null;
  recurrence_exception_date: string | null;
  external_provider: "google" | "outlook" | null;
  external_event_id: string | null;
  external_updated_at: string | null;
  sync_status: "local" | "synced" | "pending" | "conflict" | "disabled" | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  occurrence_id?: string;
  occurrence_date?: string;
  is_recurring_instance?: boolean;
  ticket_code?: string | null;
  tickets?: CalendarTicketLink[];
  reminders?: CalendarReminder[];
  client_name?: string | null;
  assignee_name?: string | null;
  assignee_initials?: string | null;
}

/**
 *
 */
export interface CalendarEventFilters {
  rangeStart: Date;
  rangeEnd: Date;
  assigneeId?: string | null;
  eventType?: CalendarEventType | null;
}

/**
 *
 */
export interface CreateCalendarEventData {
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  event_type: CalendarEventType;
  ticket_id?: string | null;
  ticket_ids?: string[];
  assignee_id?: string | null;
  client_id?: string | null;
  color?: string | null;
  estimated_duration_minutes?: number | null;
  notes?: string | null;
  availability_status?: AvailabilityStatus | null;
  recurrence_frequency?: RecurrenceFrequency | null;
  recurrence_interval?: number | null;
  recurrence_until?: string | null;
  recurrence_count?: number | null;
  recurrence_days?: string[] | null;
  recurrence_series_id?: string | null;
  recurrence_parent_id?: string | null;
  recurrence_exception_date?: string | null;
  reminders?: Array<Omit<CalendarReminder, "id" | "sent_at">>;
}

/**
 *
 */
export type UpdateCalendarEventData = Partial<CreateCalendarEventData>;

interface RawCalendarEventRow extends Omit<CalendarEvent, "event_type" | "tickets" | "reminders"> {
  event_type: string;
  ticket: { ticket_code: string } | null;
  client: { id: string; name: string; company_name: string | null } | null;
  calendar_event_tickets?: Array<{
    ticket: CalendarTicketLink | null;
  }>;
  calendar_event_reminders?: CalendarReminder[];
  assignee: { full_name: string; initials: string } | null;
}

const CALENDAR_EVENT_SELECT =
  "id, title, description, start_at, end_at, all_day, event_type, ticket_id, assignee_id, client_id, color, estimated_duration_minutes, notes, availability_status, recurrence_frequency, recurrence_interval, recurrence_until, recurrence_count, recurrence_days, recurrence_series_id, recurrence_parent_id, recurrence_exception_date, external_provider, external_event_id, external_updated_at, sync_status, created_by, created_at, updated_at";

function mapRawToCalendarEvent(row: RawCalendarEventRow): CalendarEvent {
  return {
    ...row,
    event_type: row.event_type as CalendarEventType,
    availability_status: row.availability_status as AvailabilityStatus | null,
    recurrence_frequency: row.recurrence_frequency as RecurrenceFrequency | null,
    ticket_code: row.ticket?.ticket_code ?? null,
    tickets:
      row.calendar_event_tickets
        ?.map((link) => link.ticket)
        .filter((ticket): ticket is CalendarTicketLink => !!ticket) ?? [],
    reminders: row.calendar_event_reminders ?? [],
    client_name: row.client?.company_name || row.client?.name || null,
    assignee_name: row.assignee?.full_name ?? null,
    assignee_initials: row.assignee?.initials ?? null,
  };
}

function isRecurring(event: CalendarEvent): boolean {
  return !!event.recurrence_frequency && !event.recurrence_parent_id;
}

function recurrenceStep(event: CalendarEvent, date: Date): Date {
  const interval = event.recurrence_interval ?? 1;
  if (event.recurrence_frequency === "daily") return addDays(date, interval);
  if (event.recurrence_frequency === "weekly") return addWeeks(date, interval);
  if (event.recurrence_frequency === "monthly") return addMonths(date, interval);
  return addDays(date, interval);
}

function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const exceptions = new Set(
    events
      .filter((event) => event.recurrence_series_id && event.recurrence_exception_date)
      .map((event) => `${event.recurrence_series_id}:${event.recurrence_exception_date}`),
  );

  const expanded: CalendarEvent[] = [];
  for (const event of events) {
    if (!isRecurring(event)) {
      expanded.push(event);
      continue;
    }

    const originalStart = parseISO(event.start_at);
    const durationMs = differenceInMilliseconds(parseISO(event.end_at), originalStart);
    const until = event.recurrence_until
      ? new Date(`${event.recurrence_until}T23:59:59`)
      : rangeEnd;
    const maxCount = event.recurrence_count ?? 370;
    let cursor = originalStart;
    let count = 0;

    while (!isAfter(cursor, rangeEnd) && !isAfter(cursor, until) && count < maxCount) {
      const occurrenceEnd = new Date(cursor.getTime() + durationMs);
      const occurrenceDate = format(cursor, "yyyy-MM-dd");
      const exceptionKey = `${event.id}:${occurrenceDate}`;
      if (!exceptions.has(exceptionKey) && !isBefore(occurrenceEnd, rangeStart)) {
        expanded.push({
          ...event,
          id: `${event.id}__${occurrenceDate}`,
          occurrence_id: event.id,
          occurrence_date: occurrenceDate,
          is_recurring_instance: true,
          start_at: cursor.toISOString(),
          end_at: occurrenceEnd.toISOString(),
        });
      }
      cursor = recurrenceStep(event, cursor);
      count += 1;
    }
  }

  return expanded.sort((a, b) => a.start_at.localeCompare(b.start_at));
}

/**
 *
 */
export async function fetchCalendarEvents(filters: CalendarEventFilters): Promise<CalendarEvent[]> {
  let query = (supabase as any)
    .from("calendar_events")
    .select(
      `
      *,
      ticket:tickets(ticket_code),
      client:clients(id, name, company_name),
      calendar_event_tickets(ticket:tickets(id, ticket_code, client, client_id)),
      calendar_event_reminders(id, offset_minutes, channel, sent_at),
      assignee:profiles!calendar_events_assignee_id_fkey(full_name, initials)
    `,
    )
    .lte("start_at", filters.rangeEnd.toISOString())
    .order("start_at");

  if (filters.assigneeId) query = query.eq("assignee_id", filters.assigneeId);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);

  const { data, error } = await query;
  if (error) throw error;

  const mapped = ((data ?? []) as RawCalendarEventRow[]).map(mapRawToCalendarEvent);
  return expandRecurringEvents(mapped, filters.rangeStart, filters.rangeEnd);
}

function splitNestedData(data: CreateCalendarEventData | UpdateCalendarEventData) {
  const { ticket_ids, reminders, ...eventData } = data;
  return {
    eventData,
    ticketIds: ticket_ids ?? (data.ticket_id ? [data.ticket_id] : []),
    reminders: reminders ?? [],
  };
}

async function replaceEventTickets(eventId: string, ticketIds: string[]) {
  const { error: deleteError } = await (supabase as any)
    .from("calendar_event_tickets")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw deleteError;

  const uniqueIds = Array.from(new Set(ticketIds.filter(Boolean)));
  if (!uniqueIds.length) return;
  const { error } = await (supabase as any)
    .from("calendar_event_tickets")
    .insert(uniqueIds.map((ticket_id) => ({ event_id: eventId, ticket_id })));
  if (error) throw error;
}

async function replaceEventReminders(
  eventId: string,
  reminders: Array<Omit<CalendarReminder, "id" | "sent_at">>,
) {
  const { error: deleteError } = await (supabase as any)
    .from("calendar_event_reminders")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw deleteError;

  if (!reminders.length) return;
  const { error } = await (supabase as any)
    .from("calendar_event_reminders")
    .insert(reminders.map((reminder) => ({ event_id: eventId, ...reminder })));
  if (error) throw error;
}

function withEmptyJoins(row: CalendarEvent): CalendarEvent {
  return {
    ...row,
    ticket_code: null,
    tickets: [],
    reminders: [],
    client_name: null,
    assignee_name: null,
    assignee_initials: null,
  };
}

/**
 *
 */
export async function createCalendarEvent(
  data: CreateCalendarEventData,
  createdBy: string,
): Promise<CalendarEvent> {
  const { eventData, ticketIds, reminders } = splitNestedData(data);
  const { data: row, error } = await (supabase as any)
    .from("calendar_events")
    .insert({
      ...eventData,
      ticket_id: ticketIds[0] ?? eventData.ticket_id ?? null,
      created_by: createdBy,
    })
    .select(CALENDAR_EVENT_SELECT)
    .single();

  if (error) throw error;
  await replaceEventTickets(row.id, ticketIds);
  await replaceEventReminders(row.id, reminders);

  return withEmptyJoins(row as CalendarEvent);
}

/**
 *
 */
export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEventData,
): Promise<CalendarEvent> {
  const { eventData, ticketIds, reminders } = splitNestedData(data);
  const updatePayload =
    "ticket_ids" in data || "ticket_id" in data
      ? { ...eventData, ticket_id: ticketIds[0] ?? eventData.ticket_id ?? null }
      : eventData;

  const { data: row, error } = await (supabase as any)
    .from("calendar_events")
    .update(updatePayload)
    .eq("id", id)
    .select(CALENDAR_EVENT_SELECT)
    .single();

  if (error) throw error;
  if ("ticket_ids" in data || "ticket_id" in data) await replaceEventTickets(id, ticketIds);
  if ("reminders" in data) await replaceEventReminders(id, reminders);

  return withEmptyJoins(row as CalendarEvent);
}

/**
 *
 */
export async function updateRecurringOccurrence(
  event: CalendarEvent,
  data: UpdateCalendarEventData,
  createdBy: string,
): Promise<CalendarEvent> {
  const sourceId = event.occurrence_id ?? event.id;
  return createCalendarEvent(
    {
      ...data,
      title: data.title ?? event.title,
      start_at: data.start_at ?? event.start_at,
      end_at: data.end_at ?? event.end_at,
      all_day: data.all_day ?? event.all_day,
      event_type: data.event_type ?? event.event_type,
      recurrence_parent_id: sourceId,
      recurrence_series_id: sourceId,
      recurrence_exception_date:
        event.occurrence_date ?? format(parseISO(event.start_at), "yyyy-MM-dd"),
      recurrence_frequency: null,
      recurrence_interval: null,
      recurrence_until: null,
      recurrence_count: null,
      recurrence_days: null,
    },
    createdBy,
  );
}

/**
 *
 */
export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await (supabase as any).from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}

/**
 *
 */
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

/**
 *
 */
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

/**
 *
 */
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

/**
 *
 */
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

/**
 *
 */
export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess() {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.calendarEvents });
    },
  });
}

/**
 *
 */
export async function fetchCalendarTicketOptions(query: string) {
  const term = query.trim().replace(/[,%]/g, "");
  let request = (supabase as any)
    .from("tickets")
    .select("id, ticket_code, client, client_id, status")
    .not("status", "eq", "archived")
    .order("created_at", { ascending: false });
  if (term)
    request = request.or(
      `ticket_code.ilike.%${term}%,client.ilike.%${term}%,requester.ilike.%${term}%`,
    );
  const { data, error } = await request.range(0, 30);
  if (error) throw error;
  return (data ?? []) as Array<CalendarTicketLink & { status: string }>;
}

/**
 *
 */
export async function fetchCalendarClientOptions(query: string) {
  const term = query.trim().replace(/[,%]/g, "");
  let request = (supabase as any).from("clients").select("id, name, company_name").order("name");
  if (term) request = request.or(`name.ilike.%${term}%,company_name.ilike.%${term}%`);
  const { data, error } = await request.range(0, 30);
  if (error) throw error;
  return (data ?? []) as CalendarClientOption[];
}
