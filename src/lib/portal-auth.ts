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

export const validatePortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { getPortalSession } = await import("@/lib/portal-auth.server");
    return getPortalSession(PortalTokenSchema.parse(data).token);
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
