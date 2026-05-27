// Module-level state for ticket detail navigation
let ticketId: string | null = null;
const ticketListeners = new Set<() => void>();

function setTicket(v: string | null) {
  ticketId = v;
  ticketListeners.forEach((l) => l());
}

/** Apre la modale di dettaglio ticket impostando l'ID */
export function openTicketDetail(tid: string) {
  setTicket(tid);
}

/** Chiude la modale di dettaglio ticket */
export function closeTicketDetail() {
  setTicket(null);
}

/** Getter per useSyncExternalStore (usato da useTicketDetail) */
export function getTicketId(): string | null {
  return ticketId;
}

/** Subscribe per useSyncExternalStore (usato da useTicketDetail) */
export function subscribeTicket(listener: () => void) {
  ticketListeners.add(listener);
  return () => {
    ticketListeners.delete(listener);
  };
}

// Module-level state for device detail navigation
let deviceId: string | null = null;
const deviceListeners = new Set<() => void>();

function setDevice(v: string | null) {
  deviceId = v;
  deviceListeners.forEach((l) => l());
}

/** Apre la modale di dettaglio device impostando l'ID */
export function openDeviceDetail(did: string) {
  setDevice(did);
}

/** Chiude la modale di dettaglio device */
export function closeDeviceDetail() {
  setDevice(null);
}

/** Getter per useSyncExternalStore (usato da useDeviceDetail) */
export function getDeviceId(): string | null {
  return deviceId;
}

/** Subscribe per useSyncExternalStore (usato da useDeviceDetail) */
export function subscribeDevice(listener: () => void) {
  deviceListeners.add(listener);
  return () => {
    deviceListeners.delete(listener);
  };
}
