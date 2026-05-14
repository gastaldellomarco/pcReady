import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ClientsListParams = { q?: string; page?: number; pageSize?: number };

const CLIENT_SELECT =
  'id, name, company_name, vat_number, fiscal_code, email, phone, address, notes, website_url, portal_enabled, updated_at';

const OPEN_TICKET_STATUSES = ['pending', 'in-progress', 'testing', 'ready'] as const;

export async function fetchClientsList(params: ClientsListParams) {
  const PAGE_SIZE = params.pageSize ?? 50;
  const page = params.page ?? 0;
  let query = supabase.from('clients').select(CLIENT_SELECT, { count: 'exact' }).order('name');
  const term = (params.q || '').trim().replace(/[,%]/g, '');
  if (term) {
    const { data: matchingContacts, error: contactsError } = await supabase
      .from('client_contacts')
      .select('client_id')
      .ilike('email', `%${term}%`)
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
      filters.push(`id.in.(${contactClientIds.join(',')})`);
    }
    query = query.or(filters.join(','));
  }
  const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  return { data: (data ?? []) as any[], count: count ?? 0 };
}

export function useClientsList(params: ClientsListParams) {
  return useQuery({
    queryKey: ['clients', params.q || '', params.page ?? 0, params.pageSize ?? 50],
    queryFn: () => fetchClientsList(params),
    placeholderData: (previousData) => previousData,
  });
}

export async function fetchClientContacts(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('client_contacts')
    .select('id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes')
    .eq('client_id', clientId)
    .order('is_primary', { ascending: false })
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useClientContacts(clientId: string | null) {
  return useQuery({ queryKey: ['clients', clientId, 'contacts'], queryFn: () => fetchClientContacts(clientId as string), enabled: !!clientId });
}

export type ClientStats = {
  openTickets: number;
  devices: number;
  contacts: number;
  portalActive: boolean;
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
    ids.map((id) => [id, { openTickets: 0, devices: 0, contacts: 0, portalActive: false } satisfies ClientStats]),
  ) as Record<string, ClientStats>;
  if (!ids.length) return empty;

  const [ticketsRes, devicesRes, contactsRes] = await Promise.all([
    supabase.from('tickets').select('id, client_id, status').in('client_id', ids).in('status', OPEN_TICKET_STATUSES as any),
    supabase.from('devices').select('id, client_id').in('client_id', ids),
    supabase.from('client_contacts').select('id, client_id').in('client_id', ids),
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
      .from('portal_sessions')
      .select('contact_id')
      .in('contact_id', contactIds)
      .is('revoked_at', null)
      .gt('expires_at', now);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      const clientId = contactClientById.get(row.contact_id);
      if (clientId && stats[clientId]) stats[clientId].portalActive = true;
    }
  }

  return stats;
}

export function useClientStats(clientIds: string[]) {
  const key = clientIds.filter(Boolean).sort().join(',');
  return useQuery({
    queryKey: ['clients', 'stats', key],
    queryFn: () => fetchClientStats(clientIds),
    enabled: !!clientIds.length,
  });
}

export async function fetchContactPortalAccess(contactIds: string[]) {
  const ids = Array.from(new Set(contactIds.filter(Boolean)));
  const result = Object.fromEntries(ids.map((id) => [id, false])) as Record<string, boolean>;
  if (!ids.length) return result;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('portal_sessions')
    .select('contact_id')
    .in('contact_id', ids)
    .is('revoked_at', null)
    .gt('expires_at', now);
  if (error) throw error;
  for (const row of (data ?? []) as any[]) {
    if (row.contact_id) result[row.contact_id] = true;
  }
  return result;
}

export function useContactPortalAccess(contactIds: string[]) {
  const key = contactIds.filter(Boolean).sort().join(',');
  return useQuery({
    queryKey: ['clients', 'contacts', 'portal-access', key],
    queryFn: () => fetchContactPortalAccess(contactIds),
    enabled: !!contactIds.length,
  });
}

