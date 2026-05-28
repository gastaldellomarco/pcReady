import i18n from "@/i18n";
import type { AppRole } from "@/lib/auth-context";

/**
 * Maps each role to its default visible widgets.
 *
 * Widgets not in a role's set are hidden by default but can be enabled
 * by the user via the widget settings panel.
 */
const ROLE_DEFAULT_VISIBLE: Record<AppRole, ReadonlySet<WidgetId>> = {
  admin: new Set([
    "stat-cards",
    "analytics-card",
    "devices-without-ticket",
    "tickets-without-device",
    "trend-chart",
    "recent-tickets",
    "status-distribution",
    "technician-heatmap",
    "recent-activity",
    "overdue-tickets",
    "team-activity",
    "technician-stats",
    "critical-events",
    "warranty-overview",
    "maintenance-overview",
    "kanban-wip-limits",
  ]),
  tech: new Set([
    "stat-cards",
    "analytics-card",
    "devices-without-ticket",
    "recent-tickets",
    "status-distribution",
    "technician-heatmap",
    "recent-activity",
    "overdue-tickets",
    "team-activity",
    "technician-stats",
    "warranty-overview",
    "maintenance-overview",
    "kanban-wip-limits",
  ]),
  viewer: new Set([
    "stat-cards",
    "analytics-card",
    "trend-chart",
    "recent-tickets",
    "status-distribution",
    "warranty-overview",
  ]),
};

/**
 *
 */
export type WidgetId =
  | "stat-cards"
  | "analytics-card"
  | "devices-without-ticket"
  | "tickets-without-device"
  | "trend-chart"
  | "recent-tickets"
  | "status-distribution"
  | "technician-heatmap"
  | "recent-activity"
  | "overdue-tickets"
  | "team-activity"
  | "technician-stats"
  | "critical-events"
  | "warranty-overview"
  | "maintenance-overview"
  | "kanban-wip-limits";

/**
 *
 */
export interface WidgetEntry {
  id: WidgetId;
  label: string;
  description: string;
}

/**
 *
 */
export interface WidgetLayoutItem {
  id: WidgetId;
  order: number;
  visible: boolean;
}

/**
 *
 */
export interface DashboardLayout {
  widgets: WidgetLayoutItem[];
}

export const DASHBOARD_WIDGETS: WidgetEntry[] = [
  {
    id: "stat-cards",
    label: i18n.t("dashboard:widgets.stat-cards.label", "Statistiche principali"),
    description: i18n.t("dashboard:widgets.stat-cards.desc", "Ticket totali, dispositivi, clienti attivi e stati"),
  },
  {
    id: "analytics-card",
    label: i18n.t("dashboard:widgets.analytics-card.label", "Report Mensile"),
    description: i18n.t("dashboard:widgets.analytics-card.desc", "Andamento mensile ticket e performance tecnici"),
  },
  {
    id: "devices-without-ticket",
    label: i18n.t("dashboard:widgets.devices-without-ticket.label", "Dispositivi senza ticket"),
    description: i18n.t("dashboard:widgets.devices-without-ticket.desc", "Dispositivi senza ticket attivo"),
  },
  {
    id: "tickets-without-device",
    label: i18n.t("dashboard:widgets.tickets-without-device.label", "Ticket senza dispositivo"),
    description: i18n.t("dashboard:widgets.tickets-without-device.desc", "Ticket senza dispositivo associato"),
  },
  {
    id: "trend-chart",
    label: i18n.t("dashboard:widgets.trend-chart.label", "Trend ticket e asset"),
    description: i18n.t("dashboard:widgets.trend-chart.desc", "Andamento ticket aperti vs asset disponibili"),
  },
  {
    id: "recent-tickets",
    label: i18n.t("dashboard:widgets.recent-tickets.label", "Ticket recenti"),
    description: i18n.t("dashboard:widgets.recent-tickets.desc", "Elenco degli ultimi ticket creati"),
  },
  {
    id: "status-distribution",
    label: i18n.t("dashboard:widgets.status-distribution.label", "Distribuzione stati"),
    description: i18n.t("dashboard:widgets.status-distribution.desc", "Grafico a ciambella della distribuzione stati"),
  },
  {
    id: "technician-heatmap",
    label: i18n.t("dashboard:widgets.technician-heatmap.label", "Calore tecnici"),
    description: i18n.t("dashboard:widgets.technician-heatmap.desc", "Mappa di calore chiusure settimanali per tecnico"),
  },
  { id: "recent-activity", label: i18n.t("dashboard:widgets.recent-activity.label", "Attivita recente"), description: i18n.t("dashboard:widgets.recent-activity.desc", "Log delle attivita recenti") },
  {
    id: "overdue-tickets",
    label: i18n.t("dashboard:widgets.overdue-tickets.label", "Ticket scaduti / SLA"),
    description: i18n.t("dashboard:widgets.overdue-tickets.desc", "Ticket oltre la soglia SLA"),
  },
  { id: "team-activity", label: i18n.t("dashboard:widgets.team-activity.label", "Attivita del team"), description: i18n.t("dashboard:widgets.team-activity.desc", "Breakdown per tecnico") },
  {
    id: "technician-stats",
    label: i18n.t("dashboard:widgets.technician-stats.label", "Statistiche tecnici"),
    description: i18n.t("dashboard:widgets.technician-stats.desc", "Statistiche complete dei tecnici"),
  },
  { id: "critical-events", label: i18n.t("dashboard:widgets.critical-events.label", "Eventi critici"), description: i18n.t("dashboard:widgets.critical-events.desc", "Eventi critici recenti") },
  { id: "warranty-overview", label: i18n.t("dashboard:widgets.warranty-overview.label", "Garanzie"), description: i18n.t("dashboard:widgets.warranty-overview.desc", "Stati garanzia e scadenze prossime") },
  {
    id: "maintenance-overview",
    label: i18n.t("dashboard:widgets.maintenance-overview.label", "Manutenzioni"),
    description: i18n.t("dashboard:widgets.maintenance-overview.desc", "Prossimi interventi e manutenzioni scadute"),
  },
  {
    id: "kanban-wip-limits",
    label: i18n.t("dashboard:widgets.kanban-wip-limits.label", "Limiti WIP Kanban"),
    description: i18n.t("dashboard:widgets.kanban-wip-limits.desc", "Ticket per colonna e limiti WIP configurati"),
  },
];

/**
 * Creates a default dashboard layout for the given role.
 *
 * @param role - The user's role (admin, tech, or viewer)
 * @returns A {@link DashboardLayout} with widgets visible/hidden based on role defaults
 */
export function createDefaultLayoutForRole(role: AppRole): DashboardLayout {
  const visibleSet = ROLE_DEFAULT_VISIBLE[role];
  return {
    widgets: DASHBOARD_WIDGETS.map((w, i) => ({
      id: w.id,
      order: i,
      visible: visibleSet.has(w.id),
    })),
  };
}


