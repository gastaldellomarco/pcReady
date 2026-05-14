import {
  parseRateLimitFromServerFnError,
  rateLimitToastMessage,
} from "@/lib/server-fn-rate-limit-message";

export function getAdminErrorMessage(error: unknown, fallback: string): string {
  try {
    const rl = parseRateLimitFromServerFnError(error);
    if (rl) return rateLimitToastMessage(rl);
    if (!error) return fallback;
    if (error instanceof Error) return error.message;
    const anyErr = error as Record<string, unknown>;
    if (typeof anyErr === "string") return anyErr;
    if (anyErr?.message) return String(anyErr.message);
    if (anyErr?.status) return `${anyErr.status} ${anyErr?.statusText ?? ""}`.trim();
    return String(anyErr);
  } catch {
    return fallback;
  }
}
