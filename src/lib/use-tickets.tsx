import { useSyncExternalStore } from "react";

interface State {
  search: string;
  pendingCount: number;
  createOpen: boolean;
  refreshKey: number;
}
interface API extends State {
  setSearch: (s: string) => void;
  setPendingCount: (n: number) => void;
  openCreate: () => void;
  closeCreate: () => void;
  triggerRefresh: () => void;
}

let s: State = { search: "", pendingCount: 0, createOpen: false, refreshKey: 0 };
const listeners = new Set<() => void>();

const actions = {
  setSearch: (v: string) => set({ search: v }),
  setPendingCount: (n: number) => set({ pendingCount: n }),
  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
  triggerRefresh: () => set({ refreshKey: s.refreshKey + 1 }),
};

function set(p: Partial<State>) { s = { ...s, ...p }; listeners.forEach(l => l()); }

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnapshot = () => s;

export function useTickets(): API {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, ...actions };
}
