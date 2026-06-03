import { z } from "zod";
import { optionalTrimmed } from "./utils";

export const ClientSchema = z.object({
  company_name: z.string().min(1, "La ragione sociale è obbligatoria"),
  vat_number: optionalTrimmed(),
  fiscal_code: optionalTrimmed(),
  email: z.string().email("Email non valida").nullable().optional(),
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
  email: z.string().email("Email non valida").nullable().optional(),
  phone: optionalTrimmed(),
  job_title: optionalTrimmed(),
  department: optionalTrimmed(),
  is_primary: z.boolean().optional(),
  notes: optionalTrimmed(),
});

/**
 *
 */
export type ContactInput = z.infer<typeof ContactSchema>;
