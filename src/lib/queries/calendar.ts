import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "./keys";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarEventType =
  | "intervention"
  | "deadline"
  | "appointment"
  | "availability";

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
  color: string | null;
  estimated_duration_minutes: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  ticket_code?: string | null;
  assignee_name?: string | null;
  assignee_initials?: string | null;
}

export interface CalendarEventFilters {
  rangeStart: Date;
  rangeEnd: Date;
  assigneeId?: string | null;
  eventType?: CalendarEventType | null;
}

export interface CreateCalendarEventData {
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  event_type: CalendarEventType;
  ticket_id?: string | null;
  assignee_id?: string | null;
  color?: string | null;
  estimated_duration_minutes?: number | null;
  notes?: string | null;
}

export type UpdateCalendarEventData = Partial<CreateCalendarEventData>;

// ---------------------------------------------------------------------------
// Raw row shape returned by the joined Supabase query
// ---------------------------------------------------------------------------

interface RawCalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  event_type: string;
  ticket_id: string | null;
  assignee_id: string | null;
  color: string | null;
  estimated_duration_minutes: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ticket: { ticket_code: string } | null;
  assignee: { full_name: string; initials: string } | null;
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

function mapRawToCalendarEvent(row: RawCalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start_at: row.start_at,
    end_at: row.end_at,
    all_day: row.all_day,
    event_type: row.event_type as CalendarEventType,
    ticket_id: row.ticket_id,
    assignee_id: row.assignee_id,
    color: row.color,
    estimated_duration_minutes: row.estimated_duration_minutes,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ticket_code: row.ticket?.ticket_code ?? null,
    assignee_name: row.assignee?.full_name ?? null,
    assignee_initials: row.assignee?.initials ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export async function fetchCalendarEvents(
  filters: CalendarEventFilters,
): Promise<CalendarEvent[]> {
  let query = (supabase as any)
    .from("calendar_events")
    .select(
      `
      *,
      ticket:tickets(ticket_code),
      assignee:profiles!calendar_events_assignee_id_fkey(full_name, initials)
    `,
    )
    .gte("start_at", filters.rangeStart.toISOString())
    .lte("start_at", filters.rangeEnd.toISOString())
    .order("start_at");

  if (filters.assigneeId) {
    query = query.eq("assignee_id", filters.assigneeId);
  }

  if (filters.eventType) {
    query = query.eq("event_type", filters.eventType);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as RawCalendarEventRow[]).map(mapRawToCalendarEvent);
}

export async function createCalendarEvent(
  data: CreateCalendarEventData,
  createdBy: string,
): Promise<CalendarEvent> {
  const { data: row, error } = await supabase
    .from("calendar_events")
    .insert({ ...data, created_by: createdBy })
    .select("*")
    .single();

  if (error) throw error;

  return {
    ...(row as CalendarEvent),
    ticket_code: null,
    assignee_name: null,
    assignee_initials: null,
  };
}

export async function updateCalendarEvent(
  id: string,
  data: UpdateCalendarEventData,
): Promise<CalendarEvent> {
  const { data: row, error } = await supabase
    .from("calendar_events")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;

  return {
    ...(row as CalendarEvent),
    ticket_code: null,
    assignee_name: null,
    assignee_initials: null,
  };
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

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
    mutationFn: ({
      data,
      createdBy,
    }: {
      data: CreateCalendarEventData;
      createdBy: string;
    }) => createCalendarEvent(data, createdBy),
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

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess() {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.calendarEvents });
    },
  });
}
