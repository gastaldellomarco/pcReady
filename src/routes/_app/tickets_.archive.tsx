import { createFileRoute } from "@tanstack/react-router";
import TicketsArchivePage from "@/components/pages/tickets.archive.page";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";

export const Route = createFileRoute("/_app/tickets_/archive")({
  head: () => ({
    meta: [
      { title: "Storico ticket — PCReady" },
      { name: "description", content: "Lista dei ticket archiviati." },
    ],
  }),
  component: TicketsArchivePage,
  errorComponent: ({ error }) => <RouteError error={error} />,
  pendingComponent: () => <LoadingSkeleton />,
});
