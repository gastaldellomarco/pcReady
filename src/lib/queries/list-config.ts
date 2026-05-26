/** Shared defaults for paginated Supabase list queries (devices, tickets, clients). */
export const LIST_PAGE_SIZE = 25;

export const LIST_QUERY_STALE_MS = 60_000;
export const LIST_QUERY_GC_MS = 5 * 60_000;

/** Threshold for showing a confirmation warning before exporting all filtered results. */
export const EXPORT_WARNING_THRESHOLD = 500;
