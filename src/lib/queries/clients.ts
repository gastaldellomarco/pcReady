/* eslint-disable jsdoc/require-jsdoc */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { LIST_PAGE_SIZE, LIST_QUERY_GC_MS, LIST_QUERY_STALE_MS } from "./list-config";
import {
  // ── fetch functions ──
  fetchClientsList,
  fetchAllClientsForExport,
  fetchClientContacts,
  fetchContactPortalAccess,
  fetchClientStats,
  fetchClientTags,
  fetchClientTagAssignments,
  createClientTag,
  toggleClientTag,
  fetchClientNotes,
  fetchClientNoteRevisions,
  createClientNote,
  updateClientNote,
  deleteClientNote,
  fetchClientOverview,
  fetchClientActivity,
  fetchClientDocuments,
  uploadClientDocument,
  getClientDocumentSignedUrl,
  deleteClientDocument,
  fetchClientContractAlerts,
  upsertClientContractAlert,
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  createContact,
  updateContact,
  deleteContact,
  fetchContactGroups,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
  toggleStarContact,
  updateContactAvailability,
  updateContactPrivateNote,
  fetchGlobalContacts,
  fetchGlobalContactsPage,
  fetchClientTickets,
  fetchClientDevices,
  fetchDuplicateCandidates,
  mergeContacts,
  fetchContactInteractionHistory,
  // ── types ──
  type ClientsListParams,
  type ClientStats,
  type ClientTag,
  type ClientNote,
  type ClientNoteRevision,
  type ClientDocument,
  type ClientOverview,
  type ClientActivityItem,
  type GlobalContactRow,
  type ContactGroup,
  type ContactInteractionItem,
  type DuplicateCandidate,
  type GlobalContactsParams,
  type GlobalContactsListParams,
} from "@/lib/data/clients";

// ── Re-export types for backward compatibility ──────────────────────
export type {
  ClientsListParams,
  ClientStats,
  ClientTag,
  ClientNote,
  ClientNoteRevision,
  ClientDocument,
  ClientOverview,
  ClientActivityItem,
  GlobalContactRow,
  ContactGroup,
  ContactInteractionItem,
  DuplicateCandidate,
  GlobalContactsParams,
  GlobalContactsListParams,
};

// ── Clients list ────────────────────────────────────────────────────

export function useClientsList(params: ClientsListParams) {
  return useQuery({
    queryKey: ["clients", params.q || "", params.page ?? 0, params.pageSize ?? LIST_PAGE_SIZE],
    queryFn: () => fetchClientsList(params),
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

export function useClientsInfiniteList(params: Omit<ClientsListParams, "page">) {
  const pageSize = params.pageSize ?? LIST_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: ["clients", "infinite", params.q || "", pageSize],
    queryFn: ({ pageParam }) => fetchClientsList({ ...params, page: pageParam, pageSize }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.data || lastPage.data.length < pageSize) return undefined;
      return allPages.length;
    },
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

// ── Contacts ────────────────────────────────────────────────────────

export function useClientContacts(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "contacts"],
    queryFn: () => fetchClientContacts(clientId as string),
    enabled: !!clientId,
  });
}

export function useContactPortalAccess(contactIds: string[]) {
  const key = contactIds.filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["clients", "contacts", "portal-access", key],
    queryFn: () => fetchContactPortalAccess(contactIds),
    enabled: !!contactIds.length,
  });
}

// ── Stats ───────────────────────────────────────────────────────────

export function useClientStats(clientIds: string[]) {
  const key = clientIds.filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["clients", "stats", key],
    queryFn: () => fetchClientStats(clientIds),
    enabled: !!clientIds.length,
  });
}

// ── Tags ────────────────────────────────────────────────────────────

export function useClientTags() {
  return useQuery({
    queryKey: ["clients", "tags"],
    queryFn: fetchClientTags,
    staleTime: LIST_QUERY_STALE_MS,
  });
}

export function useClientTagAssignments(clientIds: string[]) {
  const key = clientIds.filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["clients", "tag-assignments", key],
    queryFn: () => fetchClientTagAssignments(clientIds),
    enabled: !!clientIds.length,
  });
}

