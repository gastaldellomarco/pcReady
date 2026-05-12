import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
// Ensure a safe global fallback so accidental bare references don't crash rendering
try {
  (globalThis as any).organizationName = (globalThis as any).__APP_SETTINGS__?.organization_name ?? "PCReady";
} catch {}
import { appVersion, viteDeploymentLabel } from "@/lib/app-version-display";
import { useAuth, type AuthProfile } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
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
  Menu,
  Building2,
  BookOpenText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTickets } from "@/lib/use-tickets";
import { CreateTicketModal } from "@/components/pcready/CreateTicketModal";
import { AddDeviceModal } from "@/components/pcready/AddDeviceModal";
import { TicketDetailModal } from "@/components/pcready/TicketDetailModal";
import { DeviceDetailModal } from "@/components/pcready/DeviceDetailModal";
import { getPublicAppSettings, setClientAppSettings } from "@/lib/app-settings";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/layout/NotificationBell";
import {
  AuthErrorScreen,
  AuthLoadingScreen,
  MissingProfileScreen,
} from "@/components/auth/AuthStateScreens";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
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
    items: group.items.filter((item) => {
      const roleAllowed = !item.requiredRoles || item.requiredRoles.includes(profile.role);
      const visibilityAllowed =
        !item.visibility ||
        item.visibility === "all" ||
        (item.visibility === "mobile" && isMobile) ||
        (item.visibility === "desktop" && !isMobile);
      const featureEnabled = !item.featureFlag || enabledFeatureFlags.includes(item.featureFlag);

      return roleAllowed && visibilityAllowed && featureEnabled;
    }),
  })).filter((group) => group.items.length > 0);
}

function resolveNavigationBadge(item: NavigationItem, pendingCount: number) {
  if (item.badge === "pendingTickets") return pendingCount;

  return undefined;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tickets": "Ticket PC",
  "/kanban": "Kanban Board",
  "/checklist": "Checklist Setup",
  "/automations": "Automazioni",
  "/scripts": "Script",
  "/clients": "Clienti",
  "/inventory": "Inventario",
  "/docs": "API Docs",
  "/admin": "Admin / Utenti",
  "/profile": "Profilo",
  "/notifications": "Notifiche",
};

