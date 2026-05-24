import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import i18n from "@/i18n";
import { MaintenancePage } from "@/components/errors/MaintenancePage";
import NotFoundPage from "@/components/errors/NotFoundPage";
import { ServerErrorPage } from "@/components/errors/ServerErrorPage";
import { AuthProvider } from "@/lib/auth-provider";
import { ThemeProvider } from "@/components/ThemeProvider";
import QueryProvider from "@/lib/queries/queryClient";
import { Toaster } from "@/components/ui/sonner";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { isMaintenanceModeEnabled } from "@/lib/maintenance-env";

import appCss from "../styles.css?url";

const FONTS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: i18n.t("common:root.title", "PCReady - Gestione preparazione PC") },
      {
        name: "description",
        content: i18n.t(
          "common:root.description",
          "Gestione completa della preparazione e configurazione dei PC aziendali: ticket, checklist, automazioni e inventario.",
        ),
      },
      { property: "og:title", content: i18n.t("common:root.title", "PCReady - Gestione preparazione PC") },
      {
        property: "og:description",
        content: i18n.t(
          "common:root.ogDescription",
          "Ticket, checklist, automazioni e inventario per i tuoi PC aziendali.",
        ),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preload", href: FONTS_STYLESHEET, as: "style" },
      { rel: "preload", href: appCss, as: "style" },
      { rel: "stylesheet", href: FONTS_STYLESHEET },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/app-icon.svg" },
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
    <html lang="it">
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
  if (isMaintenanceModeEnabled()) {
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
          <ConnectionBanner />
          <Outlet />
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
