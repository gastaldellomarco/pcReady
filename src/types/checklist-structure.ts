import { z } from "zod";
import type { ChecklistStructure } from "@/lib/pcready";
import { DEFAULT_STRUCTURE } from "@/lib/pcready";

/** Voce checklist (modello DB / JSON `structure`). */
export const ChecklistItemDefSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(["checkbox", "text", "number"]).optional(),
  required: z.boolean().optional(),
});

/** Tab/sezione della checklist. */
export const ChecklistTabDefSchema = z.object({
  label: z.string(),
  items: z.array(ChecklistItemDefSchema),
});

/**
 * Struttura completa `checklist_templates.structure` (JSON Supabase).
 * Chiavi dinamiche = id sezione; valori = label + voci.
 */
export const ChecklistStructureSchema = z.record(z.string(), ChecklistTabDefSchema);

export type ChecklistStructureJson = z.infer<typeof ChecklistStructureSchema>;

export function parseChecklistStructure(raw: unknown): ChecklistStructure {
  const parsed = ChecklistStructureSchema.safeParse(raw);
  if (parsed.success) return parsed.data as ChecklistStructure;
  return DEFAULT_STRUCTURE;
}
