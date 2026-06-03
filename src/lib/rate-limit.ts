import { RATE_LIMIT_PRESETS } from "@/lib/rate-limit-config";
import type { RateLimiterKey } from "@/lib/rate-limit-config";

/**
 *
 */
export type CheckRateLimitOptions = { limit: number; windowMs: number };

/**
 *
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
  resetAt: number;
};

const MAX_BUCKETS = 50_000;
const buckets = new Map<string, number[]>();

function pruneTimestamps(timestamps: number[], windowMs: number, now: number) {
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0]! <= cutoff) {
    timestamps.shift();
  }
}

/**
 * In-memory sliding-window limiter (single Node process).
 *
 * Multi-instance: set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (see `.env.example`),
 * add `@upstash/ratelimit` and `@upstash/redis`, then delegate selected `limiterKey`s to Upstash.
 */
export function checkRateLimit(
  identifier: string,
  limiterKey: string,
  options: CheckRateLimitOptions,
): RateLimitResult {
  const compositeKey = `${limiterKey}:${identifier}`;
  const now = Date.now();
  let timestamps = buckets.get(compositeKey);
  if (!timestamps) {
    if (buckets.size >= MAX_BUCKETS) {
      const first = buckets.keys().next().value;
      if (first) buckets.delete(first);
    }
    timestamps = [];
    buckets.set(compositeKey, timestamps);
  }

  pruneTimestamps(timestamps, options.windowMs, now);

  const limit = options.limit;
  if (timestamps.length >= limit) {
    const oldest = timestamps[0]!;
    const resetAt = oldest + options.windowMs;
    const retryAfterMs = Math.max(0, resetAt - now);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit,
      resetAt,
    };
  }

  timestamps.push(now);
  const resetAt = (timestamps[0] ?? now) + options.windowMs;
  return {
    allowed: true,
    remaining: Math.max(0, limit - timestamps.length),
    retryAfterSeconds: 0,
    limit,
    resetAt,
  };
}

/**
 *
 */
export function buildRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = String(result.retryAfterSeconds);
  const body = JSON.stringify({
    error: "rate_limit_exceeded",
    retryAfter: result.retryAfterSeconds,
  });
  return new Response(body, {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": retryAfter,
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    },
  });
}

/**
 *
 */
export function throwIfRateLimited(
  identifier: string,
  presetKey: RateLimiterKey,
  options?: CheckRateLimitOptions,
): RateLimitResult {
  const opts = options ?? RATE_LIMIT_PRESETS[presetKey];
  const outcome = checkRateLimit(identifier, presetKey, opts);
  if (!outcome.allowed) {
    throw buildRateLimitResponse(outcome);
  }
  return outcome;
}
