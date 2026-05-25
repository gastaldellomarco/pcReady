import { createFileRoute } from "@tanstack/react-router";
import i18n from "@/i18n";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: i18n.t("inventory:meta.title", "Inventario - PCReady") },
      {
        name: "description",
        content: i18n.t("inventory:meta.description", "Inventario completo dei dispositivi gestiti, con seriali e stato."),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
