import { randomUUID } from "@/lib/random-uuid";
import type { QuoteLineDraft } from "./QuoteModal";

/**
 *
 */
export function createEmptyQuoteLine(): QuoteLineDraft {
  return {
    id: randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "0",
    itemType: "extra",
  };
}
