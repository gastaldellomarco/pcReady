import { z } from "zod";
import { optionalTrimmed } from "./utils";

export const DeviceSchema = z.object({
  model: z.string().min(1, "Modello obbligatorio"),
  serial: z.string().min(1, "Seriale obbligatorio"),
  client_id: z.string().uuid("Client ID non valido"),
  end_user: optionalTrimmed(),
  os: z.string().trim().min(1, "Sistema operativo obbligatorio"),
  notes: optionalTrimmed(),
});

export type DeviceInput = z.infer<typeof DeviceSchema>;
