// ─── Costanti ticket condivise (pure, senza dipendenze server) ─────
// Importabile sia da moduli client (data/clients.ts, StatusTimeline.tsx)
// che da moduli server (automation-actions.server.ts).

/** Stati attivi del workflow ticket (pre-completamento). */
export const TICKET_STATUSES = ["pending", "in-progress", "testing", "ready"] as const;

/** Restituisce una copia mutabile degli stati attivi del workflow. */
export function getWorkflowStatuses() {
  return [...TICKET_STATUSES];
}
