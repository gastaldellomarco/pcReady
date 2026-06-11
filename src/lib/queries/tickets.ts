import { useMutation, useQueryClient, useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_KEYS } from "./keys";
import { LIST_PAGE_SIZE, LIST_QUERY_GC_MS, LIST_QUERY_STALE_MS } from "./list-config";
import {
  // ── fetch functions ──
  loadClientOptions,
  fetchClientById,
  loadContactOptions,
  fetchContactById,
  loadDeviceOptions,
  fetchDeviceById,
  fetchTicketById,
  fetchTicketAssignments,
  fetchTicketAssignmentHistory,
  fetchTicketStatusHistory,
  fetchTicketsList,
  fetchAllTicketsList,
  fetchArchivedTicketsList,
  fetchStatusChangeTimestamps,
  addTicketStatusHistory,
  // ── types ──
  type TicketDetailRow,
  type TicketDeviceAssignmentRow,
  type TicketMaterialItem,
  type TicketMaterialDraft,
  type DetailTab,
  type TicketTimelineItem,
  type TicketsListParams,
} from "@/lib/data/tickets";

// ── Re-export types ──────────────────────────────────────────────────
export type {
  TicketDetailRow,
  TicketDeviceAssignmentRow,
  TicketMaterialItem,
  TicketMaterialDraft,
  DetailTab,
  TicketTimelineItem,
  TicketsListParams,
};

// ── Re-export raw fetch/mutation functions as named exports ─────────
export {
  loadClientOptions,
  fetchClientById,
  loadContactOptions,
  fetchContactById,
  loadDeviceOptions,
  fetchDeviceById,
  fetchTicketById,
  fetchTicketAssignments,
  fetchTicketAssignmentHistory,
  fetchTicketStatusHistory,
  fetchTicketsList,
  fetchAllTicketsList,
  fetchArchivedTicketsList,
  fetchStatusChangeTimestamps,
  addTicketStatusHistory,
};

// ── Mutations ───────────────────────────────────────────────────────

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const { error, data } = await supabase.from("tickets").insert(payload).select("id, ticket_code").single();
      if (error) throw error;
      return data;
    },
    onSuccess() { qc.invalidateQueries({ queryKey: QUERY_KEYS.tickets }); },
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("tickets").update(patch).eq("id", id);
      if (error) throw error;
      return { id, patch };
    },
    onSuccess(_data, vars) {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ticket(vars.id) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tickets });
    },
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess() { qc.invalidateQueries({ queryKey: QUERY_KEYS.tickets }); },
  });
}

export function useAddTicketStatusHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, payload }: { ticketId: string; payload: any }) => addTicketStatusHistory(ticketId, payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.ticket(vars.ticketId) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tickets });
    },
  });
}

// ── Queries ─────────────────────────────────────────────────────────

export function useTicketsList(params: TicketsListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.tickets, params.status || "", params.priority || "", params.ticket_type || "", params.client_id || "", params.assignee_id || "", params.q || "", params.dateFrom || "", params.dateTo || "", params.sortBy ?? "created_at", params.sortDir ?? "desc", params.page ?? 0, params.pageSize ?? LIST_PAGE_SIZE],
    queryFn: () => fetchTicketsList(params),
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

export function useTicketQuery(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.ticket(id ?? "null"),
    queryFn: () => fetchTicketById(id as string),
    enabled: !!id,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
  });
}

export function useTicketAssignmentsQuery(id: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ticket(id ?? "null"), "assignments"],
    queryFn: () => fetchTicketAssignments(id as string),
    enabled: !!id,
  });
}

export function useTicketHistoryQuery(id: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ticket(id ?? "null"), "history"],
    queryFn: () => fetchTicketAssignmentHistory(id as string),
    enabled: !!id,
  });
}

export function useTicketStatusHistoryQuery(id: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ticket(id ?? "null"), "status-history"],
    queryFn: () => fetchTicketStatusHistory(id as string),
    enabled: !!id,
  });
}

export function useTicketsInfiniteList(params: TicketsListParams) {
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.tickets, "infinite", params.status || "", params.priority || "", params.ticket_type || "", params.client_id || "", params.assignee_id || "", params.q || "", params.dateFrom || "", params.dateTo || "", params.sortBy ?? "created_at", params.sortDir ?? "desc"],
    queryFn: ({ pageParam }) => fetchTicketsList({ ...params, page: pageParam as number }),
    getNextPageParam: (lastPage, allPages) => lastPage.data.length === (params.pageSize ?? LIST_PAGE_SIZE) ? allPages.length : undefined,
    initialPageParam: 0,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

export function useArchivedTicketsInfiniteList(params: { pageSize?: number }) {
  return useInfiniteQuery({
    queryKey: [...QUERY_KEYS.tickets, "archived", "infinite"],
    queryFn: ({ pageParam }) => fetchArchivedTicketsList({ ...params, page: pageParam as number }),
    getNextPageParam: (lastPage, allPages) => lastPage.data.length === (params.pageSize ?? LIST_PAGE_SIZE) ? allPages.length : undefined,
    initialPageParam: 0,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}
