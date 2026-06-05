"use server";

"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";

const StaffLoginEmailSchema = z.object({
  email: z.string().email(),
});

/**
 * Best-effort rate limit before `signInWithPassword` (client still calls Supabase directly).
 * Honest clients call this first; abuse mitigation also relies on Supabase Auth limits.
 */
export const assertStaffLoginRateLimit = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof StaffLoginEmailSchema>) =>
    StaffLoginEmailSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    throwIfRateLimited(`email:${email}`, RATE_LIMITER_KEYS.STAFF_PASSWORD_LOGIN);
    return { ok: true as const };
  });
