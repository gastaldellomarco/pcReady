import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { MaintenancePage } from "@/components/errors/MaintenancePage";
import NotFoundPage from "@/components/errors/NotFoundPage";
import { ServerErrorPage } from "@/components/errors/ServerErrorPage";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import QueryProvider from "@/lib/queries/queryClient";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PCReady - Gestione preparazione PC" },
      {
        name: "description",
        content:
          "Gestione completa della preparazione e configurazione dei PC aziendali: ticket, checklist, automazioni e inventario.",
      },
      { property: "og:title", content: "PCReady - Gestione preparazione PC" },
      {
        property: "og:description",
        content: "Ticket, checklist, automazioni e inventario per i tuoi PC aziendali.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  errorComponent: ({ error }) => <ErrorBoundary error={error} />,
  notFoundComponent: NotFoundPage,
});

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <ThemeProvider defaultTheme="system" enableSystem>
      <ServerErrorPage error={error} />
    </ThemeProvider>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  if (import.meta.env.VITE_MAINTENANCE_MODE === "true") {
    return (
      <ThemeProvider defaultTheme="system" enableSystem>
        <MaintenancePage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="system" enableSystem>
      <QueryProvider>
        <AuthProvider>
          <Outlet />
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
