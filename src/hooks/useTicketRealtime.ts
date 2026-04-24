import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type TicketRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

type TicketRealtimeRow = Record<string, unknown>;

type UseTicketRealtimeOptions = {
  onChange?: (payload: RealtimePostgresChangesPayload<TicketRealtimeRow>) => void;
  onRefetch?: () => void | Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
};

export function useTicketRealtime({
  onChange,
  onRefetch,
  enabled = true,
  debounceMs = 300,
}: UseTicketRealtimeOptions): void {
  const onChangeRef = useRef(onChange);
  const onRefetchRef = useRef(onRefetch);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRefetchRef.current = onRefetch;
  }, [onRefetch]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload: RealtimePostgresChangesPayload<TicketRealtimeRow>) => {
          const eventType = payload.eventType as TicketRealtimeEvent;

          if (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE') {
            onChangeRef.current?.(payload);

            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              void onRefetchRef.current?.();
            }, debounceMs);
          }
        }
      )
      .subscribe((status) => {
        // Handle channel status changes for basic reconnect logic
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Channel error, scheduling reconnect...');
          setTimeout(() => {
            try {
              void channel.subscribe();
            } catch (e) {
              // swallow
            }
          }, 5000);
        }
      });

    channelRef.current = channel;

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (channelRef.current) {
        void channelRef.current.unsubscribe();
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, debounceMs]);
}