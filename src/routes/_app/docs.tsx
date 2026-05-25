import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/docs")({
  head: () => ({
    meta: [
      { title: i18n.t("docs.pageTitle", "API Docs - PCReady") },
      { name: "description", content: i18n.t("docs.pageDescription", "Documentazione OpenAPI e console Swagger UI.") },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
