import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/calendar")({
  head: () => ({
    meta: [
      { title: i18n.t("calendar:meta.title", "Calendario") },
      {
        name: "description",
        content: i18n.t("calendar:meta.description", "Calendario condiviso del team"),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
