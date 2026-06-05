import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/docs")({
  head: () => ({
    meta: [
      {
        title: i18n.t("docs.pageTitle", "Knowledge Base - PCReady"),
      },
      {
        name: "description",
        content: i18n.t(
          "docs.pageDescription",
          "Knowledge Base: onboarding, architecture, database schema, feature lifecycle, and API documentation.",
        ),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