// ── Notes ───────────────────────────────────────────────────────────

export function useClientNotes(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "notes"],
    queryFn: () => fetchClientNotes(clientId as string),
    enabled: !!clientId,
  });
}

export function useClientNoteRevisions(noteId: string | null) {
  return useQuery({
    queryKey: ["clients", "notes", noteId, "revisions"],
    queryFn: () => fetchClientNoteRevisions(noteId),
    enabled: !!noteId,
  });
}

// ── Overview ────────────────────────────────────────────────────────

export function useClientOverview(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "overview"],
    queryFn: () => fetchClientOverview(clientId as string),
    enabled: !!clientId,
  });
}

// ── Activity ────────────────────────────────────────────────────────

export function useClientActivity(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "activity"],
    queryFn: () => fetchClientActivity(clientId as string),
    enabled: !!clientId,
  });
}

// ── Documents ───────────────────────────────────────────────────────

export function useClientDocuments(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "documents"],
    queryFn: () => fetchClientDocuments(clientId as string),
    enabled: !!clientId,
  });
}

// ── Contract Alerts ─────────────────────────────────────────────────

export function useClientContractAlerts(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "contract-alerts"],
    queryFn: () => fetchClientContractAlerts(clientId as string),
    enabled: !!clientId,
  });
}

// ── CRUD mutations ──────────────────────────────────────────────────

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createClient(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      updateClient(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useBulkDeleteClients() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteClients(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, payload }: { clientId: string; payload: Record<string, any> }) =>
      createContact(clientId, payload),
    onSuccess: (_res, vars) =>
      qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "contacts"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      clientId: _clientId,
      payload,
    }: {
      id: string;
      clientId?: string;
      payload: Record<string, any>;
    }) => updateContact(id, payload),
    onSuccess: (_res, vars) => {
      if (vars.clientId)
        qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "contacts"] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId: _clientId }: { id: string; clientId?: string }) =>
      deleteContact(id),
    onSuccess: (_res, vars) => {
      if (vars.clientId)
        qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "contacts"] });
    },
  });
}

// ── Contact groups ──────────────────────────────────────────────────

export function useContactGroups(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "groups"],
    queryFn: () => fetchContactGroups(clientId as string),
    enabled: !!clientId,
  });
}

export function useCreateContactGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      name,
      description,
    }: {
      clientId: string;
      name: string;
      description?: string | null;
    }) => createContactGroup(clientId, name, description),
    onSuccess: (_res, vars) =>
      qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "groups"] }),
  });
}

export function useUpdateContactGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string;
      name: string;
      description?: string | null;
    }) => updateContactGroup(id, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteContactGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId: _clientId }: { id: string; clientId: string }) =>
      deleteContactGroup(id),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "groups"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ── Starred / Availability / Private notes ──────────────────────────

export function useToggleStarContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, isStarred }: { contactId: string; isStarred: boolean }) =>
      toggleStarContact(contactId, isStarred),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", "contacts"] }),
  });
}

export function useUpdateContactAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      contactId,
      availabilityStatus,
      returnDate,
    }: {
      contactId: string;
      availabilityStatus: string | null;
      returnDate: string | null;
    }) => updateContactAvailability(contactId, availabilityStatus, returnDate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", "contacts"] }),
  });
}

export function useUpdateContactPrivateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, privateNote }: { contactId: string; privateNote: string | null }) =>
      updateContactPrivateNote(contactId, privateNote),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", "contacts"] }),
  });
}

// ── Global contacts ─────────────────────────────────────────────────

export function useGlobalContacts(params?: GlobalContactsParams) {
  return useQuery({
    queryKey: ["clients", "contacts", "global", params?.q || ""],
    queryFn: () => fetchGlobalContacts(params),
  });
}

export function useGlobalContactsInfiniteList(params?: Omit<GlobalContactsListParams, "page">) {
  const pageSize = params?.pageSize ?? LIST_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: ["clients", "contacts", "global", "infinite", params?.q || "", pageSize],
    queryFn: ({ pageParam }) => fetchGlobalContacts({ ...params, page: pageParam, pageSize }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < pageSize) return undefined;
      return allPages.length;
    },
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

