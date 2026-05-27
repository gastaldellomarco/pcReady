import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { useAuth } from "@/lib/auth-context";

import { useIsMobile } from "@/hooks/use-mobile";
import { useTickets } from "@/lib/use-tickets";
import { useAdminAuditBadge } from "@/hooks/useAdminAuditBadge";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { avatarColors } from "@/lib/pcready";
import {
  PAGE_TITLE_KEYS,
  PAGE_TITLE_FALLBACKS,
  resolveNavigationGroups,
} from "@/lib/navigation";
import { PageErrorBoundary } from "@/components/page-states";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CreateTicketModal } from "@/components/pcready/CreateTicketModal";
import { AddDeviceModal } from "@/components/pcready/AddDeviceModal";
import { TicketDetailModal } from "@/components/pcready/TicketDetailModal";
import { DeviceDetailModal } from "@/components/pcready/DeviceDetailModal";
import {
  AuthErrorScreen,
  AuthLoadingScreen,
  MissingProfileScreen,
} from "@/components/auth/AuthStateScreens";

// Ensure a safe global fallback so accidental bare references don't crash rendering
try {
  (globalThis as any).organizationName =
    (globalThis as any).__APP_SETTINGS__?.organization_name ?? "PCReady";
} catch {
  // Ignore environments where globalThis is not writable.
}

export function AppShell() {
  const { session, profile, authError, refreshProfile, signOut } = useAuth();
  const { t } = useTranslation("common");
  const isMobile = useIsMobile();
  const { pendingCount, openCreate } = useTickets();
  const route = useRouterState({ select: (s) => s.location.pathname });
  const { guardLoading, mfaRequiredMessage, organizationName } = useAuthGuard();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const adminErrorCount = useAdminAuditBadge(session?.access_token, profile?.role === "admin");

  // ── Page title management ──────────────────────────────────────
  useEffect(() => {
    const titleKey = Object.keys(PAGE_TITLE_FALLBACKS).find((k) => route.startsWith(k));
    const currentPageTitle = titleKey
      ? t(PAGE_TITLE_KEYS[titleKey], PAGE_TITLE_FALLBACKS[titleKey])
      : "PCReady";
    const org = organizationName || "PCReady";
    document.title = currentPageTitle ? `${currentPageTitle} - ${org}` : org;
  }, [route, organizationName, i18n.language]);

  // ── Guard: loading / auth error / missing profile ──────────────
  if (guardLoading) {
    return <AuthLoadingScreen />;
  }

  if (authError) {
    return (
      <AuthErrorScreen
        message={authError}
        onRetry={() => refreshProfile()}
        onSignOut={() => signOut()}
      />
    );
  }

  if (!profile) {
    return <MissingProfileScreen onRetry={() => refreshProfile()} onSignOut={() => signOut()} />;
  }

  if (!profile.password_set) {
    return <AuthLoadingScreen message={t("sidebar.redirecting", "Reindirizzamento...")} />;
  }

  // ── Derived data ───────────────────────────────────────────────
  const avc = avatarColors(profile.initials);
  const title = Object.keys(PAGE_TITLE_FALLBACKS).find((k) => route.startsWith(k));
  const pageTitle = title ? t(PAGE_TITLE_KEYS[title], PAGE_TITLE_FALLBACKS[title]) : "PCReady";
  const navigationGroups = resolveNavigationGroups({
    profile,
    isMobile,
    enabledFeatureFlags: [],
  });

  const sidebarContent = (
    <Sidebar
      profile={profile}
      avatarColor={avc}
      route={route}
      pendingCount={pendingCount}
      adminErrorCount={adminErrorCount}
      navigationGroups={navigationGroups}
      onNavigate={() => setMobileNavOpen(false)}
      onSignOut={() => signOut()}
    />
  );

  return (
    <div className="flex min-h-dvh overflow-x-hidden">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          className="fixed top-0 left-0 bottom-0 z-40 flex flex-col border-r"
          style={{
            width: "240px",
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Mobile navigation sheet */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[300px] max-w-[86vw] flex-col p-0"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          <SheetTitle className="sr-only">
            {t("sidebar.navigation", "Navigazione PCReady")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t("sidebar.mainMenu", "Menu principale dell'applicazione")}
          </SheetDescription>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ marginLeft: isMobile ? 0 : 240 }}>
        <TopBar
          pageTitle={pageTitle}
          isMobile={isMobile}
          onMobileMenuOpen={() => setMobileNavOpen(true)}
          onCreateTicket={() => openCreate()}
        />
        <main className="pc-anim-in min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 md:px-7 md:py-6">
          {mfaRequiredMessage ? (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {mfaRequiredMessage}
            </div>
          ) : null}
          <PageErrorBoundary variant="app">
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>

      {/* Global modals */}
      <CreateTicketModal />
      <AddDeviceModal />
      <TicketDetailModal />
      <DeviceDetailModal />
    </div>
  );
}
