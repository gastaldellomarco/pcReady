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
  | "warranty-overview";

export interface WidgetEntry {
  id: WidgetId;
  label: string;
  description: string;
}

export interface WidgetLayoutItem {
  id: WidgetId;
  order: number;
  visible: boolean;
}

export interface DashboardLayout {
  widgets: WidgetLayoutItem[];
}

export const DASHBOARD_WIDGETS: WidgetEntry[] = [
  {
    id: "stat-cards",
    label: "Statistiche principali",
    description: "Ticket totali, dispositivi, clienti attivi e stati",
  },
  {
    id: "analytics-card",
    label: "Report Mensile",
    description: "Andamento mensile ticket e performance tecnici",
  },
  {
    id: "devices-without-ticket",
    label: "Dispositivi senza ticket",
    description: "Dispositivi senza ticket attivo",
  },
  {
    id: "tickets-without-device",
    label: "Ticket senza dispositivo",
    description: "Ticket senza dispositivo associato",
  },
  {
    id: "trend-chart",
    label: "Trend ticket e asset",
    description: "Andamento ticket aperti vs asset disponibili",
  },
  {
    id: "recent-tickets",
    label: "Ticket recenti",
    description: "Elenco degli ultimi ticket creati",
  },
  {
    id: "status-distribution",
    label: "Distribuzione stati",
    description: "Grafico a ciambella della distribuzione stati",
  },
  {
    id: "technician-heatmap",
    label: "Calore tecnici",
    description: "Mappa di calore chiusure settimanali per tecnico",
  },
  { id: "recent-activity", label: "Attivita recente", description: "Log delle attivita recenti" },
  {
    id: "overdue-tickets",
    label: "Ticket scaduti / SLA",
    description: "Ticket oltre la soglia SLA",
  },
  { id: "team-activity", label: "Attivita del team", description: "Breakdown per tecnico" },
  {
    id: "technician-stats",
    label: "Statistiche tecnici",
    description: "Statistiche complete dei tecnici",
  },
  { id: "critical-events", label: "Eventi critici", description: "Eventi critici recenti" },
  { id: "warranty-overview", label: "Garanzie", description: "Stati garanzia e scadenze prossime" },
];

export function createDefaultLayout(): DashboardLayout {
  return {
    widgets: DASHBOARD_WIDGETS.map((w, i) => ({
      id: w.id,
      order: i,
      visible: w.id !== "technician-stats", // technician-stats hidden by default
    })),
  };
}
