import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";

const searchSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  scope: z.string(),
  state: z.string().optional(),
  response_type: z.string().optional(),
});

export const Route = createFileRoute("/_app/oauth/consent")({
  validateSearch: searchSchema,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});
