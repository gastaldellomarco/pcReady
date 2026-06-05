import { createServerFn } from "@tanstack/react-start";
import type { PortalSessionContext } from "@/lib/portal-auth.server";
import { PortalTokenSchema } from "@/lib/portal-shared";
import { z } from "zod";

export type { PortalSessionContext };

const RequestPortalLoginSchema = z.object({
  email: z.string().email(),
  sendMail: z.boolean().optional(),
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

const PortalLanguageSchema = z.object({
  token: z.string().min(32),
  language: z.enum(["it", "en"]),
});

const PortalAccessHistorySchema = z.object({
  token: z.string().min(32),
});

const Portal2FASetupSchema = z.object({
  token: z.string().min(32),
  enable: z.boolean(),
});

const Portal2FAVerifySchema = z.object({
  token: z.string().min(32),
  code: z.string().length(6),
});

const PortalNotificationPrefsSchema = z.object({
  token: z.string().min(32),
  preferences: z.record(z.boolean()),
});

const Portal2FALoginSchema = z.object({
  pendingToken: z.string().min(32),
  code: z.string().length(6),
});

export const requestPortalLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RequestPortalLoginSchema.parse(data))
  .handler(async ({ data }) => {
    const { requestPortalLoginServer } = await import("@/lib/portal-auth.server");
    return requestPortalLoginServer(data);
  });

export const loginPortalWithPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalPasswordLoginSchema.parse(data))
  .handler(async ({ data }) => {
    const { loginPortalWithPasswordServer } = await import("@/lib/portal-auth.server");
    return loginPortalWithPasswordServer(data);
  });

export const validatePortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { validatePortalSessionServer } = await import("@/lib/portal-auth.server");
    return validatePortalSessionServer(data);
  });

export const updatePortalContactProfile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalProfileUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const { updatePortalContactProfileServer } = await import("@/lib/portal-auth-profile.server");
    return updatePortalContactProfileServer(data);
  });

export const updatePortalContactLanguage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalLanguageSchema.parse(data))
  .handler(async ({ data }) => {
    const { updatePortalContactLanguageServer } = await import("@/lib/portal-auth-profile.server");
    return updatePortalContactLanguageServer(data);
  });

export const getPortalAccessHistory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalAccessHistorySchema.parse(data))
  .handler(async ({ data }) => {
    const { getPortalAccessHistoryServer } = await import("@/lib/portal-auth-profile.server");
    return getPortalAccessHistoryServer(data);
  });

export const updatePortalNotificationPreferences = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalNotificationPrefsSchema.parse(data))
  .handler(async ({ data }) => {
    const { updatePortalNotificationPreferencesServer } =
      await import("@/lib/portal-auth-profile.server");
    return updatePortalNotificationPreferencesServer(data);
  });

export const setupPortal2FA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Portal2FASetupSchema.parse(data))
  .handler(async ({ data }) => {
    const { setupPortal2FAServer } = await import("@/lib/portal-auth-2fa.server");
    return setupPortal2FAServer(data);
  });

export const verifyPortal2FA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Portal2FAVerifySchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyPortal2FAServer } = await import("@/lib/portal-auth-2fa.server");
    return verifyPortal2FAServer(data);
  });

export const generatePortalAccessLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalContactLinkSchema.parse(data))
  .handler(async ({ data }) => {
    const { generatePortalAccessLinkServer } = await import("@/lib/portal-auth-links.server");
    return generatePortalAccessLinkServer(data);
  });

export const revokePortalAccessLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RevokePortalContactLinkSchema.parse(data))
  .handler(async ({ data }) => {
    const { revokePortalAccessLinkServer } = await import("@/lib/portal-auth-links.server");
    return revokePortalAccessLinkServer(data);
  });

export const getPortalClientContacts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { getPortalClientContactsServer } = await import("@/lib/portal-auth.server");
    return getPortalClientContactsServer(data);
  });

export const verifyPortalLogin2FA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Portal2FALoginSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyPortalLogin2FAServer } = await import("@/lib/portal-auth.server");
    return verifyPortalLogin2FAServer(data);
  });

export const logoutPortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PortalTokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { logoutPortalSessionServer } = await import("@/lib/portal-auth.server");
    return logoutPortalSessionServer(data);
  });