// ── Client tickets & devices ────────────────────────────────────────

export function useClientTickets(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "tickets"],
    queryFn: () => fetchClientTickets(clientId as string),
    enabled: !!clientId,
  });
}

export function useClientDevices(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "devices"],
    queryFn: () => fetchClientDevices(clientId as string),
    enabled: !!clientId,
  });
}

// ── Duplicate detection & merge ─────────────────────────────────────

export function useDuplicateCandidates(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "duplicates"],
    queryFn: () => fetchDuplicateCandidates(clientId as string),
    enabled: !!clientId,
  });
}

export function useMergeContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mergeContacts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

// ── Interaction history ─────────────────────────────────────────────

export function useContactInteractionHistory(contactId: string | null) {
  return useQuery({
    queryKey: ["clients", "contacts", contactId, "interactions"],
    queryFn: () => fetchContactInteractionHistory(contactId as string),
    enabled: !!contactId,
  });
}

// ── Re-export raw fetch/mutation functions as named exports ────────
// Needed by callers that do `const { fetchClientsList } = await import(...)`
export {
  fetchClientsList,
  fetchAllClientsForExport,
  fetchClientContacts,
  fetchContactPortalAccess,
  fetchClientStats,
  fetchClientTags,
  fetchClientTagAssignments,
  createClientTag,
  toggleClientTag,
  fetchClientNotes,
  fetchClientNoteRevisions,
  createClientNote,
  updateClientNote,
  deleteClientNote,
  fetchClientOverview,
  fetchClientActivity,
  fetchClientDocuments,
  uploadClientDocument,
  getClientDocumentSignedUrl,
  deleteClientDocument,
  fetchClientContractAlerts,
  upsertClientContractAlert,
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  createContact,
  updateContact,
  deleteContact,
  fetchContactGroups,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
  toggleStarContact,
  updateContactAvailability,
  updateContactPrivateNote,
  fetchGlobalContacts,
  fetchGlobalContactsPage,
  fetchClientTickets,
  fetchClientDevices,
  fetchDuplicateCandidates,
  mergeContacts,
  fetchContactInteractionHistory,
};

// ── Default export (namespace) — backward compatible ─────────────────

export default {
  fetchClientsList,
  fetchAllClientsForExport,
  useClientsList,
  useClientsInfiniteList,
  fetchClientContacts,
  useClientContacts,
  fetchClientStats,
  useClientStats,
  fetchClientTags,
  useClientTags,
  fetchClientTagAssignments,
  useClientTagAssignments,
  createClientTag,
  toggleClientTag,
  fetchClientNotes,
  useClientNotes,
  fetchClientNoteRevisions,
  useClientNoteRevisions,
  createClientNote,
  updateClientNote,
  deleteClientNote,
  fetchClientOverview,
  useClientOverview,
  fetchClientActivity,
  useClientActivity,
  fetchClientDocuments,
  useClientDocuments,
  uploadClientDocument,
  getClientDocumentSignedUrl,
  deleteClientDocument,
  fetchClientContractAlerts,
  useClientContractAlerts,
  upsertClientContractAlert,
  createClient,
  updateClient,
  deleteClient,
  bulkDeleteClients,
  createContact,
  updateContact,
  deleteContact,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useBulkDeleteClients,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  fetchContactGroups,
  useContactGroups,
  createContactGroup,
  updateContactGroup,
  deleteContactGroup,
  useCreateContactGroup,
  useUpdateContactGroup,
  useDeleteContactGroup,
  toggleStarContact,
  useToggleStarContact,
  updateContactAvailability,
  useUpdateContactAvailability,
  updateContactPrivateNote,
  useUpdateContactPrivateNote,
  fetchGlobalContacts,
  fetchGlobalContactsPage,
  useGlobalContacts,
  useGlobalContactsInfiniteList,
  fetchClientTickets,
  useClientTickets,
  fetchClientDevices,
  useClientDevices,
  fetchDuplicateCandidates,
  useDuplicateCandidates,
  mergeContacts,
  useMergeContacts,
  fetchContactInteractionHistory,
  useContactInteractionHistory,
  fetchContactPortalAccess,
  useContactPortalAccess,
};
