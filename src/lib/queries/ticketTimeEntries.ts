import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 *
 */
export interface TicketTimeEntry {
  id: string;
  ticket_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  description: string | null;
  created_at: string;
  user?: { full_name: string; initials: string } | null;
}

/**
 *
 */
export interface TicketTimeSummary {
  entries: TicketTimeEntry[];
  totalMinutes: number;
  activeEntry: TicketTimeEntry | null;
}

const key = (ticketId: string | null) => ["ticket", ticketId, "time-entries"];

function minutesBetween(start: string, end?: string | null) {
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.max(1, Math.round((to - from) / 60000));
}

/**
 *
 */
export function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 *
 */
export async function fetchTicketTimeSummary(ticketId: string, currentUserId?: string | null) {
  if (!ticketId) return { entries: [], totalMinutes: 0, activeEntry: null } satisfies TicketTimeSummary;
  const { data, error } = await (supabase as any)
    .from("ticket_time_entries")
    .select(
      "id, ticket_id, user_id, started_at, ended_at, duration_minutes, description, created_at, user:profiles(id, full_name, initials)",
    )
    .eq("ticket_id", ticketId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  const entries = (data ?? []) as TicketTimeEntry[];
  const totalMinutes = entries.reduce((sum, entry) => {
    const value = entry.duration_minutes ?? minutesBetween(entry.started_at, entry.ended_at);
    return sum + value;
  }, 0);
  const activeEntry =
    entries.find((entry) => !entry.ended_at && (!currentUserId || entry.user_id === currentUserId)) ??
    null;
  return { entries, totalMinutes, activeEntry } satisfies TicketTimeSummary;
}

/**
 *
 */
export async function startTicketTimer(ticketId: string, userId: string) {
  const { data: existing, error: existingError } = await (supabase as any)
    .from("ticket_time_entries")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing;

  const { data, error } = await (supabase as any)
    .from("ticket_time_entries")
    .insert({ ticket_id: ticketId, user_id: userId, started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 *
 */
export async function stopTicketTimer(entry: TicketTimeEntry, description?: string | null) {
  const endedAt = new Date().toISOString();
  const duration = minutesBetween(entry.started_at, endedAt);
  const { data, error } = await (supabase as any)
    .from("ticket_time_entries")
    .update({ ended_at: endedAt, duration_minutes: duration, description: description ?? entry.description })
    .eq("id", entry.id)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 *
 */
export async function createManualTimeEntry({
  ticketId,
  userId,
  startedAt,
  endedAt,
  description,
}: {
  ticketId: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  description?: string | null;
}) {
  const duration = minutesBetween(startedAt, endedAt);
  const { data, error } = await (supabase as any)
    .from("ticket_time_entries")
    .insert({
      ticket_id: ticketId,
      user_id: userId,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: duration,
      description: description || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 *
 */
export async function deleteTimeEntry(id: string) {
  const { error } = await (supabase as any).from("ticket_time_entries").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/**
 *
 */
export function useTicketTimeSummary(ticketId: string | null, currentUserId?: string | null) {
  return useQuery({
    queryKey: key(ticketId),
    queryFn: () => fetchTicketTimeSummary(ticketId as string, currentUserId),
    enabled: !!ticketId,
    refetchInterval: 60000,
  });
}

/**
 *
 */
export function useStartTicketTimer(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => startTicketTimer(ticketId, userId),
    onSuccess() {
      qc.invalidateQueries({ queryKey: key(ticketId) });
    },
  });
}

/**
 *
 */
export function useStopTicketTimer(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entry, description }: { entry: TicketTimeEntry; description?: string | null }) =>
      stopTicketTimer(entry, description),
    onSuccess() {
      qc.invalidateQueries({ queryKey: key(ticketId) });
    },
  });
}

/**
 *
 */
export function useCreateManualTimeEntry(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userId: string; startedAt: string; endedAt: string; description?: string | null }) =>
      createManualTimeEntry({ ticketId, ...vars }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: key(ticketId) });
    },
  });
}

/**
 *
 */
export function useDeleteTimeEntry(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTimeEntry(id),
    onSuccess() {
      qc.invalidateQueries({ queryKey: key(ticketId) });
    },
  });
}
