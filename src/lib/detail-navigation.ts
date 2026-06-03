// Module-level state for ticket detail navigation
let ticketId: string | null = null;
let ticketList: string[] = [];
const ticketListeners = new Set<() => void>();

function setTicket(v: string | null) {
  ticketId = v;
  if (!v) ticketList = [];
  recomputeNeighbors();
  ticketListeners.forEach((l) => l());
}

/** Apre la modale di dettaglio ticket impostando l'ID */
export function openTicketDetail(tid: string) {
  setTicket(tid);
}

/** Imposta il ticket corrente E il contesto di navigazione (lista ordinata di ID) */
export function setTicketContext(id: string, ids: string[]) {
  ticketList = [...ids];
  ticketId = id;
  recomputeNeighbors();
  ticketListeners.forEach((l) => l());
}

/** Naviga al ticket precedente nel contesto corrente */
export function navigatePrev() {
  if (!ticketId || !ticketList.length) return;
  const idx = ticketList.indexOf(ticketId);
  if (idx > 0) setTicket(ticketList[idx - 1]);
}

/** Naviga al ticket successivo nel contesto corrente */
export function navigateNext() {
  if (!ticketId || !ticketList.length) return;
  const idx = ticketList.indexOf(ticketId);
  if (idx >= 0 && idx < ticketList.length - 1) setTicket(ticketList[idx + 1]);
}

/** Chiude la modale di dettaglio ticket */
export function closeTicketDetail() {
  setTicket(null);
}

/** Getter per useSyncExternalStore (usato da useTicketDetail) */
export function getTicketId(): string | null {
  return ticketId;
}

/** Restituisce i vicini di navigazione (prev/next/posizione/totale) */
let cachedNeighbors: {
  prevId: string | null;
  nextId: string | null;
  index: number;
  total: number;
} = { prevId: null, nextId: null, index: 0, total: 0 };

function recomputeNeighbors() {
  if (!ticketId || !ticketList.length) {
    cachedNeighbors = { prevId: null, nextId: null, index: 0, total: 0 };
    return;
  }
  const idx = ticketList.indexOf(ticketId);
  cachedNeighbors = {
    prevId: idx > 0 ? ticketList[idx - 1] : null,
    nextId: idx >= 0 && idx < ticketList.length - 1 ? ticketList[idx + 1] : null,
    index: idx >= 0 ? idx + 1 : 0,
    total: ticketList.length,
  };
}

/**
 *
 */
export function getTicketNeighbors() {
  return cachedNeighbors;
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
