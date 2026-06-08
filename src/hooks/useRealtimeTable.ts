import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { randomUUID } from "@/lib/random-uuid";
import type { DependencyList } from "react";

/**
 * Loads rows via `query`, then keeps them in sync with Postgres changes on `table`
 * (Supabase Realtime). Cleans up the channel on unmount.
 */
export function useRealtimeTable<T>(
  table: string,
  query: () => Promise<T[]>,
  deps: DependencyList = [],
): { data: T[]; loading: boolean; refresh: () => Promise<void> } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await queryRef.current();
      setData(result);
    } finally {
      setLoading(false);
    }
    // caller controls refresh via deps
  }, deps);

  const channelSuffix = useRef(randomUUID()).current;

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`realtime:public:${table}:${channelSuffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        void load();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, channelSuffix, load]);

  return { data, loading, refresh: load };
}
