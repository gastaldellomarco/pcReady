import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: i18n.t("automations:meta.title", "Automazioni — PCReady") }] }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
