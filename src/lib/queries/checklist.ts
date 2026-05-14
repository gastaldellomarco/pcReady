import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { ChecklistStructure } from '@/lib/pcready';
import { parseChecklistStructure } from '@/types/checklist-structure';

export interface ChecklistTemplateRow {
  id: string;
  name: string;
  description: string | null;
  structure: ChecklistStructure;
  is_default: boolean;
}

type ChecklistTemplateDbRow = {
  id: string;
  name: string;
  description: string | null;
  structure: Json;
  is_default: boolean;
};

export async function fetchChecklistTemplates(): Promise<ChecklistTemplateRow[]> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('id, name, description, structure, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ChecklistTemplateDbRow[]).map((row) => ({
    ...row,
    structure: parseChecklistStructure(row.structure),
  }));
}

export function useChecklistTemplates() {
  return useQuery({ queryKey: ['checklist_templates'], queryFn: () => fetchChecklistTemplates() });
}

async function createTemplate(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from('checklist_templates')
    .insert(payload as any)
    .select('id, name, description, structure, is_default')
    .single();
  if (error) throw error;
  const row = data as ChecklistTemplateDbRow;
  return { ...row, structure: parseChecklistStructure(row.structure) };
}

async function updateTemplate(id: string, patch: Record<string, any>) {
  const { error } = await supabase.from('checklist_templates').update(patch as any).eq('id', id);
  if (error) throw error;
  return true;
}

async function deleteTemplate(id: string) {
  const { error } = await supabase.from('checklist_templates').delete().eq('id', id);
  if (error) throw error;
  return true;
}

async function setDefaultTemplate(id: string) {
  await supabase.from('checklist_templates').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await supabase.from('checklist_templates').update({ is_default: true }).eq('id', id);
  if (error) throw error;
  return true;
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (payload: Record<string, any>) => createTemplate(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }) });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Record<string, any> }) => updateTemplate(id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }) });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => deleteTemplate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }) });
}

export function useSetDefaultTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => setDefaultTemplate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist_templates'] }) });
}

export default { fetchChecklistTemplates, useChecklistTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useSetDefaultTemplate };
