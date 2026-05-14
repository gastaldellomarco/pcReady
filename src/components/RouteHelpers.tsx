import { useRouter } from "@tanstack/react-router";
import { errorMessage, ListSkeleton, PageFetchError } from "@/components/page-states";

export function LoadingSkeleton({ variant = "app" as const }: { variant?: "app" | "portal" }) {
  return <ListSkeleton rows={5} variant={variant} className="p-1" />;
}

function RouteErrorView({
  error,
  reset,
}: {
  error: Error | unknown;
  reset?: () => void;
}) {
  const router = useRouter();
  const message = errorMessage(error, "Errore sconosciuto");
  const onRetry = () => {
    if (reset) reset();
    else void router.invalidate();
  };
  return <PageFetchError title="Qualcosa è andato storto" message={message} onRetry={onRetry} />;
}

export function RouteError({
  error,
  reset,
}: {
  error: Error | unknown;
  reset?: () => void;
}) {
  return <RouteErrorView error={error} reset={reset} />;
}

export default {};
