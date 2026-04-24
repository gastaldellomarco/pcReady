import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type TicketRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

type TicketRealtimeRow = Record<string, unknown>;

type UseTicketRealtimeOptions = {
  onChange?: (payload: RealtimePostgresChangesPayload<TicketRealtimeRow>) => void;
  onRefetch?: () => void | Promise<void>;
  enabled?: boolean;
};

export function useTicketRealtime({
  onChange,
  onRefetch,
  enabled = true,
}: UseTicketRealtimeOptions): void {
  const onChangeRef = useRef<typeof onChange>(onChange);
  const onRefetchRef = useRef<typeof onRefetch>(onRefetch);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRefetchRef.current = onRefetch;
  }, [onRefetch]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        async (payload: RealtimePostgresChangesPayload<TicketRealtimeRow>) => {
          const eventType = payload.eventType as TicketRealtimeEvent;

          if (eventType === 'INSERT' || eventType === 'UPDATE' || eventType === 'DELETE') {
            onChangeRef.current?.(payload);
            await onRefetchRef.current?.();
          }
        }
      )
      .subscribe();

    return () => {
      // ✅ FIX #1: Unsubscribe PRIMA di removeChannel
      // Questo previene il memory leak
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [enabled]);
}