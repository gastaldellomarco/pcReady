import { z } from "zod";
import { optionalTrimmed } from "./utils";

export const DeviceSchema = z.object({
  brand: optionalTrimmed(),
  model: z.string().min(1, "Modello obbligatorio"),
  serial: z.string().min(1, "Seriale obbligatorio"),
  client_id: z.string().uuid("Client ID non valido"),
  end_user: optionalTrimmed(),
  os: z.string().trim().min(1, "Sistema operativo obbligatorio"),
  purchase_cost: z.preprocess(
    (value) => (value === "" ? null : value),
    z.coerce
      .number({ invalid_type_error: "Costo non valido" })
      .nonnegative("Il costo non può essere negativo")
      .nullable()
      .optional(),
  ),
  notes: optionalTrimmed(),
});

export type DeviceFormInput = z.input<typeof DeviceSchema>;
export type DeviceInput = z.infer<typeof DeviceSchema>;
