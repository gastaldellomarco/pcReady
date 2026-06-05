/* eslint-disable jsdoc/require-jsdoc */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LIST_PAGE_SIZE, LIST_QUERY_GC_MS, LIST_QUERY_STALE_MS } from "./list-config";

export type ClientsListParams = { q?: string; page?: number; pageSize?: number };

const CLIENT_SELECT =
  "id, name, company_name, vat_number, fiscal_code, email, phone, address, notes, website_url, portal_enabled, updated_at";

const OPEN_TICKET_STATUSES = ["pending", "in-progress", "testing", "ready"] as const;

export async function fetchClientsList(params: ClientsListParams) {
  const PAGE_SIZE = params.pageSize ?? LIST_PAGE_SIZE;
  const page = params.page ?? 0;
  let query = supabase.from("clients").select(CLIENT_SELECT, { count: "exact" }).order("name");
  const term = (params.q || "").trim().replace(/[,%]/g, "");
  if (term) {
    const { data: matchingContacts, error: contactsError } = await supabase
      .from("client_contacts")
      .select("client_id")
      .ilike("email", `%${term}%`)
      .limit(500);
    if (contactsError) throw contactsError;
    const contactClientIds = Array.from(
      new Set((matchingContacts ?? []).map((row: any) => row.client_id).filter(Boolean)),
    );
    const filters = [
      `name.ilike.%${term}%`,
      `company_name.ilike.%${term}%`,
      `vat_number.ilike.%${term}%`,
      `fiscal_code.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
    ];
    if (contactClientIds.length) {
      filters.push(`id.in.(${contactClientIds.join(",")})`);
    }
    query = query.or(filters.join(","));
  }
  const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  return { data: (data ?? []) as any[], count: count ?? 0 };
}

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

export async function fetchClientContacts(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("client_contacts")
    .select(
      "id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes",
    )
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useClientContacts(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "contacts"],
    queryFn: () => fetchClientContacts(clientId as string),
    enabled: !!clientId,
  });
}

export type ClientStats = {
  openTickets: number;
  devices: number;
  contacts: number;
  portalActive: boolean;
};

export type ClientTag = {
  id: string;
  name: string;
  color: string | null;
};

export type ClientNote = {
  id: string;
  client_id: string;
  content: string;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  author?: { full_name: string | null; initials: string | null } | null;
};

export type ClientNoteRevision = {
  id: string;
  note_id: string;
  previous_content: string;
  new_content: string;
  changed_at: string;
  author?: { full_name: string | null; initials: string | null } | null;
};

export type ClientDocument = {
  id: string;
  client_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: "contract" | "nda" | "technical" | "other";
  description: string | null;
  uploaded_at: string;
  uploader?: { full_name: string | null; initials: string | null } | null;
};

export type ClientOverview = {
  openTickets: number;
  avgResolutionHours: number | null;
  totalBilled: number;
  activeBundle: any | null;
  contractDaysLeft: number | null;
};

export type ClientActivityItem = {
  id: string;
  type: "ticket_created" | "ticket_closed" | "note" | "document" | "portal_access" | "bundle";
  title: string;
  description: string | null;
  created_at: string;
};

export type GlobalContactRow = {
  id: string;
  client_id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  is_primary: boolean;
  notes: string | null;
  client: { id: string; name: string; company_name: string | null; portal_enabled: boolean } | null;
  portal_active: boolean;
};

export async function fetchClientStats(clientIds: string[]) {
  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  const empty = Object.fromEntries(
    ids.map((id) => [
      id,
      { openTickets: 0, devices: 0, contacts: 0, portalActive: false } satisfies ClientStats,
    ]),
  ) as Record<string, ClientStats>;
  if (!ids.length) return empty;

  const [ticketsRes, devicesRes, contactsRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, client_id, status")
      .in("client_id", ids)
      .in("status", OPEN_TICKET_STATUSES as any),
    supabase.from("devices").select("id, client_id").in("client_id", ids),
    supabase.from("client_contacts").select("id, client_id").in("client_id", ids),
  ]);

  if (ticketsRes.error) throw ticketsRes.error;
  if (devicesRes.error) throw devicesRes.error;
  if (contactsRes.error) throw contactsRes.error;

  const stats = { ...empty };
  for (const row of (ticketsRes.data ?? []) as any[]) {
    if (row.client_id && stats[row.client_id]) stats[row.client_id].openTickets += 1;
  }
  for (const row of (devicesRes.data ?? []) as any[]) {
    if (row.client_id && stats[row.client_id]) stats[row.client_id].devices += 1;
  }
  const contactClientById = new Map<string, string>();
  for (const row of (contactsRes.data ?? []) as any[]) {
    if (!row.client_id || !stats[row.client_id]) continue;
    stats[row.client_id].contacts += 1;
    contactClientById.set(row.id, row.client_id);
  }

  const contactIds = Array.from(contactClientById.keys());
  if (contactIds.length) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("portal_sessions")
      .select("contact_id")
      .in("contact_id", contactIds)
      .is("revoked_at", null)
      .gt("expires_at", now);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      const clientId = contactClientById.get(row.contact_id);
      if (clientId && stats[clientId]) stats[clientId].portalActive = true;
    }
  }

  return stats;
}

export function useClientStats(clientIds: string[]) {
  const key = clientIds.filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["clients", "stats", key],
    queryFn: () => fetchClientStats(clientIds),
    enabled: !!clientIds.length,
  });
}

export async function fetchClientTags() {
  const { data, error } = await (supabase as any)
    .from("client_tags")
    .select("id, name, color")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClientTag[];
}

export function useClientTags() {
  return useQuery({
    queryKey: ["clients", "tags"],
    queryFn: fetchClientTags,
    staleTime: LIST_QUERY_STALE_MS,
  });
}

export async function fetchClientTagAssignments(clientIds: string[]) {
  const ids = Array.from(new Set(clientIds.filter(Boolean)));
  const result = Object.fromEntries(ids.map((id) => [id, []])) as Record<string, ClientTag[]>;
  if (!ids.length) return result;
  const { data, error } = await (supabase as any)
    .from("client_tag_assignments")
    .select("client_id, tag:client_tags(id, name, color)")
    .in("client_id", ids);
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.client_id && row.tag)
      result[row.client_id] = [...(result[row.client_id] ?? []), row.tag];
  }
  return result;
}

export function useClientTagAssignments(clientIds: string[]) {
  const key = clientIds.filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["clients", "tag-assignments", key],
    queryFn: () => fetchClientTagAssignments(clientIds),
    enabled: !!clientIds.length,
  });
}

export async function createClientTag(name: string, color?: string | null) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Tag name is required");
  const { data: existing, error: existingError } = await (supabase as any)
    .from("client_tags")
    .select("id, name, color")
    .ilike("name", cleanName)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as ClientTag;

  const { data, error } = await (supabase as any)
    .from("client_tags")
    .insert({ name: cleanName, color: color ?? null })
    .select("id, name, color")
    .single();
  if (error) throw error;
  return data as ClientTag;
}

export async function toggleClientTag(
  clientId: string,
  tagId: string,
  assigned: boolean,
  userId?: string | null,
) {
  if (assigned) {
    const { error } = await (supabase as any)
      .from("client_tag_assignments")
      .upsert({ client_id: clientId, tag_id: tagId, assigned_by: userId ?? null });
    if (error) throw error;
    return true;
  }
  const { error } = await (supabase as any)
    .from("client_tag_assignments")
    .delete()
    .eq("client_id", clientId)
    .eq("tag_id", tagId);
  if (error) throw error;
  return true;
}

export async function fetchClientNotes(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await (supabase as any)
    .from("client_notes")
    .select(
      "id, client_id, content, author_id, created_at, updated_at, author:profiles!client_notes_author_id_fkey(full_name, initials)",
    )
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientNote[];
}

export function useClientNotes(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "notes"],
    queryFn: () => fetchClientNotes(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchClientNoteRevisions(noteId: string | null) {
  if (!noteId) return [];
  const { data, error } = await (supabase as any)
    .from("client_note_revisions")
    .select(
      "id, note_id, previous_content, new_content, changed_at, author:profiles!client_note_revisions_author_id_fkey(full_name, initials)",
    )
    .eq("note_id", noteId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientNoteRevision[];
}

export function useClientNoteRevisions(noteId: string | null) {
  return useQuery({
    queryKey: ["clients", "notes", noteId, "revisions"],
    queryFn: () => fetchClientNoteRevisions(noteId),
    enabled: !!noteId,
  });
}

export async function createClientNote(
  clientId: string,
  content: string,
  authorId?: string | null,
) {
  const { error } = await (supabase as any)
    .from("client_notes")
    .insert({ client_id: clientId, content: content.trim(), author_id: authorId ?? null });
  if (error) throw error;
  return true;
}

export async function updateClientNote(noteId: string, content: string, authorId?: string | null) {
  const { error } = await (supabase as any)
    .from("client_notes")
    .update({ content: content.trim(), author_id: authorId ?? null })
    .eq("id", noteId);
  if (error) throw error;
  return true;
}

export async function deleteClientNote(noteId: string) {
  const { error } = await (supabase as any).from("client_notes").delete().eq("id", noteId);
  if (error) throw error;
  return true;
}

export async function fetchClientOverview(clientId: string) {
  if (!clientId) return null;
  const [ticketsRes, paymentsRes, bundleRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, status, created_at, completed_at, closed_at")
      .eq("client_id", clientId),
    (supabase as any)
      .from("bundle_fee_payments")
      .select("amount, status")
      .eq("client_id", clientId)
      .eq("status", "paid"),
    (supabase as any)
      .from("active_client_bundle_assignments")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  if (ticketsRes.error) throw ticketsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (bundleRes.error) throw bundleRes.error;

  const tickets = (ticketsRes.data ?? []) as any[];
  const closed = tickets.filter((ticket) => ticket.completed_at || ticket.closed_at);
  const avgResolutionHours = closed.length
    ? closed.reduce((sum, ticket) => {
        const end = new Date(ticket.completed_at || ticket.closed_at).getTime();
        const start = new Date(ticket.created_at).getTime();
        return sum + Math.max((end - start) / 36e5, 0);
      }, 0) / closed.length
    : null;

  const activeBundle = bundleRes.data ?? null;
  return {
    openTickets: tickets.filter((ticket) => OPEN_TICKET_STATUSES.includes(ticket.status)).length,
    avgResolutionHours,
    totalBilled: ((paymentsRes.data ?? []) as any[]).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0,
    ),
    activeBundle,
    contractDaysLeft: activeBundle?.days_until_expiry ?? null,
  } satisfies ClientOverview;
}

export function useClientOverview(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "overview"],
    queryFn: () => fetchClientOverview(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchClientActivity(clientId: string) {
  if (!clientId) return [];
  const [ticketsRes, notesRes, documentsRes, portalRes, bundleRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, ticket_code, status, created_at, completed_at, closed_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(40),
    (supabase as any)
      .from("client_notes")
      .select("id, content, created_at, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(30),
    (supabase as any)
      .from("client_documents")
      .select("id, file_name, document_type, uploaded_at")
      .eq("client_id", clientId)
      .order("uploaded_at", { ascending: false })
      .limit(30),
    (supabase as any)
      .from("portal_sessions")
      .select(
        "id, created_at, expires_at, contact:client_contacts!portal_sessions_contact_id_fkey(full_name)",
      )
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(30),
    (supabase as any)
      .from("client_bundle_assignments")
      .select("id, status, start_date, end_date, created_at, bundle:assistance_bundles(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  for (const res of [ticketsRes, notesRes, documentsRes, portalRes, bundleRes]) {
    if (res.error) throw res.error;
  }
  const items: ClientActivityItem[] = [];
  for (const ticket of (ticketsRes.data ?? []) as any[]) {
    items.push({
      id: `ticket-created-${ticket.id}`,
      type: "ticket_created",
      title: `Ticket ${ticket.ticket_code} aperto`,
      description: ticket.status,
      created_at: ticket.created_at,
    });
    if (ticket.completed_at || ticket.closed_at) {
      items.push({
        id: `ticket-closed-${ticket.id}`,
        type: "ticket_closed",
        title: `Ticket ${ticket.ticket_code} chiuso`,
        description: null,
        created_at: ticket.completed_at || ticket.closed_at,
      });
    }
  }
  for (const note of (notesRes.data ?? []) as any[]) {
    items.push({
      id: `note-${note.id}`,
      type: "note",
      title: "Nota interna aggiornata",
      description: note.content,
      created_at: note.updated_at,
    });
  }
  for (const doc of (documentsRes.data ?? []) as any[]) {
    items.push({
      id: `document-${doc.id}`,
      type: "document",
      title: `Documento caricato: ${doc.file_name}`,
      description: doc.document_type,
      created_at: doc.uploaded_at,
    });
  }
  for (const portal of (portalRes.data ?? []) as any[]) {
    items.push({
      id: `portal-${portal.id}`,
      type: "portal_access",
      title: "Accesso portale generato",
      description: portal.contact?.full_name ?? null,
      created_at: portal.created_at,
    });
  }
  for (const bundle of (bundleRes.data ?? []) as any[]) {
    items.push({
      id: `bundle-${bundle.id}`,
      type: "bundle",
      title: `Contratto ${bundle.bundle?.name ?? ""}`,
      description: bundle.status,
      created_at: bundle.created_at,
    });
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80);
}

export function useClientActivity(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "activity"],
    queryFn: () => fetchClientActivity(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchClientDocuments(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await (supabase as any)
    .from("client_documents")
    .select(
      "id, client_id, file_name, storage_bucket, storage_path, file_size, mime_type, document_type, description, uploaded_at, uploader:profiles!client_documents_uploaded_by_fkey(full_name, initials)",
    )
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientDocument[];
}

export function useClientDocuments(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "documents"],
    queryFn: () => fetchClientDocuments(clientId as string),
    enabled: !!clientId,
  });
}

export async function uploadClientDocument(params: {
  clientId: string;
  file: File;
  documentType: ClientDocument["document_type"];
  description?: string | null;
  userId?: string | null;
}) {
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const path = `clients/${params.clientId}/${Date.now()}-${safeName}`;
  const upload = await supabase.storage.from("client-documents").upload(path, params.file, {
    contentType: params.file.type || "application/octet-stream",
  });
  if (upload.error) throw upload.error;
  const { error } = await (supabase as any).from("client_documents").insert({
    client_id: params.clientId,
    file_name: params.file.name,
    storage_path: path,
    file_size: params.file.size,
    mime_type: params.file.type || null,
    document_type: params.documentType,
    description: params.description?.trim() || null,
    uploaded_by: params.userId ?? null,
  });
  if (error) throw error;
  return true;
}

export async function getClientDocumentSignedUrl(document: ClientDocument) {
  const { data, error } = await supabase.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, 60 * 10, { download: document.file_name });
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteClientDocument(document: ClientDocument) {
  const remove = await supabase.storage
    .from(document.storage_bucket)
    .remove([document.storage_path]);
  if (remove.error) throw remove.error;
  const { error } = await (supabase as any).from("client_documents").delete().eq("id", document.id);
  if (error) throw error;
  return true;
}

export async function fetchClientContractAlerts(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await (supabase as any)
    .from("client_contract_alerts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function useClientContractAlerts(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "contract-alerts"],
    queryFn: () => fetchClientContractAlerts(clientId as string),
    enabled: !!clientId,
  });
}

export async function upsertClientContractAlert(params: {
  clientId: string;
  bundleAssignmentId?: string | null;
  daysBefore: number;
  channel: "in_app" | "email";
  enabled: boolean;
  userId?: string | null;
}) {
  let existingQuery = (supabase as any)
    .from("client_contract_alerts")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("channel", params.channel);

  existingQuery = params.bundleAssignmentId
    ? existingQuery.eq("bundle_assignment_id", params.bundleAssignmentId)
    : existingQuery.is("bundle_assignment_id", null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    client_id: params.clientId,
    bundle_assignment_id: params.bundleAssignmentId ?? null,
    days_before: params.daysBefore,
    channel: params.channel,
    enabled: params.enabled,
    created_by: params.userId ?? null,
  };

  const { error } = existing?.id
    ? await (supabase as any).from("client_contract_alerts").update(payload).eq("id", existing.id)
    : await (supabase as any).from("client_contract_alerts").insert(payload);
  if (error) throw error;
  return true;
}

export async function fetchContactPortalAccess(contactIds: string[]) {
  const ids = Array.from(new Set(contactIds.filter(Boolean)));
  const result = Object.fromEntries(ids.map((id) => [id, false])) as Record<string, boolean>;
  if (!ids.length) return result;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("portal_sessions")
    .select("contact_id")
    .in("contact_id", ids)
    .is("revoked_at", null)
    .gt("expires_at", now);
  if (error) throw error;
  for (const row of (data ?? []) as any[]) {
    if (row.contact_id) result[row.contact_id] = true;
  }
  return result;
}

export function useContactPortalAccess(contactIds: string[]) {
  const key = contactIds.filter(Boolean).sort().join(",");
  return useQuery({
    queryKey: ["clients", "contacts", "portal-access", key],
    queryFn: () => fetchContactPortalAccess(contactIds),
    enabled: !!contactIds.length,
  });
}

export type GlobalContactsParams = { q?: string; page?: number; pageSize?: number };

export async function fetchGlobalContacts(params?: GlobalContactsParams) {
  const PAGE_SIZE = params?.pageSize;
  const page = params?.page;
  let query = supabase
    .from("client_contacts")
    .select(
      "id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes, client:clients(id, name, company_name, portal_enabled)",
    )
    .order("full_name");
  const term = (params?.q || "").trim().replace(/[,%]/g, "");
  if (term) {
    const { data: matchingClients, error: clientsError } = await supabase
      .from("clients")
      .select("id")
      .or(`name.ilike.%${term}%,company_name.ilike.%${term}%`)
      .limit(500);
    if (clientsError) throw clientsError;
    const matchingClientIds = (matchingClients ?? []).map((row: any) => row.id).filter(Boolean);
    const filters = [
      `full_name.ilike.%${term}%`,
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
      `job_title.ilike.%${term}%`,
      `department.ilike.%${term}%`,
    ];
    if (matchingClientIds.length) {
      filters.push(`client_id.in.(${matchingClientIds.join(",")})`);
    }
    query = query.or(filters.join(","));
  }
  if (PAGE_SIZE != null && page != null) {
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const access = await fetchContactPortalAccess(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, portal_active: !!access[row.id] })) as GlobalContactRow[];
}

export function useGlobalContacts(params?: GlobalContactsParams) {
  return useQuery({
    queryKey: ["clients", "contacts", "global", params?.q || ""],
    queryFn: () => fetchGlobalContacts(params),
  });
}

export type GlobalContactsListParams = GlobalContactsParams & { page?: number; pageSize?: number };

export async function fetchGlobalContactsPage(params?: GlobalContactsListParams) {
  return fetchGlobalContacts({
    ...params,
    page: params?.page ?? 0,
    pageSize: params?.pageSize ?? LIST_PAGE_SIZE,
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

export async function fetchClientTickets(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, ticket_code, requester, software, status, priority, created_at, assignee:profiles!tickets_assignee_id_fkey(full_name, initials)",
    )
    .eq("client_id", clientId)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useClientTickets(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "tickets"],
    queryFn: () => fetchClientTickets(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchClientDevices(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("devices")
    .select("id, asset_tag, model, serial, os, status, assigned_to, created_at, updated_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useClientDevices(clientId: string | null) {
  return useQuery({
    queryKey: ["clients", clientId, "devices"],
    queryFn: () => fetchClientDevices(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchAllClientsForExport() {
  let rows: any[] = [];
  let offset = 0;
  const chunk = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("clients")
      .select(CLIENT_SELECT)
      .order("name")
      .range(offset, offset + chunk - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    rows = rows.concat(data);
    offset += chunk;
  }
  return rows;
}

async function createClient(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("clients")
    .insert(payload as any)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function updateClient(id: string, payload: Record<string, any>) {
  const { error } = await supabase
    .from("clients")
    .update(payload as any)
    .eq("id", id);
  if (error) throw error;
  return true;
}

async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
  return true;
}

async function bulkDeleteClients(ids: string[]) {
  const { error } = await supabase.from("clients").delete().in("id", ids);
  if (error) throw error;
  return true;
}

async function createContact(clientId: string, payload: Record<string, any>) {
  const insert = { client_id: clientId, ...payload };
  const { error } = await supabase.from("client_contacts").insert(insert as any);
  if (error) throw error;
  return true;
}

async function updateContact(id: string, payload: Record<string, any>) {
  const { error } = await supabase
    .from("client_contacts")
    .update(payload as any)
    .eq("id", id);
  if (error) throw error;
  return true;
}

async function deleteContact(id: string) {
  const { error } = await supabase.from("client_contacts").delete().eq("id", id);
  if (error) throw error;
  return true;
}

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
      if (vars.clientId) qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "contacts"] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId: _clientId }: { id: string; clientId?: string }) =>
      deleteContact(id),
    onSuccess: (_res, vars) => {
      if (vars.clientId) qc.invalidateQueries({ queryKey: ["clients", vars.clientId, "contacts"] });
    },
  });
}

export default {
  fetchClientsList,
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
  fetchContactPortalAccess,
  useContactPortalAccess,
  fetchGlobalContacts,
  useGlobalContacts,
  fetchGlobalContactsPage,
  useGlobalContactsInfiniteList,
  fetchClientTickets,
  useClientTickets,
  fetchClientDevices,
  useClientDevices,
  fetchAllClientsForExport,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useBulkDeleteClients,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
};
