import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MfaAuthedSchema = z.object({ accessToken: z.string() });
const MfaVerifySchema = z.object({ accessToken: z.string(), code: z.string(), ipAddress: z.string().nullable().optional() });
const MfaAuditSchema = z.object({ accessToken: z.string(), actionType: z.string(), message: z.string(), severity: z.enum(["info", "warning", "critical"]).optional(), ipAddress: z.string().nullable().optional() });

/**
 *
 */
export type MfaBackupCodeStatus = {
  remaining: number;
  total: number;
  last_used_at: string | null;
};

/**
 *
 */
export type MfaAccessStatus = {
  required: boolean;
  graceExpired: boolean;
  graceEndsAt: string | null;
  requireAllUsers: boolean;
  requireAdmins: boolean;
  graceDays: number;
};

export const getMyMfaAccessStatus = createServerFn({ method: "GET" })
  .validator(MfaAuthedSchema)
  .handler(async ({ data }) => {
    const { getMyMfaAccessStatusHandler } = await import("./mfa.server");
    return getMyMfaAccessStatusHandler(data);
  });

export const getBackupCodeStatus = createServerFn({ method: "GET" })
  .validator(MfaAuthedSchema)
  .handler(async ({ data }) => {
    const { getBackupCodeStatusHandler } = await import("./mfa.server");
    return getBackupCodeStatusHandler(data);
  });

export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .validator(MfaAuthedSchema)
  .handler(async ({ data }) => {
    const { regenerateBackupCodesHandler } = await import("./mfa.server");
    return regenerateBackupCodesHandler(data);
  });

export const verifyBackupCode = createServerFn({ method: "POST" })
  .validator(MfaVerifySchema)
  .handler(async ({ data }) => {
    const { verifyBackupCodeHandler } = await import("./mfa.server");
    return verifyBackupCodeHandler(data);
  });

export const logMfaAuditEvent = createServerFn({ method: "POST" })
  .validator(MfaAuditSchema)
  .handler(async ({ data }) => {
    const { logMfaAuditEventHandler } = await import("./mfa.server");
    return logMfaAuditEventHandler(data);
  });
