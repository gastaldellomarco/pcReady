import { useSyncExternalStore } from "react";
let id: string | null = null;
const ls = new Set<() => void>();
function set(v: string | null) { id = v; ls.forEach(l => l()); }
export function openTicketDetail(tid: string) { set(tid); }
export function useTicketDetail() {
  const cur = useSyncExternalStore((cb) => { ls.add(cb); return () => { ls.delete(cb); }; }, () => id, () => id);
  return { id: cur, close: () => set(null) };
}
