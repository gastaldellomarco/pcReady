import { z } from "zod";

const ScriptParameterSchema = z.object({
  name: z.string().min(1, "Nome parametro obbligatorio"),
  label: z.string().min(1, "Etichetta obbligatoria"),
  type: z.enum(["text", "number", "boolean"]),
  required: z.boolean().default(false),
});

export type ScriptParameter = z.infer<typeof ScriptParameterSchema>;

export const ScriptSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  category: z.string().min(1, "Categoria obbligatoria"),
  description: z.string().trim().optional().nullable(),
  language: z.string().min(1, "Seleziona linguaggio"),
  content: z.string().min(1, "Il contenuto non può essere vuoto"),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  parameters: z.array(ScriptParameterSchema).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  changeNote: z.string().trim().optional().nullable(),
});

/**
 *
 */
export type ScriptInput = z.infer<typeof ScriptSchema>;
