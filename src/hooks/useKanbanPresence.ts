import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 *
 */
export interface ViewerInfo {
  user_id: string;
  full_name: string;
  initials: string;
}

interface PresenceState {
  user_id: string;
  full_name: string;
  initials: string;
  card_id: string | null;
}

/**
 * Tracks which card the current user is viewing and exposes a map of
 * `cardId → ViewerInfo[]` for all other connected users.
 *
 * - Call `setCurrentCard(cardId)` on card hover and `setCurrentCard(null)` on leave.
 * - The hook filters out the current user from the returned map automatically.
 * - Cleans up the Realtime channel on unmount.
 */
export function useKanbanPresence(
  userId: string | undefined,
  initials: string,
  fullName: string,
): {
  cardViewers: ReadonlyMap<string, ViewerInfo[]>;
  setCurrentCard: (cardId: string | null) => void;
} {
  const [cardViewers, setCardViewers] = useState<Map<string, ViewerInfo[]>>(new Map());
  const currentCardRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("kanban-presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceState[]>;
        const byCard = new Map<string, ViewerInfo[]>();

        for (const presences of Object.values(state)) {
          for (const p of presences) {
            if (p.user_id === userId) continue; // skip self
            if (!p.card_id) continue;
            const viewers = byCard.get(p.card_id) ?? [];
            // Avoid duplicates per user per card
            if (!viewers.some((v) => v.user_id === p.user_id)) {
              viewers.push({
                user_id: p.user_id,
                full_name: p.full_name,
                initials: p.initials,
              });
            }
            byCard.set(p.card_id, viewers);
          }
        }

        setCardViewers(byCard);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            full_name: fullName,
            initials,
            card_id: currentCardRef.current,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, initials, fullName]);

  const setCurrentCard = useCallback(
    (cardId: string | null) => {
      currentCardRef.current = cardId;
      const ch = channelRef.current;
      if (ch) {
        void ch.track({
          user_id: userId,
          full_name: fullName,
          initials,
          card_id: cardId,
        });
      }
    },
    [userId, initials, fullName],
  );

  return { cardViewers, setCurrentCard };
}
