import { useSyncExternalStore } from "react";
import {
  getRealtimeConnectionStatus,
  subscribeRealtimeConnectionStatus,
} from "@/integrations/supabase/client";

/**
 *
 */
export function useRealtimeConnectionStatus() {
  return useSyncExternalStore(
    subscribeRealtimeConnectionStatus,
    getRealtimeConnectionStatus,
    getRealtimeConnectionStatus,
  );
}
