import { useRouter } from "@tanstack/react-router";
import { errorMessage, PageFetchError, PageSkeleton } from "@/components/page-states";

export function LoadingSkeleton({ variant = "app" as const }: { variant?: "app" | "portal" }) {
  return <PageSkeleton variant={variant} />;
}

export { PageSkeleton };

function RouteErrorView({ error, reset }: { error: Error | unknown; reset?: () => void }) {
  const router = useRouter();
  const message = errorMessage(error, "Errore sconosciuto");
  const onRetry = () => {
    if (reset) reset();
    else void router.invalidate();
  };
  return <PageFetchError title="Qualcosa è andato storto" message={message} onRetry={onRetry} />;
}

export function RouteError({ error, reset }: { error: Error | unknown; reset?: () => void }) {
  return <RouteErrorView error={error} reset={reset} />;
}

export default {};
