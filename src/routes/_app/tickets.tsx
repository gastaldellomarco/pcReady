import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/tickets")({
  head: () => ({
    meta: [
      { title: i18n.t("tickets:meta.title", "Ticket PC - PCReady") },
      {
        name: "description",
        content: i18n.t(
          "tickets:meta.description",
          "Lista dei ticket di preparazione PC con filtri avanzati.",
        ),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
