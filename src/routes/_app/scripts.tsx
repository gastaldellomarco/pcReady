import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/scripts")({
  head: () => ({
    meta: [
      { title: i18n.t("scripts:meta.title", "Script — PCReady") },
      {
        name: "description",
        content: i18n.t(
          "scripts:meta.description",
          "Libreria script riutilizzabili: PowerShell, Bash e altri.",
        ),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
