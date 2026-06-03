import { useSyncExternalStore } from "react";

/**
 *
 */
export interface AddDeviceClientContext {
  id: string;
  name: string;
  lockClient?: boolean;
}

/**
 *
 */
export interface OpenAddDeviceOptions {
  initialSerial?: string;
  client?: AddDeviceClientContext;
}

interface State {
  search: string;
  pendingCount: number;
  createOpen: boolean;
  addDeviceOpen: boolean;
  addDeviceInitialSerial: string;
  addDeviceClient: AddDeviceClientContext | null;
}
interface API extends State {
  setSearch: (s: string) => void;
  setPendingCount: (n: number) => void;
  openCreate: () => void;
  closeCreate: () => void;
  openAddDevice: (options?: string | OpenAddDeviceOptions) => void;
  closeAddDevice: () => void;
}

let s: State = {
  search: "",
  pendingCount: 0,
  createOpen: false,
  addDeviceOpen: false,
  addDeviceInitialSerial: "",
  addDeviceClient: null,
};
const listeners = new Set<() => void>();

const actions = {
  setSearch: (v: string) => set({ search: v }),
  setPendingCount: (n: number) => set({ pendingCount: n }),
  openCreate: () => set({ createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
  openAddDevice: (options: string | OpenAddDeviceOptions = "") => {
    const next =
      typeof options === "string"
        ? { initialSerial: options, client: null }
        : { initialSerial: options.initialSerial ?? "", client: options.client ?? null };
    set({
      addDeviceOpen: true,
      addDeviceInitialSerial: next.initialSerial,
      addDeviceClient: next.client,
    });
  },
  closeAddDevice: () =>
    set({ addDeviceOpen: false, addDeviceInitialSerial: "", addDeviceClient: null }),
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

/**
 *
 */
export function useTickets(): API {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, ...actions };
}
