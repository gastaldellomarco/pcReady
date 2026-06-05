import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const PortalTokenSchema = z.object({ token: z.string().min(32) });

/**
 * Helper to reduce boilerplate in portal client-facing files.
 * Each handler follows the same pattern:
 *   validate input → dynamically import server module → call handler → return result
 *
 * @param schema - Zod schema for input validation
 * @param modulePath - Path to the server module (e.g. "@/lib/portal-auth.server")
 * @param handlerName - Name of the exported async function in the server module
 */
export function createPortalFn(
  schema: z.ZodType,
  modulePath: string,
  handlerName: string,
) {
  return createServerFn({ method: "POST" })
    .handler(async ({ data }: { data: unknown }) => {
      const mod = await import(modulePath);
      const handler = mod[handlerName] as Function;
      return handler(schema.parse(data));
    }) as any;
}
