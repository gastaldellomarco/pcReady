import { z } from "zod";
import { optionalTrimmed } from "./utils";

/**
 * Schema riutilizzabile per i campi opzionali con validatore di formato
 * (UUID/email) il cui input può essere la stringa vuota `""` (es. valore
 * di default di un `<select>` con `<option value="">` o di un `<input>`
 * non compilato). Senza uno step di normalizzazione, Zod rifiuta `""`
 * perché non è né un UUID né un'email valida, nonostante `.nullable()
 * .optional()` (che accettano solo `null` / `undefined`).
 *
 * Implementato come `union([literal(""), formatSchema])` così che
 * l'INPUT type rimane `string | null | undefined` (identico a quello di
 * `ClientInput` / `ContactInput`), evitando di rompere l'inferenza del
 * `Resolver` di react-hook-form. Il `.transform` finale converte `""` →
 * `null` così il payload verso il database è sempre normalizzato.
 */
const optionalFormatField = <T extends z.ZodTypeAny>(formatSchema: T) =>
  z
    .union([z.literal(""), formatSchema])
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

export const ClientSchema = z.object({
  company_name: z.string().min(1, "La ragione sociale è obbligatoria"),
  vat_number: optionalTrimmed(),
  fiscal_code: optionalTrimmed(),
  email: optionalFormatField(z.string().email("Email non valida")),
  phone: optionalTrimmed(),
  website_url: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine((value) => {
      if (!value) return true;
      try {
        new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return true;
      } catch {
        return false;
      }
    }, "URL sito web non valido"),
  address: optionalTrimmed(),
  notes: optionalTrimmed(),
  portal_logo_url: optionalTrimmed(),
  portal_primary_color: optionalTrimmed(),
  portal_welcome_message: optionalTrimmed(),
  portal_name: optionalTrimmed(),
});

/**
 *
 */
export type ClientInput = z.infer<typeof ClientSchema>;

export const ContactSchema = z.object({
  full_name: z.string().min(1, "Nome e cognome obbligatori"),
  email: optionalFormatField(z.string().email("Email non valida")),
  phone: optionalTrimmed(),
  job_title: optionalTrimmed(),
  department: optionalTrimmed(),
  is_primary: z.boolean().optional(),
  notes: optionalTrimmed(),
  private_note: optionalTrimmed(),
  is_starred: z.boolean().optional(),
  availability_status: z.string().nullable().optional(),
  return_date: z.string().nullable().optional(),
  // Il `<select>` "Gruppo" offre `<option value="">` ("Nessun gruppo") come
  // scelta di default. Senza `optionalFormatField` la submit fallirebbe
  // perché "" non è un UUID valido, dando all'utente l'impressione che
  // la categoria sia obbligatoria anche quando il cliente non ha gruppi.
  group_id: optionalFormatField(z.string().uuid()),
});

/**
 *
 */
export type ContactInput = z.infer<typeof ContactSchema>;
