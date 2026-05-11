import { createRouter } from "@tanstack/react-router";
import { ServerErrorPage } from "@/components/errors/ServerErrorPage";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error }) => <ServerErrorPage error={error} />,
  });

  return router;
};