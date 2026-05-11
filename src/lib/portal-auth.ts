import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { PortalSessionContext } from "@/lib/portal-auth.server";

const RequestPortalLoginSchema = z.object({
  email: z.string().email(),
});

const PortalTokenSchema = z.object({
  token: z.string().min(32),
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