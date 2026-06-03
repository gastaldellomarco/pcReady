import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Sun,
  Moon,
  Monitor,
  Languages,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppLogo } from "@/components/brand/AppLogo";
import { UserMenu } from "@/components/layout/UserMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import i18n from "@/i18n";
import { appVersion, viteDeploymentLabel } from "@/lib/app-version-display";
import { useAuth } from "@/lib/auth-context";
import { resolveNavigationBadge, roleLabel } from "@/lib/navigation";
import { updateMyProfile } from "@/lib/user-profile";
import type { AuthProfile } from "@/lib/auth-context";
import type {
  ResolvedNavigationGroup,
} from "@/lib/navigation";

/* ── Sub-components ─────────────────────────────────────────── */

interface NavSectionProps {
  label: string;
  children: React.ReactNode;
}

function NavSection({ label, children }: NavSectionProps) {
  return (
    <div className="mb-[22px]">
      <div className="sb-text text-[9.5px] font-bold tracking-[1px] uppercase text-text3 px-2 mb-[5px]">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

interface NavLinkItemProps {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  badge?: number;
  onClick?: () => void;
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

/* ── Language selector ───────────────────────────────────────── */

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
            <Languages className="size-3" />
            <span>
              {currentLang === "it"
                ? t("language.italian", "Italiano")
                : t("language.english", "English")}
            </span>
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

/* ── Sidebar component ──────────────────────────────────────── */

/**
 *
 */
export interface SidebarProps {
  profile: AuthProfile;
  avatarColor: { bg: string; fg: string };
  route: string;
  pendingCount: number;
  adminErrorCount: number;
  navigationGroups: readonly ResolvedNavigationGroup[];
  onNavigate: () => void;
  onSignOut: () => void;
}

/**
 *
 */
export function Sidebar({
  profile,
  avatarColor,
  route,
  pendingCount,
  adminErrorCount,
  navigationGroups,
  onNavigate,
  onSignOut,
}: SidebarProps) {
  const { t } = useTranslation("common");
  const { theme, setTheme } = useTheme();
  const deploymentLabel = viteDeploymentLabel();

  return (
    <>
      {/* Logo + version */}
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-[10px] py-[14px]">
        {navigationGroups.map((group) => (
          <NavSection key={group.id} label={group.label}>
            {group.items.map((item) => {
              const itemBadge =
                item.to === "/admin"
                  ? adminErrorCount
                  : resolveNavigationBadge(item, pendingCount);
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

      {/* Footer: theme, language, user */}
      <div
        className="px-[14px] py-[13px] border-t flex flex-col gap-[10px]"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Theme switcher */}
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
                {theme === "light" && <Sun className="size-3" />}
                {theme === "dark" && <Moon className="size-3" />}
                {theme === "system" && <Monitor className="size-3" />}
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
              onClick={() => setTheme("light")}
              className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
            >
              <Sun className="size-4" />
              <span>{t("sidebar.light", "Chiaro")}</span>
              {theme === "light" && (
                <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("dark")}
              className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
            >
              <Moon className="size-4" />
              <span>{t("sidebar.dark", "Scuro")}</span>
              {theme === "dark" && (
                <span className="ml-auto text-[10px] text-primary group-focus:text-primary-foreground">
                  ✓
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme("system")}
              className="group flex items-center gap-2 cursor-pointer text-[13px] text-text2 focus:bg-primary focus:text-primary-foreground"
            >
              <Monitor className="size-4" />
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
