import { createServerFn } from "@tanstack/react-start";

export type MfaBackupCodeStatus = {
  remaining: number;
  total: number;
  last_used_at: string | null;
};

export type MfaAccessStatus = {
  required: boolean;
  graceExpired: boolean;
  graceEndsAt: string | null;
  requireAllUsers: boolean;
  requireAdmins: boolean;
  graceDays: number;
};

export const getMyMfaAccessStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const { getMyMfaAccessStatusHandler } = await import("./mfa.server");
    return getMyMfaAccessStatusHandler(data);
  });

export const getBackupCodeStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const { getBackupCodeStatusHandler } = await import("./mfa.server");
    return getBackupCodeStatusHandler(data);
  });

export const regenerateBackupCodes = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const { regenerateBackupCodesHandler } = await import("./mfa.server");
    return regenerateBackupCodesHandler(data);
  });

export const verifyBackupCode = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; code: string; ipAddress?: string | null }) => data)
  .handler(async ({ data }) => {
    const { verifyBackupCodeHandler } = await import("./mfa.server");
    return verifyBackupCodeHandler(data);
  });

export const logMfaAuditEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      accessToken: string;
      actionType: string;
      message: string;
      severity?: "info" | "warning" | "critical";
      ipAddress?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { logMfaAuditEventHandler } = await import("./mfa.server");
    return logMfaAuditEventHandler(data);
  });
