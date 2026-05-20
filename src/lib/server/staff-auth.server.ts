import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

async function verifyTurnstile(token: string) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET;
  if (!secret) return true; // no secret configured, skip
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token }),
  });
  const json = await res.json();
  return !!json.success;
}

// Core server-only implementation function. Exported so client-side wrappers
// can dynamically import and call it via a server RPC wrapper without
// importing this .server module into client bundles.
export async function staffLoginServer(data: { email: string; password: string; captchaToken?: string }) {
  const email = data.email.trim().toLowerCase();
  // Apply server-side rate limiting (hard limit)
  throwIfRateLimited(`email:${email}`, RATE_LIMITER_KEYS.STAFF_PASSWORD_LOGIN);

  // Optional CAPTCHA verification
  if (data.captchaToken) {
    const ok = await verifyTurnstile(data.captchaToken);
    if (!ok) throw new Error("Captcha verification failed");
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Server misconfiguration");

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      // Debug: log response body/status to help diagnose auth failures
      console.error(`[staffLoginServer] auth token request failed: status=${resp.status}`, json);
      // record failed attempt (best-effort)
      try {
        await supabaseAdmin.from("auth_failed_attempts" as any).insert({ email, success: false, payload: json });
      } catch (e) {
        // ignore
      }
      throw new Error(json.error_description || json.error || "Invalid credentials");
    }
    // Debug: successful token response (do not log tokens in production)
    console.debug(`[staffLoginServer] auth token success for ${email}`);

    // record success (best-effort)
    try {
      await supabaseAdmin.from("auth_failed_attempts" as any).insert({ email, success: true, payload: {} });
    } catch (e) {}

    // return session object to client to set via supabase.auth.setSession
    return { session: { access_token: json.access_token, refresh_token: json.refresh_token } };
  } catch (err) {
    throw err;
  }
}

// Export a server-only createServerFn for direct server usage (kept for completeness)
export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: any) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    return staffLoginServer(data as any);
  });

export default staffLogin;
