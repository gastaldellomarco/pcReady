import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/warehouse")({
  head: () => ({
    meta: [
      { title: i18n.t("warehouse:meta.title", "Magazzino / Ricambi - PCReady") },
      {
        name: "description",
        content: i18n.t(
          "warehouse:meta.description",
          "Gestione materiali e ricambi. Aggiungi fornitori, SKU, quantità e calcola prezzi con ricarico in tempo reale.",
        ),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
