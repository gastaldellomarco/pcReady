import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

type ErrorKind = "network" | "auth" | "missing-data" | "runtime";

function getErrorKind(error: Error): ErrorKind {
  const message = error.message.toLowerCase();
  const status = "status" in error && typeof error.status === "number" ? error.status : undefined;

  if (
    status === 401 ||
    status === 403 ||
    message.includes("auth") ||
    message.includes("jwt") ||
    message.includes("session") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  ) {
    return "auth";
  }

  if (
    status === 404 ||
    message.includes("not found") ||
    message.includes("missing") ||
    message.includes("non disponibile") ||
    message.includes("not available")
  ) {
    return "missing-data";
  }

  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("load failed") ||
    message.includes("timeout")
  ) {
    return "network";
  }

  return "runtime";
}

function getErrorContent(kind: ErrorKind) {
  switch (kind) {
    case "network":
      return {
        title: "Connessione non disponibile",
        description:
          "Non siamo riusciti a recuperare i dati. Verifica la connessione e prova a ricaricare.",
        primaryAction: "Ricarica dati",
      };
    case "auth":
      return {
        title: "Sessione da verificare",
        description:
          "La sessione potrebbe essere scaduta o non avere i permessi necessari per questa operazione.",
        primaryAction: "Ricarica dati",
      };
    case "missing-data":
      return {
        title: "Dati non disponibili",
        description:
          "Le informazioni richieste non sono disponibili o non possono essere caricate in questo momento.",
        primaryAction: "Ricarica dati",
      };
    case "runtime":
      return {
        title: "Qualcosa non ha funzionato",
        description:
          "Si è verificato un problema inatteso. Puoi riprovare o tornare alla dashboard.",
        primaryAction: "Riprova",
      };
  }
}

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const kind = getErrorKind(error);
  const content = getErrorContent(kind);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{content.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {content.description}
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {content.primaryAction}
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Torna alla dashboard
          </a>
          {kind === "auth" && (
            <a
              href="/auth"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Esci
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
