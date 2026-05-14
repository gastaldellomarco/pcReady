import { useSyncExternalStore } from "react";

interface State {
  search: string;
  pendingCount: number;
  createOpen: boolean;
  addDeviceOpen: boolean;
  addDeviceInitialSerial: string;
}
interface API extends State {
  setSearch: (s: string) => void;
  setPendingCount: (n: number) => void;
  openCreate: () => void;
  closeCreate: () => void;
  openAddDevice: (initialSerial?: string) => void;
  closeAddDevice: () => void;
}

let s: State = {
  search: "",
  pendingCount: 0,
  createOpen: false,
  addDeviceOpen: false,
  addDeviceInitialSerial: "",
};
const listeners = new Set<() => void>();

const actions = {
  setSearch: (v: string) => set({ search: v }),
  setPendingCount: (n: number) => set({ pendingCount: n }),
  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
  openAddDevice: (initialSerial = "") =>
    set({ addDeviceOpen: true, addDeviceInitialSerial: initialSerial }),
  closeAddDevice: () => set({ addDeviceOpen: false, addDeviceInitialSerial: "" }),
  // legacy refresh removed; rely on React Query invalidation
};

function set(p: Partial<State>) {
  s = { ...s, ...p };
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => s;

export function useTickets(): API {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, ...actions };
}
