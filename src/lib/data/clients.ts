/* eslint-disable jsdoc/require-jsdoc */
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────

export const CLIENT_SELECT =
  "id, name, company_name, vat_number, fiscal_code, email, phone, address, notes, website_url, portal_enabled, updated_at";

export const OPEN_TICKET_STATUSES = ["pending", "in-progress", "testing", "ready"] as const;

// ─── Types ────────────────────────────────────────────────────────────

export type ClientsListParams = { q?: string; page?: number; pageSize?: number };

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
  link?: string;
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
  is_starred: boolean;
  private_note: string | null;
  availability_status: "available" | "vacation" | "sick_leave" | "unavailable" | null;
  return_date: string | null;
  group_id: string | null;
  group_name?: string | null;
};

export type ContactGroup = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactInteractionItem = {
  id: string;
  type: "ticket_opened" | "ticket_closed" | "portal_login" | "email_sent";
  title: string;
  description: string | null;
  created_at: string;
  link?: string;
};

export type DuplicateCandidate = {
  contactA: GlobalContactRow;
  contactB: GlobalContactRow;
  similarity: number;
};

export type GlobalContactsParams = { q?: string; page?: number; pageSize?: number };
export type GlobalContactsListParams = GlobalContactsParams & { page?: number; pageSize?: number };

// ─── Fetch: Clients ───────────────────────────────────────────────────

