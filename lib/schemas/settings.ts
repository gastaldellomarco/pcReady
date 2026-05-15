import { z } from "zod";
import { optionalTrimmed } from "./utils";

const WipLimitSchema = z
  .union([z.number().int().min(0), z.string().regex(/^[0-9]+$/)])
  .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val));

const SlaLimitSchema = z
  .union([z.number().int().min(1), z.string().regex(/^[0-9]+$/)])
  .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val));

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
  log_retention_days: z
    .union([z.number().int().min(30), z.string().regex(/^[0-9]+$/)])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  wip_limits: z.object({
    pending: WipLimitSchema,
    "in-progress": WipLimitSchema,
    testing: WipLimitSchema,
    ready: WipLimitSchema,
    completed: WipLimitSchema,
    archived: WipLimitSchema,
  }).default({ pending: 20, "in-progress": 5, testing: 5, ready: 20, completed: 0, archived: 0 }),
  sla_limits: z.object({
    high: SlaLimitSchema,
    med: SlaLimitSchema,
    low: SlaLimitSchema,
  }).default({ high: 4, med: 24, low: 72 }),
  archive_after_days: z
    .union([z.number().int().min(0), z.string().regex(/^[0-9]+$/)])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  os_options: z.array(z.string()).default([]),
  device_brands: z.array(z.string()).default([]),
  ticket_categories: z.array(z.string()).default([]),
});

export type AppSettingsInput = z.infer<typeof AppSettingsSchema>;
