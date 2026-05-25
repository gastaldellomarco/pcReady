import { createLazyFileRoute } from "@tanstack/react-router";
import TicketsArchivePage from "@/components/pages/tickets.archive.page";

export const Route = createLazyFileRoute("/_app/tickets_/archive")({
  component: TicketsArchivePage,
});
