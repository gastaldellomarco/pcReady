import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public check: returns whether self-registration is currently enabled.
 * Does not require authentication.
 */
export const getSelfRegistrationStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getSelfRegistrationStatusServer } = await import("@/lib/server/self-registration.server");
  return getSelfRegistrationStatusServer();
});

const RegisterSchema = z.object({
  email: z.string().email("Email non valida"),
  fullName: z.string().min(1, "Nome obbligatorio"),
  password: z.string().min(8, "Password minima 8 caratteri"),
});

/**
 * Self-registration: allows new users to sign up when the admin
 * has enabled `self_registration_enabled` in app settings.
 */
export const registerSelf = createServerFn({ method: "POST" })
  .validator(RegisterSchema)
  .handler(async ({ data }) => {
    const { registerSelfServer } = await import("@/lib/server/self-registration.server");
    return registerSelfServer(data);
  });
