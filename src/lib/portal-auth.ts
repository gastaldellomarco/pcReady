import { createPortalFn, PortalTokenSchema } from "@/lib/portal-shared";
import type { PortalSessionContext } from "@/lib/portal-auth.server";
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

const CORE_MODULE = "@/lib/portal-auth.server";
const MODULE_2FA = "@/lib/portal-auth-2fa.server";
const MODULE_PROFILE = "@/lib/portal-auth-profile.server";
const MODULE_LINKS = "@/lib/portal-auth-links.server";

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

export const requestPortalLogin = createPortalFn(RequestPortalLoginSchema, CORE_MODULE, "requestPortalLoginServer");
export const loginPortalWithPassword = createPortalFn(PortalPasswordLoginSchema, CORE_MODULE, "loginPortalWithPasswordServer");

// validatePortalSession is a special case — getPortalSession takes a string, not an object
export const validatePortalSession = createPortalFn(PortalTokenSchema, CORE_MODULE, "validatePortalSessionServer");

export const updatePortalContactProfile = createPortalFn(PortalProfileUpdateSchema, MODULE_PROFILE, "updatePortalContactProfileServer");
export const updatePortalContactLanguage = createPortalFn(PortalLanguageSchema, MODULE_PROFILE, "updatePortalContactLanguageServer");
export const getPortalAccessHistory = createPortalFn(PortalAccessHistorySchema, MODULE_PROFILE, "getPortalAccessHistoryServer");
export const updatePortalNotificationPreferences = createPortalFn(PortalNotificationPrefsSchema, MODULE_PROFILE, "updatePortalNotificationPreferencesServer");

export const setupPortal2FA = createPortalFn(Portal2FASetupSchema, MODULE_2FA, "setupPortal2FAServer");
export const verifyPortal2FA = createPortalFn(Portal2FAVerifySchema, MODULE_2FA, "verifyPortal2FAServer");

export const generatePortalAccessLink = createPortalFn(PortalContactLinkSchema, MODULE_LINKS, "generatePortalAccessLinkServer");
export const revokePortalAccessLink = createPortalFn(RevokePortalContactLinkSchema, MODULE_LINKS, "revokePortalAccessLinkServer");

export const getPortalClientContacts = createPortalFn(PortalTokenSchema, CORE_MODULE, "getPortalClientContactsServer");
export const verifyPortalLogin2FA = createPortalFn(Portal2FALoginSchema, CORE_MODULE, "verifyPortalLogin2FAServer");
export const logoutPortalSession = createPortalFn(PortalTokenSchema, CORE_MODULE, "logoutPortalSessionServer");
