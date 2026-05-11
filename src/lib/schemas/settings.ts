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
  wip_limits: z.object({
    pending: numberInput("Inserisci il limite per In attesa"),
    "in-progress": numberInput("Inserisci il limite per In lavorazione"),
    testing: numberInput("Inserisci il limite per Testing"),
    ready: numberInput("Inserisci il limite per Pronto"),
    completed: numberInput("Inserisci il limite per Completato"),
    archived: numberInput("Inserisci il limite per Archiviato"),
  }),
  archive_after_days: numberInput("Giorni prima di spostare i ticket completati in archivio"),
  os_options: stringListInput(),
  device_brands: stringListInput(),
  ticket_categories: stringListInput(),
});

export type AppSettingsInput = z.infer<typeof AppSettingsSchema>;

function numberInput(message: string) {
  return z
    .union([z.number().int().min(0), z.string().regex(/^[0-9]+$/, message)])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 999, {
      message: "Deve essere un numero intero tra 0 e 999",
    });
}

function stringListInput() {
  return z.array(z.string().trim().min(1)).default([]);
}
