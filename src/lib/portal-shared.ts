import { z } from "zod";

export const PortalTokenSchema = z.object({ token: z.string().min(32) });
