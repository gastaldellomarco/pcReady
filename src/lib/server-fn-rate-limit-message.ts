const RATE = "rate_limit_exceeded";

export type ParsedRateLimitBody = { error: typeof RATE; retryAfter: number };

function tryParseJsonObject(text: string): ParsedRateLimitBody | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const v = JSON.parse(trimmed) as { error?: string; retryAfter?: number };
    if (v?.error === RATE && typeof v.retryAfter === "number" && Number.isFinite(v.retryAfter)) {
      return { error: RATE, retryAfter: Math.max(1, Math.floor(v.retryAfter)) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Extract structured rate-limit info from a server function / fetch rejection. */
export function parseRateLimitFromServerFnError(error: unknown): ParsedRateLimitBody | null {
  if (!error || typeof error !== "object") return null;
  const anyErr = error as Record<string, unknown>;

  if (typeof anyErr.message === "string") {
    const fromMessage = tryParseJsonObject(anyErr.message);
    if (fromMessage) return fromMessage;
  }

  if (anyErr.status === 429) {
    const body = anyErr.data ?? anyErr.body;
    if (typeof body === "string") {
      const parsed = tryParseJsonObject(body);
      if (parsed) return parsed;
    }
    if (body && typeof body === "object") {
      const b = body as { error?: string; retryAfter?: number };
      if (b.error === RATE && typeof b.retryAfter === "number") {
        return { error: RATE, retryAfter: Math.max(1, Math.floor(b.retryAfter)) };
      }
    }
  }

  return null;
}

export function rateLimitToastMessage(parsed: ParsedRateLimitBody): string {
  return `Troppe richieste, riprova tra ${parsed.retryAfter} secondi`;
}

export function formatServerFnErrorForToast(error: unknown, fallback: string): string {
  const rl = parseRateLimitFromServerFnError(error);
  if (rl) return rateLimitToastMessage(rl);
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  const anyErr = error as Record<string, unknown>;
  if (typeof anyErr === "string") return anyErr;
  if (typeof anyErr?.message === "string") return String(anyErr.message);
  if (anyErr?.status) return `${anyErr.status} ${anyErr?.statusText ?? ""}`.trim() || fallback;
  try {
    return String(anyErr);
  } catch {
    return fallback;
  }
}
