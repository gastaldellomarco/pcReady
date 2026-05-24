import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { PageErrorBoundary } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
// Ensure a safe global fallback so accidental bare references don't crash rendering
try {
  (globalThis as any).organizationName =
    (globalThis as any).__APP_SETTINGS__?.organization_name ?? "PCReady";
} catch {
  // Ignore environments where globalThis is not writable.
}
import { appVersion, viteDeploymentLabel } from "@/lib/app-version-display";
import { useAuth, type AuthProfile } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { useAdminAuditBadge } from "@/hooks/useAdminAuditBadge";
import { avatarColors } from "@/lib/pcready";
import {
  LayoutGrid,
  Ticket,
  Trello,
  ListChecks,
  Zap,
  Boxes,
  Search,
  Moon,
  Sun,
  Monitor,
  Plus,
  Terminal,
  Users,
  UserRound,
  Menu,
  Building2,
  BookOpenText,
  Euro,
  CalendarDays,
  Package,
  Languages,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTickets } from "@/lib/use-tickets";
import { CreateTicketModal } from "@/components/pcready/CreateTicketModal";
import { AddDeviceModal } from "@/components/pcready/AddDeviceModal";
import { TicketDetailModal } from "@/components/pcready/TicketDetailModal";
import { DeviceDetailModal } from "@/components/pcready/DeviceDetailModal";
import { getPublicAppSettings, setClientAppSettings } from "@/lib/app-settings";
import { getMfaClientStatus } from "@/lib/mfa-client";
import { updateMyProfile } from "@/lib/user-profile";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { AppLogo } from "@/components/brand/AppLogo";
import {
  AuthErrorScreen,
  AuthLoadingScreen,
  MissingProfileScreen,
} from "@/components/auth/AuthStateScreens";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

type NavigationRole = AuthProfile["role"];
type NavigationVisibility = "all" | "desktop" | "mobile";
type NavigationBadge = "pendingTickets";
type NavigationFeatureFlag = string;

interface NavigationItem {
  to: string;
  label: string;
  title?: string;
  icon: LucideIcon;
  badge?: NavigationBadge;
  requiredRoles?: readonly NavigationRole[];
  visibility?: NavigationVisibility;
  featureFlag?: NavigationFeatureFlag;
}

interface NavigationGroup {
  id: string;
  label: string;
  items: readonly NavigationItem[];
}

const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: "main",
    label: "Principale",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { to: "/tickets", label: "Ticket PC", icon: Ticket, badge: "pendingTickets" },
      { to: "/kanban", label: "Kanban", title: "Kanban Board", icon: Trello },
      { to: "/calendar", label: "Calendario", icon: CalendarDays },
    ],
  },
  {
    id: "configuration",
    label: "Configurazione",
    items: [
      { to: "/checklist", label: "Checklist", title: "Checklist Setup", icon: ListChecks },
      { to: "/automations", label: "Automazioni", icon: Zap },
      { to: "/scripts", label: "Script", icon: Terminal },
      { to: "/clients", label: "Clienti", icon: Building2 },
      { to: "/contacts", label: "Referenti", icon: UserRound },
      { to: "/costs", label: "Costi", icon: Euro, requiredRoles: ["admin", "tech"] },
      { to: "/bundles", label: "Bundle", icon: Package, requiredRoles: ["admin", "tech"] },
      { to: "/inventory", label: "Inventario", icon: Boxes },
      { to: "/docs", label: "API Docs", icon: BookOpenText, requiredRoles: ["admin", "tech"] },
      { to: "/admin", label: "Admin / Utenti", icon: Users, requiredRoles: ["admin"] },
    ],
  },
] as const;

type NavPath = (typeof NAVIGATION_GROUPS)[number]["items"][number]["to"];
type ResolvedNavigationGroup = NavigationGroup & { items: readonly NavigationItem[] };

interface NavLinkItemProps {
  to: NavPath | string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}

function resolveNavigationGroups({
  profile,
  isMobile,
  enabledFeatureFlags,
}: {
  profile: AuthProfile;
  isMobile: boolean;
  enabledFeatureFlags: readonly NavigationFeatureFlag[];
}): ResolvedNavigationGroup[] {
  return NAVIGATION_GROUPS.map((group) => ({
    ...group,
    label: i18n.t("common:nav." + group.id, group.label),
    items: group.items
      .filter((item) => {
        const roleAllowed = !item.requiredRoles || item.requiredRoles.includes(profile.role);
        const visibilityAllowed =
          !item.visibility ||
          item.visibility === "all" ||
          (item.visibility === "mobile" && isMobile) ||
          (item.visibility === "desktop" && !isMobile);
        const featureEnabled = !item.featureFlag || enabledFeatureFlags.includes(item.featureFlag);

        return roleAllowed && visibilityAllowed && featureEnabled;
      })
      .map((item) => ({
        ...item,
        label: i18n.t("common:nav." + item.to.replace("/", ""), item.label),
        title: item.title
          ? i18n.t("common:pageTitle." + item.to.replace("/", ""), item.title)
          : undefined,
      })),
  })).filter((group) => group.items.length > 0);
}

