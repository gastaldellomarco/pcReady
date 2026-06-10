/**
 * Centralized rate limit definitions (limit + sliding window).
 * Used by `checkRateLimit` / `throwIfRateLimited` via `limiterKey` string.
 */
export const RATE_LIMITER_KEYS = {
  STAFF_PASSWORD_LOGIN: "auth:staff-password",
  PORTAL_MAGIC_LINK: "auth:portal-magic-link",
  PORTAL_2FA: "auth:portal-2fa",
  CREATE_PORTAL_TICKET: "ticket:create-portal",
  CREATE_STAFF_TICKET: "ticket:create-staff",
  INVITE_ADMIN_USER: "admin:invite-user",
  SELF_REGISTRATION: "auth:self-registration",
  SEND_TEST_EMAIL: "email:send-test",
  CREATE_OAUTH_CLIENT: "oauth:create-client",
  EXPORT_ALL_DATA: "export:all-data",
  CREATE_NOTIFICATION: "notification:create",
} as const;

/**
 *
 */
export type RateLimiterKey = (typeof RATE_LIMITER_KEYS)[keyof typeof RATE_LIMITER_KEYS];

/** Presets aligned with security recommendations (see issue description). */
export const RATE_LIMIT_PRESETS: Record<RateLimiterKey, { limit: number; windowMs: number }> = {
  [RATE_LIMITER_KEYS.STAFF_PASSWORD_LOGIN]: { limit: 5, windowMs: 15 * 60 * 1000 },
  [RATE_LIMITER_KEYS.PORTAL_MAGIC_LINK]: { limit: 5, windowMs: 15 * 60 * 1000 },
  [RATE_LIMITER_KEYS.PORTAL_2FA]: { limit: 10, windowMs: 5 * 60 * 1000 },
  [RATE_LIMITER_KEYS.CREATE_PORTAL_TICKET]: { limit: 20, windowMs: 60 * 1000 },
  [RATE_LIMITER_KEYS.CREATE_STAFF_TICKET]: { limit: 20, windowMs: 60 * 1000 },
  [RATE_LIMITER_KEYS.INVITE_ADMIN_USER]: { limit: 3, windowMs: 10 * 60 * 1000 },
  [RATE_LIMITER_KEYS.SELF_REGISTRATION]: { limit: 3, windowMs: 10 * 60 * 1000 },
  [RATE_LIMITER_KEYS.SEND_TEST_EMAIL]: { limit: 10, windowMs: 60 * 1000 },
  [RATE_LIMITER_KEYS.CREATE_OAUTH_CLIENT]: { limit: 3, windowMs: 10 * 60 * 1000 },
  [RATE_LIMITER_KEYS.EXPORT_ALL_DATA]: { limit: 5, windowMs: 5 * 60 * 1000 },
  [RATE_LIMITER_KEYS.CREATE_NOTIFICATION]: { limit: 10, windowMs: 60 * 1000 },
};
