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
  sla_config: z.object({
    high: slaPriorityInput(),
    med: slaPriorityInput(),
    low: slaPriorityInput(),
  }),
  sla_limits: z
    .object({
      high: numberInput("Inserisci SLA alta"),
      med: numberInput("Inserisci SLA media"),
      low: numberInput("Inserisci SLA bassa"),
    })
    .optional(),
  archive_after_days: numberInput("Giorni prima di spostare i ticket completati in archivio"),
  log_retention_days: numberInput("Giorni retention log"),
  os_options: stringListInput(),
  device_brands: stringListInput(),
  ticket_categories: stringListInput(),
  mfa_require_admin_users: z.boolean().default(false),
  mfa_require_all_users: z.boolean().default(false),
  mfa_grace_period_days: numberInput("Giorni di grazia per configurare il 2FA"),
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

function slaPriorityInput() {
  return z.object({
    responseHours: numberInput("Inserisci il tempo di risposta"),
    resolutionHours: numberInput("Inserisci il tempo di risoluzione"),
  });
}