function resolveNavigationBadge(item: NavigationItem, pendingCount: number) {
  if (item.badge === "pendingTickets") return pendingCount;

  return undefined;
}

const PAGE_TITLE_KEYS: Record<string, string> = {
  "/dashboard": "pageTitle.dashboard",
  "/tickets": "pageTitle.tickets",
  "/kanban": "pageTitle.kanban",
  "/checklist": "pageTitle.checklist",
  "/automations": "pageTitle.automations",
  "/scripts": "pageTitle.scripts",
  "/clients": "pageTitle.clients",
  "/contacts": "pageTitle.contacts",
  "/costs": "pageTitle.costs",
  "/bundles": "pageTitle.bundles",
  "/inventory": "pageTitle.inventory",
  "/docs": "pageTitle.docs",
  "/admin": "pageTitle.admin",
  "/profile": "pageTitle.profile",
  "/notifications": "pageTitle.notifications",
  "/calendar": "pageTitle.calendar",
};

const PAGE_TITLE_FALLBACKS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tickets": "Ticket PC",
  "/kanban": "Kanban Board",
  "/checklist": "Checklist Setup",
  "/automations": "Automazioni",
  "/scripts": "Script",
  "/clients": "Clienti",
  "/contacts": "Referenti",
  "/costs": "Costi",
  "/bundles": "Bundle assistenza",
  "/inventory": "Inventario",
  "/docs": "API Docs",
  "/admin": "Admin / Utenti",
  "/profile": "Profilo",
  "/notifications": "Notifiche",
  "/calendar": "Calendario",
};

