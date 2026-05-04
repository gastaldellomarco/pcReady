import { z } from "zod";
import { optionalTrimmed } from "./utils";

export const AppSettingsSchema = z.object({
  organization_name: z.string().min(1, "Inserisci il nome dell'organizzazione"),
  default_timezone: z.string().min(1, "Inserisci il timezone predefinito"),
  max_devices_per_technician: z
    .union([z.number().int().min(1), z.string().regex(/^[0-9]+$/)])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
    .refine((v) => typeof v === "number" && v >= 1, {
      message: "Deve essere un numero intero maggiore o uguale a 1",
    }),
  self_registration_enabled: z.boolean(),
  admin_approval_required: z.boolean(),
  support_email: optionalTrimmed(),
});

export type AppSettingsInput = z.infer<typeof AppSettingsSchema>;
