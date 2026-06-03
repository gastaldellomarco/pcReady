import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseChecklistStructure } from "@/types/checklist-structure";
import { QUERY_KEYS } from "./keys";
import type { Json } from "@/integrations/supabase/types";
import type { ChecklistStructure } from "@/lib/pcready";

const CHECKLIST_INSTANCE_SELECT =
  "id, ticket_id, template_id, title, structure, status, assigned_to, section_assignments, completed_by, completion_confirmed, signature_name, created_at, updated_at, completed_at";
const CHECKLIST_RESPONSE_SELECT = "id, instance_id, item_key, value, compiled_by, compiled_at";

/**
 *
 */
export interface ChecklistTemplateRow {
  id: string;
  name: string;
  description: string | null;
  structure: ChecklistStructure;
  is_default: boolean;
  tags: string[];
}

/**
 *
 */
export interface TicketChecklistResponseRow {
  id: string;
  instance_id: string;
  item_key: string;
  value: string | null;
  compiled_by: string | null;
  compiled_at: string;
}

/**
 *
 */
export interface TicketChecklistInstanceRow {
  id: string;
  ticket_id: string;
  template_id: string | null;
  title: string;
  structure: ChecklistStructure;
  status: "pending" | "in_progress" | "completed";
  assigned_to: string | null;
  section_assignments: Record<string, string | null>;
  completed_by: string | null;
  completion_confirmed: boolean;
  signature_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  responses: TicketChecklistResponseRow[];
}

function sectionAssignmentsFromStructure(structure: ChecklistStructure) {
  const assignments: Record<string, string | null> = {};
  for (const group of Object.values(structure)) {
    if (group.sections) {
      for (const [secKey, section] of Object.entries(group.sections)) {
        if (section.assigned_to) {
          assignments[secKey] = section.assigned_to;
        }
      }
    }
  }
  return assignments;
}

function mapInstance(row: any): TicketChecklistInstanceRow {
  return {
    ...row,
    structure: parseChecklistStructure(row.structure),
    section_assignments: (row.section_assignments ?? {}) as Record<string, string | null>,
    responses: (row.responses ??
      row.ticket_checklist_responses ??
      []) as TicketChecklistResponseRow[],
  };
}

/**
 *
 */
export async function fetchChecklistTemplates(): Promise<ChecklistTemplateRow[]> {
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("id, name, description, structure, is_default, tags")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map((row: any) => ({
    ...row,
    structure: parseChecklistStructure(row.structure),
    tags: row.tags ?? [],
  }));
}

/**
 *
 */
export function useChecklistTemplates() {
  return useQuery({ queryKey: ["checklist_templates"], queryFn: () => fetchChecklistTemplates() });
}

async function createTemplate(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("checklist_templates")
    .insert(payload as any)
    .select("id, name, description, structure, is_default, tags")
    .single();
  if (error) throw error;
  const row = data as any;
  return { ...row, structure: parseChecklistStructure(row.structure), tags: row.tags ?? [] };
}

async function updateTemplate(id: string, patch: Record<string, any>) {
  const { error } = await supabase
    .from("checklist_templates")
    .update(patch as any)
    .eq("id", id);
  if (error) throw error;
  return true;
}

async function deleteTemplate(id: string) {
  const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
  if (error) throw error;
  return true;
}

async function setDefaultTemplate(id: string) {
  await supabase
    .from("checklist_templates")
    .update({ is_default: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase
    .from("checklist_templates")
    .update({ is_default: true })
    .eq("id", id);
  if (error) throw error;
  return true;
}

/**
 *
 */
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

/**
 *
 */
export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, any> }) =>
      updateTemplate(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

/**
 *
 */
export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

/**
 *
 */
export function useSetDefaultTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

/**
 *
 */
export async function fetchTicketChecklistInstances(
  ticketId: string,
): Promise<TicketChecklistInstanceRow[]> {
  if (!ticketId) return [];
  const { data, error } = await (supabase as any)
    .from("ticket_checklist_instances")
    .select(
      `${CHECKLIST_INSTANCE_SELECT}, responses:ticket_checklist_responses(${CHECKLIST_RESPONSE_SELECT})`,
    )
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as any[]).map(mapInstance);
}

/**
 *
 */
export function useTicketChecklistInstances(ticketId?: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ticket(ticketId || ""), "checklist-instances"],
    queryFn: () => fetchTicketChecklistInstances(ticketId || ""),
    enabled: !!ticketId,
  });
}

