import { z } from "zod";
import { optionalTrimmed } from "./utils";
import {
  DEFAULT_DEVICE_CATEGORY,
  DEFAULT_DEVICE_TYPE,
  DEVICE_CATEGORIES,
  DEVICE_TYPES_BY_CATEGORY,
  type DeviceCategory,
} from "@/lib/device-taxonomy";

export const DeviceSchema = z
  .object({
    category: z.enum(DEVICE_CATEGORIES).default(DEFAULT_DEVICE_CATEGORY),
    device_type: z
      .string()
      .trim()
      .min(1, "Tipo dispositivo obbligatorio")
      .default(DEFAULT_DEVICE_TYPE),
    asset_tag: optionalTrimmed(),
    brand: optionalTrimmed(),
    model: z.string().min(1, "Modello obbligatorio"),
    serial: optionalTrimmed(),
    client_id: z.string().uuid("Client ID non valido"),
    end_user: optionalTrimmed(),
    os: optionalTrimmed(),
    cpu_name: optionalTrimmed(),
    ram_gb: z.preprocess(
      (value) => (value === "" ? null : value),
      z.coerce.number({ invalid_type_error: "RAM non valida" }).nonnegative().nullable().optional(),
    ),
    storage_capacity_gb: z.preprocess(
      (value) => (value === "" ? null : value),
      z.coerce
        .number({ invalid_type_error: "Storage non valido" })
        .nonnegative()
        .nullable()
        .optional(),
    ),
    storage_type: optionalTrimmed(),
    ip_address: optionalTrimmed(),
    mac_address: optionalTrimmed(),
    location: optionalTrimmed(),
    firmware_version: optionalTrimmed(),
    port_count: z.preprocess(
      (value) => (value === "" ? null : value),
      z.coerce
        .number({ invalid_type_error: "Numero porte non valido" })
        .int()
        .nonnegative()
        .nullable()
        .optional(),
    ),
    poe_supported: z.coerce.boolean().optional(),
    toner_model: optionalTrimmed(),
    page_count: z.preprocess(
      (value) => (value === "" ? null : value),
      z.coerce
        .number({ invalid_type_error: "Contatore pagine non valido" })
        .int()
        .nonnegative()
        .nullable()
        .optional(),
    ),
    print_technology: optionalTrimmed(),
    license_expiry: optionalTrimmed(),
    vlan_config: optionalTrimmed(),
    rack_position: optionalTrimmed(),
    server_role: optionalTrimmed(),
    purchase_cost: z.preprocess(
      (value) => (value === "" ? null : value),
      z.coerce
        .number({ invalid_type_error: "Costo non valido" })
        .nonnegative("Il costo non può essere negativo")
        .nullable()
        .optional(),
    ),
    notes: optionalTrimmed(),
  })
  .superRefine((value, ctx) => {
    const allowedTypes = DEVICE_TYPES_BY_CATEGORY[value.category as DeviceCategory] ?? [];
    if (!allowedTypes.includes(value.device_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["device_type"],
        message: "Tipo non coerente con la categoria selezionata",
      });
    }
  });

export type DeviceFormInput = z.input<typeof DeviceSchema>;
export type DeviceInput = z.infer<typeof DeviceSchema>;
