import { z } from "zod";
import { OAUTH_SCOPES } from "@/lib/oauth-scopes";

export const OAuthClientSchema = z.object({
  name: z.string().min(1, "Nome applicazione obbligatorio"),
  description: z.string().trim().optional().nullable(),
  // raw textarea that will be transformed into array of urls
  redirectUrisRaw: z
    .string()
    .transform((s) => s.split("\n").map((r) => r.trim()).filter(Boolean))
    .refine((arr) => arr.length > 0, { message: "Inserisci almeno una redirect URI" }),
  scopesAllowed: z.array(z.enum(Object.keys(OAUTH_SCOPES) as [string, ...string[]])).optional(),
});

export type OAuthClientInput = z.infer<typeof OAuthClientSchema>;
