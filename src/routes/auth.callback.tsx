import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Accesso in corso - PCReady" },
      { name: "description", content: "Completamento accesso a PCReady." },
    ],
  }),
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--bg2)" }}
    >
      <div className="w-full max-w-md">
        <LoadingSkeleton />
      </div>
    </div>
  ),
});

