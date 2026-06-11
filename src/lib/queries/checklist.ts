import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "./keys";
import {
  fetchChecklistTemplates,
  fetchTicketChecklistInstances,
  fetchTemplateCompletionStats,
  createTicketChecklistInstanceFromTemplate,
  upsertTicketChecklistResponse,
  completeTicketChecklistInstance,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  type ChecklistTemplateRow,
  type TicketChecklistResponseRow,
  type TicketChecklistInstanceRow,
  type TemplateCompletionStats,
} from "@/lib/data/checklist";

// ── Re-export types ──────────────────────────────────────────────────

export type {
  ChecklistTemplateRow,
  TicketChecklistResponseRow,
  TicketChecklistInstanceRow,
  TemplateCompletionStats,
};

// ── Re-export raw fetch/mutation functions ───────────────────────────

export {
  fetchChecklistTemplates,
  fetchTicketChecklistInstances,
  fetchTemplateCompletionStats,
  createTicketChecklistInstanceFromTemplate,
  upsertTicketChecklistResponse,
  completeTicketChecklistInstance,
};

// ── Hooks ────────────────────────────────────────────────────────────

export function useChecklistTemplates() {
  return useQuery({ queryKey: ["checklist_templates"], queryFn: () => fetchChecklistTemplates() });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createTemplate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, any> }) =>
      updateTemplate(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

export function useSetDefaultTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => setDefaultTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist_templates"] }),
  });
}

export function useTicketChecklistInstances(ticketId?: string | null) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ticket(ticketId || ""), "checklist-instances"],
    queryFn: () => fetchTicketChecklistInstances(ticketId || ""),
    enabled: !!ticketId,
  });
}

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

export function useUpsertTicketChecklistResponse(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertTicketChecklistResponse,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticketId), "checklist-instances"] });
    },
  });
}

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

export function useTemplateCompletionStats() {
  return useQuery({
    queryKey: ["checklist_templates", "completion-stats"],
    queryFn: () => fetchTemplateCompletionStats(),
  });
}
