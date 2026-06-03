import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 *
 */
export type TicketRelationType = "blocked_by" | "duplicate_of" | "child_of";

export const RELATION_LABELS: Record<TicketRelationType, string> = {
  blocked_by: "Bloccato da",
  duplicate_of: "Duplicato di",
  child_of: "Ticket figlio di",
};

/**
 *
 */
export interface RelatedTicketLite {
  id: string;
  ticket_code: string;
  model: string | null;
  client: string;
  status: string;
}

/**
 *
 */
export interface TicketRelation {
  id: string;
  source_ticket_id: string;
  target_ticket_id: string;
  relation_type: TicketRelationType;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  source?: RelatedTicketLite | null;
  target?: RelatedTicketLite | null;
}

const key = (ticketId: string | null) => ["ticket", ticketId, "relations"];

/**
 *
 */
export async function fetchTicketRelations(ticketId: string) {
  if (!ticketId) return [];
  const { data, error } = await (supabase as any)
    .from("ticket_relations")
    .select(
      "id, source_ticket_id, target_ticket_id, relation_type, notes, created_by, created_at, source:tickets!ticket_relations_source_ticket_id_fkey(id, ticket_code, model, client, status), target:tickets!ticket_relations_target_ticket_id_fkey(id, ticket_code, model, client, status)",
    )
    .or(`source_ticket_id.eq.${ticketId},target_ticket_id.eq.${ticketId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TicketRelation[];
}

/**
 *
 */
export async function searchTicketsForRelation(query: string, currentTicketId: string) {
  const term = query.trim().replace(/[,%]/g, "");
  if (!term) return [];
  let request = (supabase as any)
    .from("tickets")
    .select("id, ticket_code, model, client, status")
    .neq("id", currentTicketId)
    .order("created_at", { ascending: false });
  request = request.or(`ticket_code.ilike.%${term}%,model.ilike.%${term}%,client.ilike.%${term}%`);
  const { data, error } = await request.range(0, 9);
  if (error) throw error;
  return (data ?? []) as RelatedTicketLite[];
}

/**
 *
 */
export async function createTicketRelation({
  sourceTicketId,
  targetTicketId,
  relationType,
  createdBy,
  notes,
}: {
  sourceTicketId: string;
  targetTicketId: string;
  relationType: TicketRelationType;
  createdBy?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await (supabase as any)
    .from("ticket_relations")
    .insert({
      source_ticket_id: sourceTicketId,
      target_ticket_id: targetTicketId,
      relation_type: relationType,
      created_by: createdBy ?? null,
      notes: notes || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 *
 */
export async function deleteTicketRelation(id: string) {
  const { error } = await (supabase as any).from("ticket_relations").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/**
 *
 */
export function useTicketRelations(ticketId: string | null) {
  return useQuery({
    queryKey: key(ticketId),
    queryFn: () => fetchTicketRelations(ticketId as string),
    enabled: !!ticketId,
  });
}

/**
 *
 */
export function useCreateTicketRelation(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      targetTicketId: string;
      relationType: TicketRelationType;
      createdBy?: string | null;
      notes?: string | null;
    }) =>
      createTicketRelation({
        sourceTicketId: ticketId,
        targetTicketId: vars.targetTicketId,
        relationType: vars.relationType,
        createdBy: vars.createdBy,
        notes: vars.notes,
      }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: key(ticketId) });
    },
  });
}

/**
 *
 */
export function useDeleteTicketRelation(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTicketRelation(id),
    onSuccess() {
      qc.invalidateQueries({ queryKey: key(ticketId) });
    },
  });
}
