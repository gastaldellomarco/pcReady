// ─── Pure types & computation for audit log ──────────────────────────
// Separated from the Supabase-bound server functions in audit-log.ts

/** Row shape expected by auditRowsToCsv. */
export interface AuditCsvRow {
  created_at: string;
  actor_name: string | null;
  type: string;
  message: string;
  action_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  ticket_id: string | null;
  severity: string | null;
}

/**
 * Pure computation: deduplicates audit log rows by (message + created_at second).
 * Two rows with the same message and the same ISO second are treated as duplicates;
 * only the first occurrence is kept.
 * Used by both getAuditLog (pagination) and exportAuditLog (CSV export).
 */
export function deduplicateAuditRows<T extends { message: string; created_at: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const row of rows) {
    const key = `${row.message}|${String(row.created_at).slice(0, 19)}`; // same second
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

/**
 * Pure computation: converts deduplicated audit log rows into a CSV string
 * with Italian-formatted dates and properly escaped fields.
 */
export function auditRowsToCsv(rows: AuditCsvRow[]): string {
  const csvHeader =
    "Data,Ora,Utente,Tipo,Azione,Dettaglio,Entita,ID Entita,Ticket,Esito\n";

  const csvRows = rows
    .map((row) => {
      const date = new Date(row.created_at);
      const dateStr = date.toLocaleDateString("it-IT");
      const timeStr = date.toLocaleTimeString("it-IT");
      const actor = row.actor_name || "Sistema";
      const type =
        row.type === "sys" ? "Sistema" : row.type === "auto" ? "Automatico" : "Utente";
      const message = `"${(row.message || "").replace(/"/g, '""')}"`;
      const actionType = row.action_type || "";
      const entityType = row.entity_type || "";
      const entityId = row.entity_id || "";
      const ticket = row.ticket_id || "";
      const severity = row.severity || "info";

      return `${dateStr},${timeStr},${actor},${type},${actionType},${message},${entityType},${entityId},${ticket},${severity}`;
    })
    .join("\n");

  return csvHeader + csvRows;
}
