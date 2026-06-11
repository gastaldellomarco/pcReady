// ─── Barrel: portal ticket server functions ────────────────────────────
//
// Domain split:
//   portal-tickets-helpers.server.ts    – shared statusLabel helper
//   portal-tickets-dashboard.server.ts  – getPortalDashboardServer
//   portal-tickets-operations.server.ts – list/get/create ticket + attachments
//   portal-tickets-profile.server.ts    – feedback, profile overview, categories
//

export { statusLabel } from "@/lib/portal-tickets-helpers.server";
export { getPortalDashboardServer } from "@/lib/portal-tickets-dashboard.server";
export {
  listPortalTicketsServer,
  getPortalTicketDetailServer,
  createPortalTicketServer,
} from "@/lib/portal-tickets-operations.server";
export {
  submitPortalTicketFeedbackServer,
  getPortalProfileOverviewServer,
  getPortalTicketCategoriesServer,
} from "@/lib/portal-tickets-profile.server";
