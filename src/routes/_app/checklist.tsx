import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/checklist")({
  head: () => ({
    meta: [
      { title: i18n.t("checklist:meta.title", "Checklist — PCReady") },
      {
        name: "description",
        content: i18n.t(
          "checklist:meta.description",
          "Crea e gestisci checklist personalizzate per la preparazione PC.",
        ),
      },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
