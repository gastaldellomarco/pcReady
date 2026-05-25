import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/bundles")({
  head: () => ({
    meta: [
      { title: i18n.t("bundles:meta.title", "Bundle assistenza - PCReady") },
      {
        name: "description",
        content: i18n.t("bundles:meta.description", "Pacchetti assistenza, assegnazioni clienti e consumi"),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
