import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export async function fetchTicketNotes(ticketId: string) {
  if (!ticketId) return [];
  const { data, error } = await supabase
    .from("ticket_notes")
    .select(
      "id, ticket_id, author_id, content, is_internal, created_at, author:profiles(id, full_name, initials)",
    )
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, author: r.author ?? null }));
}

export function useTicketNotes(ticketId: string | null) {
  return useQuery({
    queryKey: ["ticket", ticketId, "notes"],
    queryFn: () => fetchTicketNotes(ticketId as string),
    enabled: !!ticketId,
  });
}

export async function createTicketNote(payload: Record<string, any>) {
  const { error } = await supabase.from("ticket_notes").insert(payload as any);
  if (error) throw error;
  return true;
}

export async function createTicketNoteRecord(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("ticket_notes")
    .insert(payload as any)
    .select("id, ticket_id, author_id, content, is_internal, created_at")
    .single();
  if (error) throw error;
  return data;
}

export function useCreateTicketNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createTicketNoteRecord(payload),
    onSuccess(_res, vars: any) {
      const ticketId = vars.ticket_id || vars.ticketId || null;
      if (ticketId) qc.invalidateQueries({ queryKey: ["ticket", ticketId, "notes"] });
    },
  });
}

export default {
  fetchTicketNotes,
  useTicketNotes,
  createTicketNote,
  createTicketNoteRecord,
  useCreateTicketNote,
};
