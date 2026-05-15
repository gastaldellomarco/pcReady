import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AutomationRule, AutomationFlow, AutomationFlowDefinition } from "@/types/automation";

export async function fetchAutomationFlows() {
  const { data, error } = await supabase
    .from("automation_flows")
    .select(
      "id, name, description, category, active, version, updated_at, flow_definition, last_run_at, summary",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AutomationRule[];
}

export function useAutomationFlows() {
  return useQuery({ queryKey: ["automation_flows"], queryFn: () => fetchAutomationFlows() });
}

export async function fetchAutomationFlowDefinition(id: string) {
  const { data, error } = await supabase
    .from("automation_flows")
    .select("flow_definition")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data?.flow_definition ?? {};
}

export function useAutomationFlowDefinition(id: string | null) {
  return useQuery({
    queryKey: ["automation_flows", id, "definition"],
    queryFn: () => fetchAutomationFlowDefinition(id as string),
    enabled: !!id,
  });
}

async function createAutomation(payload: Partial<AutomationFlow>) {
  const { data, error } = await supabase
    .from("automation_flows")
    .insert(payload as never)
    .select(
      "id, name, description, category, active, version, updated_at, flow_definition, last_run_at, summary",
    )
    .single();
  if (error) throw error;
  return data;
}

async function updateAutomation(id: string, payload: Partial<AutomationFlow>) {
  const { data, error } = await supabase
    .from("automation_flows")
    .update(payload as never)
    .eq("id", id)
    .select(
      "id, name, description, category, active, version, updated_at, flow_definition, last_run_at, summary",
    )
    .single();
  if (error) throw error;
  return data;
}

async function deleteAutomation(id: string) {
  const { error } = await supabase.from("automation_flows").delete().eq("id", id);
  if (error) throw error;
  return true;
}

async function duplicateAutomation(id: string, name: string) {
  const { data: flowData, error: fetchErr } = await supabase
    .from("automation_flows")
    .select("flow_definition")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;
  const { data, error } = await supabase
    .from("automation_flows")
    .insert({
      name,
      description: null,
      category: null,
      active: false,
      version: 1,
      flow_definition: flowData?.flow_definition ?? {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id;
}

async function archiveAutomation(id: string, fd: AutomationFlowDefinition) {
  const { error } = await supabase
    .from("automation_flows")
    .update({ active: false, flow_definition: fd as never })
    .eq("id", id);
  if (error) throw error;
  return true;
}

async function toggleAutomationActive(id: string, active: boolean) {
  const { data, error } = await supabase
    .from("automation_flows")
    .update({ active })
    .eq("id", id)
    .select("id, active")
    .single();
  if (error) throw error;
  return data;
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<AutomationFlow>) => createAutomation(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_flows"] }),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AutomationFlow> }) =>
      updateAutomation(id, payload),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["automation_flows"] });
      qc.invalidateQueries({ queryKey: ["automation_flows", vars.id, "definition"] });
    },
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_flows"] }),
  });
}

export function useDuplicateAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => duplicateAutomation(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_flows"] }),
  });
}

export function useArchiveAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fd }: { id: string; fd: AutomationFlowDefinition }) => archiveAutomation(id, fd),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_flows"] }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      toggleAutomationActive(id, active),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["automation_flows"] });
      qc.invalidateQueries({ queryKey: ["automation_flows", vars.id, "definition"] });
    },
  });
}

export default {
  fetchAutomationFlows,
  useAutomationFlows,
  fetchAutomationFlowDefinition,
  useAutomationFlowDefinition,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  useDuplicateAutomation,
  useArchiveAutomation,
  useToggleAutomation,
};
