import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/tickets_/archive")({
  head: () => ({
    meta: [
      { title: i18n.t("tickets:meta.archiveTitle", "Storico ticket — PCReady") },
      {
        name: "description",
        content: i18n.t("tickets:meta.archiveDescription", "Lista dei ticket archiviati."),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
