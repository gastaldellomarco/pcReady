import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import i18n from "@/i18n";

export const Route = createFileRoute("/_app/clients")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: typeof search.clientId === "string" ? search.clientId : undefined,
    tab:
      search.tab === "info" ||
      search.tab === "contacts" ||
      search.tab === "tickets" ||
      search.tab === "devices"
        ? search.tab
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: i18n.t("clients:head.title", "Clienti - PCReady") },
      { name: "description", content: i18n.t("clients:head.description", "Anagrafica clienti e referenti aziendali.") },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