export async function fetchGlobalContacts() {
  const { data, error } = await supabase
    .from('client_contacts')
    .select(
      'id, client_id, full_name, first_name, last_name, email, phone, job_title, department, is_primary, notes, client:clients(id, name, company_name, portal_enabled)',
    )
    .order('full_name');
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const access = await fetchContactPortalAccess(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, portal_active: !!access[row.id] })) as GlobalContactRow[];
}

export function useGlobalContacts() {
  return useQuery({
    queryKey: ['clients', 'contacts', 'global'],
    queryFn: fetchGlobalContacts,
  });
}

export async function fetchClientTickets(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('tickets')
    .select('id, ticket_code, requester, software, status, priority, created_at, assignee:profiles!tickets_assignee_id_fkey(full_name, initials)')
    .eq('client_id', clientId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useClientTickets(clientId: string | null) {
  return useQuery({
    queryKey: ['clients', clientId, 'tickets'],
    queryFn: () => fetchClientTickets(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchClientDevices(clientId: string) {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from('devices')
    .select('id, model, serial, os, status, assigned_to, created_at, updated_at')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useClientDevices(clientId: string | null) {
  return useQuery({
    queryKey: ['clients', clientId, 'devices'],
    queryFn: () => fetchClientDevices(clientId as string),
    enabled: !!clientId,
  });
}

export async function fetchAllClientsForExport() {
  let rows: any[] = [];
  let offset = 0;
  const chunk = 1000;
  while (true) {
    const { data, error } = await supabase.from('clients').select(CLIENT_SELECT).order('name').range(offset, offset + chunk - 1);
    if (error) throw error;
    if (!data || !data.length) break;
    rows = rows.concat(data);
    offset += chunk;
  }
  return rows;
}

async function createClient(payload: Record<string, any>) {
  const { data, error } = await supabase.from('clients').insert(payload as any).select('id').single();
  if (error) throw error;
  return data;
}

async function updateClient(id: string, payload: Record<string, any>) {
  const { error } = await supabase.from('clients').update(payload as any).eq('id', id);
  if (error) throw error;
  return true;
}

async function deleteClient(id: string) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function bulkDeleteClients(ids: string[]) {
  const { error } = await supabase.from('clients').delete().in('id', ids);
  if (error) throw error;
  return true;
}

async function createContact(clientId: string, payload: Record<string, any>) {
  const insert = { client_id: clientId, ...payload };
  const { error } = await supabase.from('client_contacts').insert(insert as any);
  if (error) throw error;
  return true;
}

async function updateContact(id: string, payload: Record<string, any>) {
  const { error } = await supabase.from('client_contacts').update(payload as any).eq('id', id);
  if (error) throw error;
  return true;
}

async function deleteContact(id: string) {
  const { error } = await supabase.from('client_contacts').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: Record<string, any>) => createClient(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) => updateClient(id, payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteClient(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
}

export function useBulkDeleteClients() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids: string[]) => bulkDeleteClients(ids), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ clientId, payload }: { clientId: string; payload: Record<string, any> }) => createContact(clientId, payload), onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ['clients', vars.clientId, 'contacts'] }) });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, clientId, payload }: { id: string; clientId?: string; payload: Record<string, any> }) => updateContact(id, payload), onSuccess: (_res, vars) => {
      if (vars.clientId) qc.invalidateQueries({ queryKey: ['clients', vars.clientId, 'contacts'] });
    } });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, clientId }: { id: string; clientId?: string }) => deleteContact(id), onSuccess: (_res, vars) => {
      if (vars.clientId) qc.invalidateQueries({ queryKey: ['clients', vars.clientId, 'contacts'] });
    } });
}

export default {
  fetchClientsList,
  useClientsList,
  fetchClientContacts,
  useClientContacts,
  fetchClientStats,
  useClientStats,
  fetchContactPortalAccess,
  useContactPortalAccess,
  fetchGlobalContacts,
  useGlobalContacts,
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
