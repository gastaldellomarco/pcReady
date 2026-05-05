import { z } from "zod";
import { OAUTH_SCOPES } from "@/lib/oauth-scopes";

export const OAuthClientSchema = z.object({
  name: z.string().min(1, "Nome applicazione obbligatorio"),
  description: z.string().trim().optional().nullable(),
  // raw textarea (one URL per line) validated as non-empty string here; parsing to array happens in the submit handler
  redirectUrisRaw: z.string().min(1, "Inserisci almeno una redirect URI"),
  scopesAllowed: z.array(z.enum(Object.keys(OAUTH_SCOPES) as [string, ...string[]])).optional(),
});

export type OAuthClientInput = z.infer<typeof OAuthClientSchema>;
