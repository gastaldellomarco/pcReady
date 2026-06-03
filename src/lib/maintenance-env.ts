/** Vite espone le variabili VITE_* come stringhe; accetta anche valori truthy non strettamente `"true"`. */
export function isTruthyEnv(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

/**
 * Legge variabili d'ambiente esposte da Vite con fallback a `process.env` in SSR / runtime Node,
 * come in `integrations/supabase/client.ts`. Supporta anche `MAINTENANCE_*` senza prefisso VITE_
 * per container o worker dove non si ricompila il bundle.
 */
function readEnvRaw(...keys: string[]): unknown {
  const meta = import.meta.env as Record<string, unknown>;
  for (const key of keys) {
    const v = meta[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  if (typeof process !== "undefined" && process.env) {
    for (const key of keys) {
      const v = process.env[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }
  return undefined;
}

/**
 *
 */
export function isMaintenanceModeEnabled(): boolean {
  return isTruthyEnv(readEnvRaw("VITE_MAINTENANCE_MODE", "MAINTENANCE_MODE"));
}

/** ISO 8601 o testo libero mostrato sulla pagina di manutenzione. */
export function getMaintenanceEndEnv(): string | undefined {
  const v = readEnvRaw("VITE_MAINTENANCE_END", "MAINTENANCE_END");
  return v === undefined ? undefined : String(v);
}
