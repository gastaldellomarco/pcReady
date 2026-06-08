import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 *
 */
export type ScriptsListParams = { q?: string; category?: string };

// ── Explicit field select (excludes heavy `content` field loaded on-demand) ──
const SCRIPTS_LIST_SELECT =
  "id, name, category, description, language, icon, color, parameters, tags, created_by, created_at, updated_at";

/**
 *
 */
export async function fetchScriptsList() {
  const { data, error } = await supabase
    .from("scripts")
    .select(SCRIPTS_LIST_SELECT)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

const SCRIPT_DETAIL_SELECT = `${SCRIPTS_LIST_SELECT}, content`;

/**
 *
 */
export async function fetchScriptById(id: string) {
  const { data, error } = await supabase
    .from("scripts")
    .select(SCRIPT_DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/**
 *
 */
export function useScriptsList() {
  return useQuery({ queryKey: ["scripts"], queryFn: () => fetchScriptsList() });
}

async function deleteScript(id: string) {
  const { error } = await supabase.from("scripts").delete().eq("id", id);
  if (error) throw error;
  return true;
}

/**
 *
 */
export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScript(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scripts"] }),
  });
}

async function createScript(payload: TablesInsert<"scripts">) {
  const { data, error } = await supabase
    .from("scripts")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

async function updateScript(id: string, payload: TablesUpdate<"scripts">) {
  const { error } = await supabase
    .from("scripts")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
  return true;
}

/**
 *
 */
export function useCreateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TablesInsert<"scripts">) => createScript(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scripts"] }),
  });
}

/**
 *
 */
export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TablesUpdate<"scripts"> }) =>
      updateScript(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scripts"] }),
  });
}

// ── Tags ──
/**
 *
 */
export async function fetchScriptTags(): Promise<string[]> {
  const { data: raw, error } = await supabase
    .from("scripts")
    .select("tags");
  if (error) throw error;
  const tagSet = new Set<string>();
  (raw ?? []).forEach((row) => {
    (row.tags ?? []).forEach((t: string) => tagSet.add(t));
  });
  return Array.from(tagSet).sort();
}

// ── Favorites ──
/**
 *
 */
export function useScriptFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ["scripts", "favorites", userId],
    queryFn: async () => {
      if (!userId) return [] as string[];
      const { data, error } = await supabase
        .from("script_favorites")
        .select("script_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((row) => row.script_id) as string[];
    },
    enabled: !!userId,
  });
}

/**
 *
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, scriptId, favored }: { userId: string; scriptId: string; favored: boolean }) => {
      if (favored) {
        const { error } = await supabase
          .from("script_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("script_id", scriptId);
        if (error) throw error;
        return false;
      } else {
        const { error } = await supabase
          .from("script_favorites")
          .insert({ user_id: userId, script_id: scriptId });
        if (error) throw error;
        return true;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scripts", "favorites"] });
    },
  });
}

export default {
  fetchScriptsList,
  fetchScriptById,
  fetchScriptTags,
  useScriptsList,
  useDeleteScript,
  useCreateScript,
  useUpdateScript,
  useScriptFavorites,
  useToggleFavorite,
};
