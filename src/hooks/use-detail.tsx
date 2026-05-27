import { useSyncExternalStore } from "react";
import {
  getTicketId,
  subscribeTicket,
  closeTicketDetail,
  getDeviceId,
  subscribeDevice,
  closeDeviceDetail,
} from "@/lib/detail-navigation";

export function useTicketDetail() {
  const cur = useSyncExternalStore(subscribeTicket, getTicketId, getTicketId);
  return { id: cur, close: () => closeTicketDetail() };
}

export function useDeviceDetail() {
  const cur = useSyncExternalStore(subscribeDevice, getDeviceId, getDeviceId);
  return { id: cur, close: () => closeDeviceDetail() };
}
