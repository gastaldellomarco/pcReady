import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [
      { title: i18n.t("kanban:meta.title", "Kanban — PCReady") },
      { name: "description", content: i18n.t("kanban:meta.description", "Vista Kanban dei ticket per stato di preparazione.") },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
