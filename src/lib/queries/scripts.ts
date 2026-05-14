import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ScriptsListParams = { q?: string; category?: string };

export async function fetchScriptsList() {
  const { data, error } = await supabase.from('scripts').select('*').order('category', { ascending: true }).order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as any[];
}

export function useScriptsList() {
  return useQuery({ queryKey: ['scripts'], queryFn: () => fetchScriptsList() });
}

async function deleteScript(id: string) {
  const { error } = await supabase.from('scripts').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScript(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scripts'] }),
  });
}

async function createScript(payload: Record<string, any>) {
  const { data, error } = await supabase.from('scripts').insert(payload as any).select('id').single();
  if (error) throw error;
  return data;
}

async function updateScript(id: string, payload: Record<string, any>) {
  const { error } = await supabase.from('scripts').update(payload as any).eq('id', id);
  if (error) throw error;
  return true;
}

export function useCreateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createScript(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scripts'] }),
  });
}

export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) => updateScript(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scripts'] }),
  });
}

export default { fetchScriptsList, useScriptsList, useDeleteScript, useCreateScript, useUpdateScript };