function AppLayout() {
  const { session, profile, loading, profileLoading, authError, refreshProfile, signOut } =
    useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { theme, setTheme, isDark } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const { pendingCount, openCreate } = useTickets();
  const adminErrorCount = useAdminAuditBadge(session?.access_token, profile?.role === "admin");
  const route = useRouterState({ select: (s) => s.location.pathname });
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [mfaChecking, setMfaChecking] = useState(false);
  const [mfaRequiredMessage, setMfaRequiredMessage] = useState<string | null>(null);
  const loadSettings = useServerFn(getPublicAppSettings);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadSettings({ data: { accessToken: session.access_token } })
      .then((s) => {
        const org = s?.organization_name || null;
        setOrganizationName(org);
        setClientAppSettings(s || {});
        try {
          (globalThis as any).organizationName = org || "PCReady";
        } catch {
          // Ignore environments where globalThis is not writable.
        }
      })
      .catch(() => {});
  }, [loadSettings, session?.access_token]);

  useEffect(() => {
    if (!session || !profile || profile.password_set === false || route.startsWith("/profile"))
      return;
    let active = true;
    setMfaChecking(true);
    getMfaClientStatus(session.user.id)
      .then((status) => {
        if (!active) return;
        if (status.needsChallenge) {
          navigate({ to: "/auth/2fa-challenge", replace: true });
          return;
        }
        const settings = (globalThis as any).__APP_SETTINGS__ || {};
        const required =
          settings.mfa_require_all_users === true ||
          (settings.mfa_require_admin_users === true && profile.role === "admin");
        if (required && !status.enabled) {
          const graceDays = Number(settings.mfa_grace_period_days ?? 7);
          const createdAt = new Date(session.user.created_at ?? Date.now()).getTime();
          const graceEndsAt = createdAt + Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
          const expired = Date.now() > graceEndsAt;
          setMfaRequiredMessage(
            expired
              ? "Configura il 2FA per sbloccare l'accesso operativo."
              : "Il 2FA e richiesto dalla policy aziendale: configuralo dal profilo.",
          );
          navigate({ to: "/profile", search: () => ({ tab: "security" }) as any, replace: true });
        } else {
          setMfaRequiredMessage(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setMfaChecking(false);
      });
    return () => {
      active = false;
    };
  }, [navigate, profile, route, session]);

  useEffect(() => {
    const titleKey = Object.keys(PAGE_TITLE_FALLBACKS).find((k) => route.startsWith(k));
    const currentPageTitle = titleKey
      ? t(PAGE_TITLE_KEYS[titleKey], PAGE_TITLE_FALLBACKS[titleKey])
      : "PCReady";
    const org = organizationName || "PCReady";
    document.title = currentPageTitle ? `${currentPageTitle} - ${org}` : org;
  }, [route, organizationName, i18n.language]);

  useEffect(() => {
    if (!loading && session && profile && !profile.password_set) {
      navigate({ to: "/auth/set-password", replace: true });
    }
  }, [loading, navigate, profile, session]);

  if (loading || profileLoading || !session || mfaChecking) {
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

  const avc = avatarColors(profile.initials);
  const title = Object.keys(PAGE_TITLE_FALLBACKS).find((k) => route.startsWith(k));
  const pageTitle = title ? t(PAGE_TITLE_KEYS[title], PAGE_TITLE_FALLBACKS[title]) : "PCReady";
  const navigationGroups = resolveNavigationGroups({
    profile,
    isMobile,
    enabledFeatureFlags: [],
  });
  const sidebarContent = (
    <SidebarContent
      profile={profile}
      avatarColor={avc}
      route={route}
      pendingCount={pendingCount}
      adminErrorCount={adminErrorCount}
      navigationGroups={navigationGroups}
      theme={theme}
      isDark={isDark}
      onSetTheme={setTheme}
      onNavigate={() => setMobileNavOpen(false)}
      onSignOut={() => signOut()}
    />
  );

  return (
    <div className="flex min-h-dvh overflow-x-hidden">
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
          <SheetTitle className="sr-only">{t("sidebar.navigation", "Navigazione PCReady")}</SheetTitle>
          <SheetDescription className="sr-only">{t("sidebar.mainMenu", "Menu principale dell'applicazione")}</SheetDescription>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col" style={{ marginLeft: isMobile ? 0 : 240 }}>
        <header
          className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b px-3 py-2 md:px-7"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {isMobile && (
            <button
              className="pc-btn-icon touch-target"
              onClick={() => setMobileNavOpen(true)}
              title={t("sidebar.openMenu", "Apri menu")}
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <h1
            className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-tight sm:text-[17px]"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {pageTitle}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SearchBox />
            <NotificationBell />
            <Link to="/inventory" className="pc-btn pc-btn-ghost pc-btn-sm hidden sm:inline-flex">
              <Boxes className="w-3 h-3" /> {t("sidebar.inventory", "Inventario")}
            </Link>
            <button
              onClick={() => openCreate()}
              className="pc-btn pc-btn-primary pc-btn-sm hidden sm:inline-flex"
            >
              <Plus className="w-3 h-3" /> {t("sidebar.newTicket", "Nuovo Ticket")}
            </button>
            <button
              onClick={() => openCreate()}
              className="pc-btn-icon touch-target sm:hidden"
              aria-label={t("sidebar.newTicket", "Nuovo ticket")}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </header>
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
      <CreateTicketModal />
      <AddDeviceModal />
      <TicketDetailModal />
      <DeviceDetailModal />
    </div>
  );
}

interface SidebarContentProps {
  profile: AuthProfile;
  avatarColor: { bg: string; fg: string };
  route: string;
  pendingCount: number;
  adminErrorCount: number;
  navigationGroups: readonly ResolvedNavigationGroup[];
  theme: "light" | "dark" | "system";
  isDark: boolean;
  onSetTheme: (theme: "light" | "dark" | "system") => void;
  onNavigate: () => void;
  onSignOut: () => void;
}

function SidebarContent({
  profile,
  avatarColor,
  route,
  pendingCount,
  adminErrorCount,
  navigationGroups,
  theme,
  isDark: _isDark,
  onSetTheme,
  onNavigate,
  onSignOut,
}: SidebarContentProps) {
  const { t } = useTranslation("common");
  const deploymentLabel = viteDeploymentLabel();

  return (
    <>
      <div
        className="px-[18px] py-[18px] border-b flex items-center gap-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        <AppLogo variant="horizontal" className="shrink-0 text-[18px]" iconClassName="h-8 w-8" />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[10px] text-text3"
            style={{ fontFamily: "var(--font-mono)" }}
            title={`v${appVersion}${deploymentLabel ? ` - ${deploymentLabel}` : ""}`}
          >
            v{appVersion}
            {deploymentLabel ? ` - ${deploymentLabel}` : null}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-[10px] py-[14px]">
        {navigationGroups.map((group) => (
          <NavSection key={group.id} label={group.label}>
            {group.items.map((item) => {
              const itemBadge =
                item.to === "/admin" ? adminErrorCount : resolveNavigationBadge(item, pendingCount);
              return (
                <NavLinkItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  active={route.startsWith(item.to)}
                  badge={itemBadge}
                  onClick={onNavigate}
                />
              );
            })}
          </NavSection>
        ))}
      </nav>

      <div
        className="px-[14px] py-[13px] border-t flex flex-col gap-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-between rounded-[7px] px-[10px] py-[6px] text-[11px] font-semibold cursor-pointer transition-colors w-full"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                color: "var(--text2)",
              }}
            >
              <span className="flex items-center gap-2">
                {theme === "light" && <Sun className="w-3 h-3" />}
                {theme === "dark" && <Moon className="w-3 h-3" />}
                {theme === "system" && <Monitor className="w-3 h-3" />}
                <span>
                  {theme === "light" && t("sidebar.light", "Chiaro")}
                  {theme === "dark" && t("sidebar.dark", "Scuro")}
                  {theme === "system" && t("sidebar.system", "Sistema")}
                </span>
              </span>
              <span className="text-[10px] opacity-60">{t("sidebar.theme", "Tema")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[200px]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <DropdownMenuItem
              onClick={() => onSetTheme("light")}
              className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
            >
              <Sun className="w-4 h-4" />
              <span>{t("sidebar.light", "Chiaro")}</span>
              {theme === "light" && (
                <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetTheme("dark")}
              className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
            >
              <Moon className="w-4 h-4" />
              <span>{t("sidebar.dark", "Scuro")}</span>
              {theme === "dark" && (
                <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetTheme("system")}
              className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
            >
              <Monitor className="w-4 h-4" />
              <span>{t("sidebar.system", "Sistema")}</span>
              {theme === "system" && (
                <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <LanguageSelector />
        <div className="flex items-center justify-between gap-2">
          <UserMenu
            profile={profile}
            avatarColor={avatarColor}
            roleLabel={roleLabel(profile.role)}
            onSignOut={onSignOut}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-[22px]">
      <div className="sb-text text-[9.5px] font-bold tracking-[1px] uppercase text-text3 px-2 mb-[5px]">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavLinkItem({ to, label, icon: Icon, active, badge, onClick }: NavLinkItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex min-h-11 items-center gap-[9px] rounded-[7px] px-[9px] py-[8px] text-[13px] font-medium transition-all"
      style={{
        background: active ? "var(--accent2)" : "transparent",
        color: active ? "var(--accent)" : "var(--text2)",
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon className="w-[15px] h-[15px] flex-shrink-0" style={{ opacity: active ? 1 : 0.85 }} />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="ml-auto text-white text-[9.5px] font-bold rounded-full px-[6px] py-0 min-w-[18px] text-center"
          style={{ background: "var(--accent)", fontFamily: "var(--font-mono)" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function SearchBox() {
  const { t } = useTranslation("common");
  const { search, setSearch } = useTickets();
  return (
    <div
      className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-[7px]"
      style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
    >
      <Search className="w-3 h-3 text-text3" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("search.placeholder", "Cerca ticket, modello, seriale...")}
        className="bg-transparent outline-none text-[13px] w-44"
      />
    </div>
  );
}

function roleLabel(r: string) {
  return r === "admin"
    ? i18n.t("common:role.admin", "Amministratore")
    : r === "tech"
      ? i18n.t("common:role.tech", "Tecnico")
      : i18n.t("common:role.viewer", "Visualizzatore");
}

function LanguageSelector() {
  const { session, refreshProfile } = useAuth();
  const { t } = useTranslation("common");
  const saveProfile = useServerFn(updateMyProfile);
  const currentLang = i18n.language?.startsWith("en") ? "en" : "it";

  async function handleLanguageChange(lang: "it" | "en") {
    if (lang === currentLang) return;
    void i18n.changeLanguage(lang);
    if (!session?.access_token) return;
    try {
      await saveProfile({
        data: {
          accessToken: session.access_token,
          profile: { language: lang },
        },
      });
      await refreshProfile();
    } catch {
      toast.error(t("language.saveError", "Errore durante il salvataggio della lingua"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center justify-between rounded-[7px] px-[10px] py-[6px] text-[11px] font-semibold cursor-pointer transition-colors w-full"
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            color: "var(--text2)",
          }}
        >
          <span className="flex items-center gap-2">
            <Languages className="w-3 h-3" />
            <span>{currentLang === "it" ? t("language.italian", "Italiano") : t("language.english", "English")}</span>
          </span>
          <span className="text-[10px] opacity-60">{t("sidebar.language")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[200px]"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <DropdownMenuItem
          onClick={() => handleLanguageChange("it")}
          className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
        >
          <span>🇮🇹</span>
          <span>{t("language.italian", "Italiano")}</span>
          {currentLang === "it" && (
            <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
              ✓
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange("en")}
          className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
        >
          <span>🇬🇧</span>
          <span>{t("language.english", "English")}</span>
          {currentLang === "en" && (
            <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
              ✓
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
