import { useCallback, useSyncExternalStore } from "react";
import {
  getTicketId,
  subscribeTicket,
  closeTicketDetail,
  getTicketNeighbors,
  navigateNext,
  navigatePrev,
  getDeviceId,
  subscribeDevice,
  closeDeviceDetail,
} from "@/lib/detail-navigation";

/**
 *
 */
export function useTicketDetail() {
  const cur = useSyncExternalStore(subscribeTicket, getTicketId, getTicketId);
  const neighbors = useSyncExternalStore(
    subscribeTicket,
    () => getTicketNeighbors(),
    () => getTicketNeighbors(),
  );
  const navPrev = useCallback(() => navigatePrev(), []);
  const navNext = useCallback(() => navigateNext(), []);
  return { id: cur, close: () => closeTicketDetail(), ...neighbors, navigatePrev: navPrev, navigateNext: navNext };
}

/**
 *
 */
export function useDeviceDetail() {
  const cur = useSyncExternalStore(subscribeDevice, getDeviceId, getDeviceId);
  return { id: cur, close: () => closeDeviceDetail() };
}
