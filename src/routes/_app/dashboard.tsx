import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: i18n.t("dashboard:meta.title", "Dashboard - PCReady") },
      {
        name: "description",
        content: i18n.t("dashboard:meta.description", "Panoramica ticket, pipeline e attivita recente in PCReady."),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
