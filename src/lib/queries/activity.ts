import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 *
 */
export async function insertActivity(payload: Record<string, any>) {
  const { error } = await supabase.from("activity_log").insert(payload as any);
  if (error) throw error;
  return true;
}

/**
 *
 */
export function useInsertActivity() {
  return useMutation({ mutationFn: (payload: Record<string, any>) => insertActivity(payload) });
}