/**
 *
 */
export async function createTicketChecklistInstanceFromTemplate(params: {
  ticketId: string;
  templateId: string;
  assignedTo?: string | null;
}) {
  const { data: template, error: templateError } = await supabase
    .from("checklist_templates")
    .select("id, name, structure")
    .eq("id", params.templateId)
    .single();
  if (templateError) throw templateError;
  const structure = parseChecklistStructure((template as any).structure);
  const { data, error } = await (supabase as any)
    .from("ticket_checklist_instances")
    .insert({
      ticket_id: params.ticketId,
      template_id: (template as any).id,
      title: (template as any).name,
      structure: structure as unknown as Json,
      assigned_to: params.assignedTo ?? null,
      section_assignments: sectionAssignmentsFromStructure(structure) as Json,
    })
    .select(
      `${CHECKLIST_INSTANCE_SELECT}, responses:ticket_checklist_responses(${CHECKLIST_RESPONSE_SELECT})`,
    )
    .single();
  if (error) throw error;
  return mapInstance(data);
}

/**
 *
 */
export async function upsertTicketChecklistResponse(params: {
  instanceId: string;
  itemKey: string;
  value: string | null;
  compiledBy: string;
}) {
  const { data, error } = await (supabase as any)
    .from("ticket_checklist_responses")
    .upsert(
      {
        instance_id: params.instanceId,
        item_key: params.itemKey,
        value: params.value,
        compiled_by: params.compiledBy,
        compiled_at: new Date().toISOString(),
      },
      { onConflict: "instance_id,item_key" },
    )
    .select(CHECKLIST_RESPONSE_SELECT)
    .single();
  if (error) throw error;

  await (supabase as any)
    .from("ticket_checklist_instances")
    .update({ status: "in_progress" })
    .eq("id", params.instanceId)
    .eq("status", "pending");

  return data as TicketChecklistResponseRow;
}

/**
 *
 */
export async function completeTicketChecklistInstance(params: {
  instanceId: string;
  completedBy: string;
  signatureName?: string | null;
}) {
  const { data, error } = await (supabase as any)
    .from("ticket_checklist_instances")
    .update({
      status: "completed",
      completed_by: params.completedBy,
      completion_confirmed: true,
      signature_name: params.signatureName ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.instanceId)
    .select(
      `${CHECKLIST_INSTANCE_SELECT}, responses:ticket_checklist_responses(${CHECKLIST_RESPONSE_SELECT})`,
    )
    .single();
  if (error) throw error;
  return mapInstance(data);
}

/**
 *
 */
export function useCreateTicketChecklistInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTicketChecklistInstanceFromTemplate,
    onSuccess: (row) => {
      qc.invalidateQueries({
        queryKey: [...QUERY_KEYS.ticket(row.ticket_id), "checklist-instances"],
      });
    },
  });
}

/**
 *
 */
export function useUpsertTicketChecklistResponse(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertTicketChecklistResponse,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticketId), "checklist-instances"] });
    },
  });
}

/**
 *
 */
export function useCompleteTicketChecklistInstance(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completeTicketChecklistInstance,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticketId), "checklist-instances"] });
      qc.invalidateQueries({ queryKey: ["checklist_templates", "completion-stats"] });
    },
  });
}

// ── Template completion stats ───────────────────────────────────────────
/**
 *
 */
export type TemplateCompletionStats = Record<string, { total: number; completed: number }>;

/**
 *
 */
export async function fetchTemplateCompletionStats(): Promise<TemplateCompletionStats> {
  const { data, error } = await supabase
    .from("ticket_checklist_instances")
    .select("template_id, status")
    .not("template_id", "is", null);
  if (error) throw error;
  const stats: Record<string, { total: number; completed: number }> = {};
  for (const row of (data ?? []) as { template_id: string; status: string }[]) {
    if (!stats[row.template_id]) stats[row.template_id] = { total: 0, completed: 0 };
    stats[row.template_id].total++;
    if (row.status === "completed") stats[row.template_id].completed++;
  }
  return stats;
}

/**
 *
 */
export function useTemplateCompletionStats() {
  return useQuery({
    queryKey: ["checklist_templates", "completion-stats"],
    queryFn: () => fetchTemplateCompletionStats(),
  });
}

