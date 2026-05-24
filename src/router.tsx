import "@/i18n";
import { createRouter } from "@tanstack/react-router";
import { ServerErrorPage } from "@/components/errors/ServerErrorPage";
import { PageSkeleton } from "@/components/page-states";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => <PageSkeleton />,
    defaultErrorComponent: ({ error }) => <ServerErrorPage error={error} />,
  });

  return router;
};
