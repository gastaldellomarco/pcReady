import { useSyncExternalStore } from "react";
let id: string | null = null;
const ls = new Set<() => void>();
function set(v: string | null) { id = v; ls.forEach(l => l()); }
export function openTicketDetail(tid: string) { set(tid); }
export function useTicketDetail() {
  const cur = useSyncExternalStore((cb) => { ls.add(cb); return () => { ls.delete(cb); }; }, () => id, () => id);
  return { id: cur, close: () => set(null) };
}

let deviceId: string | null = null;
const dls = new Set<() => void>();
function setDevice(v: string | null) { deviceId = v; dls.forEach(l => l()); }
export function openDeviceDetail(did: string) { setDevice(did); }
export function useDeviceDetail() {
  const cur = useSyncExternalStore((cb) => { dls.add(cb); return () => { dls.delete(cb); }; }, () => deviceId, () => deviceId);
  return { id: cur, close: () => setDevice(null) };
}
