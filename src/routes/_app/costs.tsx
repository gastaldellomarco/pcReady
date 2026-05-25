import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/costs")({
  head: () => ({
    meta: [
      { title: i18n.t("costs:meta.title") },
      { name: "description", content: i18n.t("costs:meta.description") },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
