import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  createWidgetAnnotation,
  deleteWidgetAnnotation,
  listWidgetAnnotations,
  updateWidgetAnnotation,
} from "@/lib/widget-annotations";

/**
 * React Query hook for managing widget annotations.
 * 
 * When `widgetId` is provided, fetches annotations scoped to that widget.
 * When omitted (called from the drawer), fetches all annotations for the current user.
 * Provides `create`, `update`, and `remove` mutation functions with toast error handling.
 */
export function useWidgetAnnotations(accessToken: string | undefined, widgetId?: string) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listWidgetAnnotations);
  const createFn = useServerFn(createWidgetAnnotation);
  const updateFn = useServerFn(updateWidgetAnnotation);
  const deleteFn = useServerFn(deleteWidgetAnnotation);

  const queryKey = widgetId
    ? ["widget-annotations", widgetId]
    : ["widget-annotations", "all"];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!accessToken) return [];
      return listFn({ data: { accessToken, widgetId } });
    },
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: async (annotation: { widget_id: string; text: string; note_date?: string | null }) => {
      if (!accessToken) throw new Error("Non autenticato");
      return createFn({ data: { accessToken, annotation } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget-annotations"] });
    },
    onError: (error: Error) => {
      toast.error("Salvataggio non riuscito", {
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { annotationId: string; updates: { text?: string; note_date?: string | null } }) => {
      if (!accessToken) throw new Error("Non autenticato");
      return updateFn({ data: { accessToken, annotationId: args.annotationId, updates: args.updates } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget-annotations"] });
    },
    onError: (error: Error) => {
      toast.error("Modifica non riuscita", {
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (annotationId: string) => {
      if (!accessToken) throw new Error("Non autenticato");
      return deleteFn({ data: { accessToken, annotationId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widget-annotations"] });
    },
    onError: (error: Error) => {
      toast.error("Eliminazione non riuscita", {
        description: error.message,
      });
    },
  });

  return {
    annotations: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    remove: deleteMutation.mutate,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
