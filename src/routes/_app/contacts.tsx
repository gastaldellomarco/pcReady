import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/contacts")({
  head: () => ({
    meta: [
      { title: i18n.t("contacts:page.head.title") },
      { name: "description", content: i18n.t("contacts:page.head.description") },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
