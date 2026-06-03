import { z } from "zod";
import { DEFAULT_STRUCTURE } from "@/lib/pcready";
import type { ChecklistStructure } from "@/lib/pcready";

/** Voce checklist (modello DB / JSON `structure`). */
export const ChecklistItemDefSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(["checkbox", "text", "number"]).optional(),
  required: z.boolean().optional(),
});

/** Sezione all'interno di un gruppo. */
export const ChecklistSectionSchema = z.object({
  label: z.string(),
  items: z.array(ChecklistItemDefSchema),
  assigned_to: z.string().uuid().nullable().optional(),
});

/** Gruppo contenente sezioni. */
export const ChecklistGroupSchema = z.object({
  label: z.string(),
  collapsed: z.boolean().optional(),
  sections: z.record(z.string(), ChecklistSectionSchema),
});

/** Struttura completa (due livelli): gruppo → sezioni → voci. */
export const ChecklistStructureSchema = z.record(z.string(), ChecklistGroupSchema);

/**
 *
 */
export function parseChecklistStructure(raw: unknown): ChecklistStructure {
  if (!raw || typeof raw !== "object") return DEFAULT_STRUCTURE;

  let payload = raw;
  const keys = Object.keys(raw as Record<string, unknown>);
  const firstKey = keys[0];

  if (firstKey) {
    const firstVal = (raw as Record<string, unknown>)[firstKey];
    // Detect old flat format: values have `items` directly, NOT `sections`
    if (
      firstVal &&
      typeof firstVal === "object" &&
      "items" in (firstVal as object) &&
      !("sections" in (firstVal as object))
    ) {
      // Auto-wrap all old sections into a single default group
      payload = {
        legacy_group: {
          label: "Generale",
          sections: raw,
        },
      };
    }
  }

  const parsed = ChecklistStructureSchema.safeParse(payload);
  if (parsed.success) return parsed.data as ChecklistStructure;
  return DEFAULT_STRUCTURE;
}

// Keep legacy type alias for backward compat
export type { ChecklistStructure } from "@/lib/pcready";
