import { Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PageErrorBoundary } from "@/components/page-states";
import { Monitor } from "lucide-react";
import { validatePortalSession } from "@/lib/portal-auth";

export function PortalLayout() {
  const validate = useServerFn(validatePortalSession);
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) return;
    validate({ data: { token } })
      .then((session) => setBranding(session.branding))
      .catch(() => setBranding(null));
  }, [validate]);

  const primaryColor = branding?.primaryColor || "var(--primary)";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card" style={{ borderTop: `4px solid ${primaryColor}` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/portal" className="flex items-center gap-2 font-semibold">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo cliente" className="h-7 w-auto rounded" />
            ) : (
              <Monitor className="h-5 w-5" style={{ color: primaryColor }} />
            )}
            <span>{branding?.portalName || "PCReady"}</span>
            <span className="hidden text-muted-foreground sm:inline">| Portale Cliente</span>
          </a>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/portal/dashboard" className="hover:text-foreground">
              Dashboard
            </a>
            <a href="/portal/tickets" className="hover:text-foreground">
              Ticket
            </a>
            <a href="/portal/devices" className="hover:text-foreground">
              Dispositivi
            </a>
            <a href="/portal/documents" className="hover:text-foreground">
              Documenti
            </a>
            <a href="/portal/profile" className="hover:text-foreground">
              Profilo
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageErrorBoundary variant="portal">
          <Outlet />
        </PageErrorBoundary>
      </main>
    </div>
  );
}