function AppLayout() {
  const { session, profile, loading, profileLoading, authError, refreshProfile, signOut } =
    useAuth();
  const navigate = useNavigate();
  const { theme, setTheme, isDark } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const { pendingCount, openCreate } = useTickets();
  const route = useRouterState({ select: (s) => s.location.pathname });
  const [organizationName, setOrganizationName] = useState<string | null>(null);
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
        } catch {}
      })
      .catch(() => {});
  }, [loadSettings, session?.access_token]);
  
  useEffect(() => {
    const titleKey = Object.keys(PAGE_TITLES).find((k) => route.startsWith(k));
    const currentPageTitle = titleKey ? PAGE_TITLES[titleKey] : "PCReady";
    const org = organizationName || "PCReady";
    document.title = currentPageTitle ? `${currentPageTitle} - ${org}` : org;
  }, [route, organizationName]);

  useEffect(() => {
    if (!loading && session && profile && !profile.password_set) {
      navigate({ to: "/auth/set-password", replace: true });
    }
  }, [loading, navigate, profile, session]);

  if (loading || profileLoading || !session) {
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
    return <AuthLoadingScreen message="Reindirizzamento..." />;
  }

  const avc = avatarColors(profile.initials);
  const title = Object.keys(PAGE_TITLES).find((k) => route.startsWith(k));
  const pageTitle = title ? PAGE_TITLES[title] : "PCReady";
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
      navigationGroups={navigationGroups}
      theme={theme}
      isDark={isDark}
      onSetTheme={setTheme}
      onNavigate={() => setMobileNavOpen(false)}
      onSignOut={() => signOut()}
    />
  );

  return (
    <div className="flex min-h-screen">
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
          className="flex flex-col w-[300px] max-w-[86vw] p-0"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          <SheetTitle className="sr-only">Navigazione PCReady</SheetTitle>
          <SheetDescription className="sr-only">Menu principale dell'applicazione</SheetDescription>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* MAIN */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: isMobile ? 0 : 240 }}>
        <header
          className="sticky top-0 z-30 h-14 px-4 md:px-7 flex items-center gap-3 border-b"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {isMobile && (
            <button
              className="pc-btn-icon"
              onClick={() => setMobileNavOpen(true)}
              title="Apri menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <h1
            className="text-[17px] font-bold tracking-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {pageTitle}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <SearchBox />
            <NotificationBell />
            <Link to="/inventory" className="pc-btn pc-btn-ghost pc-btn-sm">
              <Boxes className="w-3 h-3" /> Inventario
            </Link>
            <button onClick={() => openCreate()} className="pc-btn pc-btn-primary pc-btn-sm">
              <Plus className="w-3 h-3" /> Nuovo Ticket
            </button>
          </div>
        </header>
        <main className="flex-1 px-7 py-6 pc-anim-in">
          <Outlet />
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
  navigationGroups,
  theme,
  isDark,
  onSetTheme,
  onNavigate,
  onSignOut,
}: SidebarContentProps) {
  const deploymentLabel = viteDeploymentLabel();

  return (
    <>
      <div
        className="px-[18px] py-[18px] border-b flex items-center gap-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--text)" }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--background)"
            strokeWidth={1.8}
            className="w-4 h-4"
          >
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <path d="M9 11.5h5M11.5 9v5" />
          </svg>
        </div>
        <div>
          <div
            className="text-[16px] font-bold tracking-tight leading-none"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {organizationName || "PCReady"}
          </div>
          <div className="text-[10px] text-text3 mt-0.5" style={{ fontFamily: "var(--font-mono)" }}>
            v{appVersion}
            {deploymentLabel ? ` - ${deploymentLabel}` : null}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-[10px] py-[14px]">
        {navigationGroups.map((group) => (
          <NavSection key={group.id} label={group.label}>
            {group.items.map((item) => (
              <NavLinkItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                active={route.startsWith(item.to)}
                badge={resolveNavigationBadge(item, pendingCount)}
                onClick={onNavigate}
              />
            ))}
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
                  {theme === "light" && "Chiaro"}
                  {theme === "dark" && "Scuro"}
                  {theme === "system" && "Sistema"}
                </span>
              </span>
              <span className="text-[10px] opacity-60">Tema</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[200px]"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <DropdownMenuItem
              onClick={() => onSetTheme("light")}
              className="flex items-center gap-2 cursor-pointer text-[13px]"
              style={{ color: "var(--text2)" }}
            >
              <Sun className="w-4 h-4" />
              <span>Chiaro</span>
              {theme === "light" && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--accent)" }}>✓</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetTheme("dark")}
              className="flex items-center gap-2 cursor-pointer text-[13px]"
              style={{ color: "var(--text2)" }}
            >
              <Moon className="w-4 h-4" />
              <span>Scuro</span>
              {theme === "dark" && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--accent)" }}>✓</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSetTheme("system")}
              className="flex items-center gap-2 cursor-pointer text-[13px]"
              style={{ color: "var(--text2)" }}
            >
              <Monitor className="w-4 h-4" />
              <span>Sistema</span>
              {theme === "system" && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--accent)" }}>✓</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      className="flex items-center gap-[9px] px-[9px] py-[8px] rounded-[7px] text-[13px] font-medium transition-all"
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
        placeholder="Cerca ticket, modello, seriale..."
        className="bg-transparent outline-none text-[13px] w-44"
      />
    </div>
  );
}

function roleLabel(r: string) {
  return r === "admin" ? "Amministratore" : r === "tech" ? "Tecnico" : "Visualizzatore";
}
