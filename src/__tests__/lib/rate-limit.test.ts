import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";

describe("checkRateLimit", () => {
  it("allows within limit then blocks until window slides", () => {
    const id = `test-${Math.random()}`;
    const key = RATE_LIMITER_KEYS.CREATE_STAFF_TICKET;
    const opts = { limit: 2, windowMs: 60_000 };

    const a = checkRateLimit(id, key, opts);
    const b = checkRateLimit(id, key, opts);
    const c = checkRateLimit(id, key, opts);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(false);
    expect(c.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