export async function fetchClientsList(params: ClientsListParams) {
  const PAGE_SIZE = params.pageSize ?? 25;
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

// ─── Fetch: Contacts ──────────────────────────────────────────────────

export async function fetchClientContacts(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("client_contacts")
    .select(
      "id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes, is_starred, private_note, availability_status, return_date, group_id",
    )
    .eq("client_id", clientId)
    .order("is_primary", { ascending: false })
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as any[];
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

// ─── Fetch: Stats ─────────────────────────────────────────────────────

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

// ─── Fetch: Tags ──────────────────────────────────────────────────────

export async function fetchClientTags() {
  const { data, error } = await (supabase as any)
    .from("client_tags")
    .select("id, name, color")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClientTag[];
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

// ─── Mutations: Tags ──────────────────────────────────────────────────

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

// ─── Fetch & Mutations: Notes ─────────────────────────────────────────

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

// ─── Fetch: Overview ──────────────────────────────────────────────────

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

// ─── Fetch: Activity ──────────────────────────────────────────────────

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
      link: `/tickets?id=${ticket.id}`,
    });
    if (ticket.completed_at || ticket.closed_at) {
      items.push({
        id: `ticket-closed-${ticket.id}`,
        type: "ticket_closed",
        title: `Ticket ${ticket.ticket_code} chiuso`,
        description: null,
        created_at: ticket.completed_at || ticket.closed_at,
        link: `/tickets?id=${ticket.id}`,
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

// ─── Fetch: Documents ─────────────────────────────────────────────────

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

// ─── Mutations: Documents ─────────────────────────────────────────────

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

// ─── Fetch & Mutations: Contract Alerts ───────────────────────────────

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

// ─── Mutations: CRUD Client ───────────────────────────────────────────

export async function createClient(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("clients")
    .insert(payload as any)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, payload: Record<string, any>) {
  const { error } = await supabase
    .from("clients")
    .update(payload as any)
    .eq("id", id);
  if (error) throw error;
  return true;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function bulkDeleteClients(ids: string[]) {
  const { error } = await supabase.from("clients").delete().in("id", ids);
  if (error) throw error;
  return true;
}

// ─── Mutations: CRUD Contact ──────────────────────────────────────────

export async function createContact(clientId: string, payload: Record<string, any>) {
  const insert = { client_id: clientId, ...payload };
  const { error } = await supabase.from("client_contacts").insert(insert as any);
  if (error) throw error;
  return true;
}

export async function updateContact(id: string, payload: Record<string, any>) {
  const { error } = await supabase
    .from("client_contacts")
    .update(payload as any)
    .eq("id", id);
  if (error) throw error;
  return true;
}

export async function deleteContact(id: string) {
  const { error } = await supabase.from("client_contacts").delete().eq("id", id);
  if (error) throw error;
  return true;
}

// ─── Contact Groups ───────────────────────────────────────────────────

export async function fetchContactGroups(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await (supabase as any)
    .from("contact_groups")
    .select("id, client_id, name, description, created_at, updated_at")
    .eq("client_id", clientId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ContactGroup[];
}

export async function createContactGroup(clientId: string, name: string, description?: string | null) {
  const { error } = await (supabase as any)
    .from("contact_groups")
    .insert({ client_id: clientId, name: name.trim(), description: description?.trim() || null });
  if (error) throw error;
  return true;
}

export async function updateContactGroup(id: string, name: string, description?: string | null) {
  const { error } = await (supabase as any)
    .from("contact_groups")
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq("id", id);
  if (error) throw error;
  return true;
}

export async function deleteContactGroup(id: string) {
  const { error } = await (supabase as any).from("contact_groups").delete().eq("id", id);
  if (error) throw error;
  return true;
}

// ─── Contact: Starred & Availability ──────────────────────────────────

export async function toggleStarContact(contactId: string, isStarred: boolean) {
  const { error } = await supabase
    .from("client_contacts")
    .update({ is_starred: isStarred } as any)
    .eq("id", contactId);
  if (error) throw error;
  return true;
}

export async function updateContactAvailability(
  contactId: string,
  availabilityStatus: string | null,
  returnDate: string | null,
) {
  const { error } = await supabase
    .from("client_contacts")
    .update({
      availability_status: availabilityStatus,
      return_date: returnDate,
    } as any)
    .eq("id", contactId);
  if (error) throw error;
  return true;
}

export async function updateContactPrivateNote(contactId: string, privateNote: string | null) {
  const { error } = await supabase
    .from("client_contacts")
    .update({ private_note: privateNote?.trim() || null } as any)
    .eq("id", contactId);
  if (error) throw error;
  return true;
}

// ─── Global Contacts ──────────────────────────────────────────────────

export async function fetchGlobalContacts(params?: GlobalContactsParams) {
  const PAGE_SIZE = params?.pageSize;
  const page = params?.page;
  let query = supabase
    .from("client_contacts")
    .select(
      "id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes, is_starred, private_note, availability_status, return_date, group_id, client:clients(id, name, company_name, portal_enabled)",
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

export async function fetchGlobalContactsPage(params?: GlobalContactsListParams) {
  return fetchGlobalContacts({
    ...params,
    page: params?.page ?? 0,
    pageSize: params?.pageSize ?? 25,
  });
}

// ─── Client Tickets & Devices ─────────────────────────────────────────

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

// ─── Duplicate Detection & Merge ──────────────────────────────────────

export async function fetchDuplicateCandidates(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("client_contacts")
    .select(
      "id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes, is_starred, private_note, availability_status, return_date, group_id, client:clients(id, name, company_name, portal_enabled)",
    )
    .eq("client_id", clientId)
    .not("email", "is", null)
    .order("full_name");
  if (error) throw error;

  const rows = (data ?? []) as Record<string, any>[];
  const candidates: DuplicateCandidate[] = [];
  const seen = new Set<string>();

  const rawCandidates: { a: Record<string, any>; b: Record<string, any>; similarity: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const pairKey = [a.id, b.id].sort().join("|");
      if (seen.has(pairKey)) continue;

      const emailA = ((a.email as string) || "").toLowerCase().trim();
      const emailB = ((b.email as string) || "").toLowerCase().trim();
      if (emailA !== emailB) continue;

      const nameA = ((a.full_name as string) || "").toLowerCase().trim();
      const nameB = ((b.full_name as string) || "").toLowerCase().trim();
      const similarity = diceSimilarity(nameA, nameB);
      if (similarity < 0.75) continue;

      seen.add(pairKey);
      rawCandidates.push({ a, b, similarity: Math.round(similarity * 100) / 100 });
    }
  }

  const allIds = Array.from(
    new Set(rawCandidates.flatMap((c) => [c.a.id as string, c.b.id as string])),
  );
  const access = allIds.length ? await fetchContactPortalAccess(allIds) : {};

  for (const { a, b, similarity } of rawCandidates) {
    candidates.push({
      contactA: { ...a, portal_active: !!access[a.id] } as unknown as GlobalContactRow,
      contactB: { ...b, portal_active: !!access[b.id] } as unknown as GlobalContactRow,
      similarity,
    });
  }

  return candidates.sort((a, b) => b.similarity - a.similarity);
}

export async function mergeContacts(params: {
  survivorId: string;
  sourceId: string;
  fieldChoices: Record<string, "a" | "b">;
  deleteSource: boolean;
}) {
  const { survivorId, sourceId, fieldChoices, deleteSource } = params;

  const [survivorRes, sourceRes] = await Promise.all([
    supabase.from("client_contacts").select("*").eq("id", survivorId).single(),
    supabase.from("client_contacts").select("*").eq("id", sourceId).single(),
  ]);
  if (survivorRes.error) throw survivorRes.error;
  if (sourceRes.error) throw sourceRes.error;

  const survivor = survivorRes.data as Record<string, any>;
  const source = sourceRes.data as Record<string, any>;

  const mergableFields = [
    "full_name", "first_name", "last_name", "email", "phone",
    "job_title", "department", "is_primary", "is_starred",
    "notes", "private_note", "group_id",
    "availability_status", "return_date",
  ];

  const merged: Record<string, any> = {};
  for (const field of mergableFields) {
    const choice = fieldChoices[field] ?? "a";
    merged[field] = choice === "a" ? survivor[field] : source[field];
  }

  const { error: updateError } = await supabase
    .from("client_contacts")
    .update(merged as any)
    .eq("id", survivorId);
  if (updateError) throw updateError;

  const reassignOps: Promise<any>[] = [
    supabase.from("tickets").update({ requester_contact_id: survivorId } as any).eq("requester_contact_id", sourceId),
    supabase.from("portal_sessions").update({ contact_id: survivorId } as any).eq("contact_id", sourceId),
    (supabase as any).from("document_signatures").update({ contact_id: survivorId }).eq("contact_id", sourceId),
  ];
  const reassignResults = await Promise.allSettled(reassignOps);
  for (const result of reassignResults) {
    if (result.status === "rejected") throw result.reason;
  }

  if (deleteSource) {
    const { error: deleteError } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", sourceId);
    if (deleteError) throw deleteError;
  } else {
    const { error: softError } = await supabase
      .from("client_contacts")
      .update({ merged_into_id: survivorId, merged_at: new Date().toISOString() } as any)
      .eq("id", sourceId);
    if (softError) throw softError;
  }

  const survivorName = merged.full_name || [merged.first_name, merged.last_name].filter(Boolean).join(" ");
  const sourceName = source.full_name || [source.first_name, source.last_name].filter(Boolean).join(" ");
  await (supabase as any).from("activity_log").insert({
    type: "contact_merged",
    message: `Contatti uniti: ${survivorName} ← ${sourceName}`,
    entity_type: "client_contact",
    entity_id: survivorId,
    action_type: "contact_merged",
    severity: "info",
  });

  return true;
}

// ─── Interaction History ──────────────────────────────────────────────

export async function fetchContactInteractionHistory(contactId: string) {
  if (!contactId) return [];

  const [ticketsRes, portalRes, activityRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, ticket_code, software, status, created_at, completed_at, closed_at")
      .eq("requester_contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("portal_sessions")
      .select("id, created_at, expires_at, revoked_at")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50),
    (supabase as any)
      .from("activity_log")
      .select("id, message, created_at")
      .eq("entity_type", "client_contact")
      .eq("entity_id", contactId)
      .eq("action_type", "email_sent")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (ticketsRes.error) throw ticketsRes.error;
  if (portalRes.error) throw portalRes.error;
  if (activityRes.error) throw activityRes.error;

  const items: ContactInteractionItem[] = [];

  for (const ticket of (ticketsRes.data ?? []) as any[]) {
    items.push({
      id: `ticket-opened-${ticket.id}`,
      type: "ticket_opened",
      title: `Ticket ${ticket.ticket_code} — ${ticket.software || "Senza titolo"}`,
      description: ticket.status,
      created_at: ticket.created_at,
      link: `/tickets?id=${ticket.id}`,
    });
    if (ticket.completed_at || ticket.closed_at) {
      items.push({
        id: `ticket-closed-${ticket.id}`,
        type: "ticket_closed",
        title: `Ticket ${ticket.ticket_code} chiuso`,
        description: null,
        created_at: ticket.completed_at || ticket.closed_at,
        link: `/tickets?id=${ticket.id}`,
      });
    }
  }

  for (const session of (portalRes.data ?? []) as any[]) {
    items.push({
      id: `portal-${session.id}`,
      type: "portal_login",
      title: session.revoked_at ? "Accesso portale revocato" : "Accesso al portale",
      description: session.revoked_at
        ? `Revocato il ${session.revoked_at}`
        : `Scade il ${session.expires_at}`,
      created_at: session.created_at,
    });
  }

  for (const log of (activityRes.data ?? []) as any[]) {
    items.push({
      id: `email-${log.id}`,
      type: "email_sent",
      title: "Email inviata",
      description: log.message,
      created_at: log.created_at,
    });
  }

  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ─── Helpers ───────────────────────────────────────────────────────────

function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const intersection = bigramsA.filter((bg) => bigramsB.includes(bg)).length;
  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

function bigrams(s: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    result.push(s.slice(i, i + 2));
  }
  return result;
}
