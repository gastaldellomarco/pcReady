import type { DashboardTicketRow } from "@/lib/queries/dashboard";

/**
 *
 */
export function dashboardDeviceLabel(ticket: DashboardTicketRow) {
  return ticket.device?.model || "Nessun asset";
}
