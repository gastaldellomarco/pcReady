import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ClientsListParams = { q?: string; page?: number; pageSize?: number };

const CLIENT_SELECT =
  'id, name, company_name, vat_number, fiscal_code, email, phone, address, notes, updated_at';

export async function fetchClientsList(params: ClientsListParams) {
  const PAGE_SIZE = params.pageSize ?? 50;
  const page = params.page ?? 0;
  let query = supabase.from('clients').select(CLIENT_SELECT, { count: 'exact' }).order('name');
  const term = (params.q || '').trim().replace(/[,%]/g, '');
  if (term) {
    query = query.or(
      `name.ilike.%${term}%,company_name.ilike.%${term}%,vat_number.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
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
  fetchAllClientsForExport,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useBulkDeleteClients,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
};
