import {
  LayoutGrid,
  Ticket,
  Trello,
  ListChecks,
  Zap,
  Boxes,
  Building2,
  UserRound,
  Euro,
  Package,
  BookOpenText,
  Users,
  Terminal,
  CalendarDays,
  Wrench,
} from "lucide-react";
import i18n from "@/i18n";
import type { AuthProfile } from "@/lib/auth-context";
import type { LucideIcon } from "lucide-react";

/**
 *
 */
export type NavigationRole = AuthProfile["role"];
/**
 *
 */
export type NavigationVisibility = "all" | "desktop" | "mobile";
/**
 *
 */
export type NavigationBadge = "pendingTickets";
/**
 *
 */
export type NavigationFeatureFlag = string;

/**
 *
 */
export interface NavigationItem {
  to: string;
  label: string;
  title?: string;
  icon: LucideIcon;
  badge?: NavigationBadge;
  requiredRoles?: readonly NavigationRole[];
  visibility?: NavigationVisibility;
  featureFlag?: NavigationFeatureFlag;
}

/**
 *
 */
export interface NavigationGroup {
  id: string;
  label: string;
  items: readonly NavigationItem[];
}

/**
 *
 */
export type NavPath = string;

/**
 *
 */
export interface ResolvedNavigationGroup extends NavigationGroup {
  items: readonly NavigationItem[];
}

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
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
      { to: "/warehouse", label: "Magazzino", icon: Wrench, requiredRoles: ["admin", "tech"] },
      { to: "/docs", label: "Knowledge Base", icon: BookOpenText, requiredRoles: ["admin", "tech"] },
      { to: "/admin", label: "Admin / Utenti", icon: Users, requiredRoles: ["admin"] },
    ],
  },
] as const;

export const PAGE_TITLE_KEYS: Record<string, string> = {
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
  "/warehouse": "pageTitle.warehouse",
  "/docs": "pageTitle.docs",
  "/admin": "pageTitle.admin",
  "/profile": "pageTitle.profile",
  "/notifications": "pageTitle.notifications",
  "/calendar": "pageTitle.calendar",
};

export const PAGE_TITLE_FALLBACKS: Record<string, string> = {
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
  "/warehouse": "Magazzino",
  "/docs": "Knowledge Base",
  "/admin": "Admin / Utenti",
  "/profile": "Profilo",
  "/notifications": "Notifiche",
  "/calendar": "Calendario",
};

/**
 *
 */
export function resolveNavigationGroups({
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

/**
 *
 */
export function resolveNavigationBadge(
  item: NavigationItem,
  pendingCount: number,
): number | undefined {
  if (item.badge === "pendingTickets") return pendingCount;
  return undefined;
}

/**
 *
 */
export function roleLabel(r: string): string {
  return r === "admin"
    ? i18n.t("common:role.admin", "Amministratore")
    : r === "tech"
      ? i18n.t("common:role.tech", "Tecnico")
      : i18n.t("common:role.viewer", "Visualizzatore");
}
