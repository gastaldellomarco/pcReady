import { z } from "zod";

export const ScriptSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  category: z.string().min(1, "Categoria obbligatoria"),
  description: z.string().trim().optional().nullable(),
  language: z.string().min(1, "Seleziona linguaggio"),
  content: z.string().min(1, "Il contenuto non può essere vuoto"),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  changeNote: z.string().trim().optional().nullable(),
});

export type ScriptInput = z.infer<typeof ScriptSchema>;
