import { z } from "zod";
import { optionalTrimmed } from "./utils";
import { OS_OPTIONS } from "@/lib/pcready";

export const DeviceSchema = z.object({
  model: z.string().min(1, "Modello obbligatorio"),
  serial: z.string().min(1, "Seriale obbligatorio"),
  client_id: z.string().uuid("Client ID non valido"),
  end_user: optionalTrimmed(),
  os: z.enum(OS_OPTIONS as [string, ...string[]]),
  notes: optionalTrimmed(),
});

export type DeviceInput = z.infer<typeof DeviceSchema>;
