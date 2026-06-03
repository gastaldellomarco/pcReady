import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PortalSessionContext } from "@/lib/portal-auth.server";

const RequestPortalLoginSchema = z.object({
  email: z.string().email(),
  sendMail: z.boolean().optional(),
});

const PortalTokenSchema = z.object({
  token: z.string().min(32),
});

const PortalPasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const PortalProfileUpdateSchema = z.object({
  token: z.string().min(32),
  fullName: z.string().min(1).max(160),
  phone: z.string().max(80).nullable().optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  password: z.string().max(200).nullable().optional(),
});

const PortalContactLinkSchema = z.object({
  accessToken: z.string().min(1),
  contactId: z.string().uuid(),
  ttlHours: z.number().int().min(1).max(168).optional(),
});

const RevokePortalContactLinkSchema = z.object({
  accessToken: z.string().min(1),
  contactId: z.string().uuid(),
});

export type { PortalSessionContext };

export const requestPortalLogin = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof RequestPortalLoginSchema>) => data)
  .handler(async ({ data }) => {
    const { requestPortalLoginServer } = await import("@/lib/portal-auth.server");
    return requestPortalLoginServer(RequestPortalLoginSchema.parse(data));
  });

export const loginPortalWithPassword = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalPasswordLoginSchema>) => data)
  .handler(async ({ data }) => {
    const { loginPortalWithPasswordServer } = await import("@/lib/portal-auth.server");
    return loginPortalWithPasswordServer(PortalPasswordLoginSchema.parse(data));
  });

export const validatePortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { getPortalSession } = await import("@/lib/portal-auth.server");
    return getPortalSession(PortalTokenSchema.parse(data).token);
  });

export const updatePortalContactProfile = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalProfileUpdateSchema>) => data)
  .handler(async ({ data }) => {
    const { updatePortalContactProfileServer } = await import("@/lib/portal-auth.server");
    return updatePortalContactProfileServer(PortalProfileUpdateSchema.parse(data));
  });

export const updatePortalContactLanguage = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; language: string }) => data)
  .handler(async ({ data }) => {
    const { updatePortalContactLanguageServer } = await import("@/lib/portal-auth.server");
    return updatePortalContactLanguageServer(
      z.object({ token: z.string().min(32), language: z.enum(["it", "en"]) }).parse(data),
    );
  });

export const getPortalAccessHistory = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { getPortalAccessHistoryServer } = await import("@/lib/portal-auth.server");
    return getPortalAccessHistoryServer(z.object({ token: z.string().min(32) }).parse(data));
  });

export const setupPortal2FA = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; enable: boolean }) => data)
  .handler(async ({ data }) => {
    const { setupPortal2FAServer } = await import("@/lib/portal-auth.server");
    return setupPortal2FAServer(
      z.object({ token: z.string().min(32), enable: z.boolean() }).parse(data),
    );
  });

export const verifyPortal2FA = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; code: string }) => data)
  .handler(async ({ data }) => {
    const { verifyPortal2FAServer } = await import("@/lib/portal-auth.server");
    return verifyPortal2FAServer(
      z.object({ token: z.string().min(32), code: z.string().length(6) }).parse(data),
    );
  });

export const updatePortalNotificationPreferences = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; preferences: Record<string, boolean> }) => data)
  .handler(async ({ data }) => {
    const { updatePortalNotificationPreferencesServer } = await import("@/lib/portal-auth.server");
    return updatePortalNotificationPreferencesServer(
      z.object({ token: z.string().min(32), preferences: z.record(z.boolean()) }).parse(data),
    );
  });

export const getPortalClientContacts = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { getPortalClientContactsServer } = await import("@/lib/portal-auth.server");
    return getPortalClientContactsServer(z.object({ token: z.string().min(32) }).parse(data));
  });

export const verifyPortalLogin2FA = createServerFn({ method: "POST" })
  .inputValidator((data: { pendingToken: string; code: string }) => data)
  .handler(async ({ data }) => {
    const { verifyPortalLogin2FAServer } = await import("@/lib/portal-auth.server");
    return verifyPortalLogin2FAServer(
      z.object({ pendingToken: z.string().min(32), code: z.string().length(6) }).parse(data),
    );
  });

export const logoutPortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { logoutPortalSessionServer } = await import("@/lib/portal-auth.server");
    return logoutPortalSessionServer(PortalTokenSchema.parse(data));
  });

export const generatePortalAccessLink = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalContactLinkSchema>) => data)
  .handler(async ({ data }) => {
    const { generatePortalAccessLinkServer } = await import("@/lib/portal-auth.server");
    return generatePortalAccessLinkServer(PortalContactLinkSchema.parse(data));
  });

export const revokePortalAccessLink = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof RevokePortalContactLinkSchema>) => data)
  .handler(async ({ data }) => {
    const { revokePortalAccessLinkServer } = await import("@/lib/portal-auth.server");
    return revokePortalAccessLinkServer(RevokePortalContactLinkSchema.parse(data));
  });
