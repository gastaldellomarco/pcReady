/** Shared helper used across portal ticket domain modules. */

export function statusLabel(status: string) {
  if (status === "pending") return "Aperto";
  if (status === "in-progress") return "In lavorazione";
  if (status === "testing") return "In verifica";
  if (status === "ready" || status === "completed" || status === "archived") return "Completato";
  return status;
}
