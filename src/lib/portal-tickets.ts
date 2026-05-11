import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PortalTokenSchema = z.object({ token: z.string().min(32) });

const NewPortalTicketSchema = z.object({
  token: z.string().min(32),
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(5000),
  category: z.string().min(1).max(80),
  urgency: z.enum(["low", "normal", "high"]),
});

const PortalTicketDetailSchema = z.object({
  token: z.string().min(32),
  ticketId: z.string().uuid(),
});

export const getPortalDashboard = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { getPortalDashboardServer } = await import("@/lib/portal-tickets.server");
    return getPortalDashboardServer(PortalTokenSchema.parse(data));
  });

export const listPortalTickets = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { listPortalTicketsServer } = await import("@/lib/portal-tickets.server");
    return listPortalTicketsServer(PortalTokenSchema.parse(data));
  });

export const getPortalTicketDetail = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTicketDetailSchema>) => data)
  .handler(async ({ data }) => {
    const { getPortalTicketDetailServer } = await import("@/lib/portal-tickets.server");
    return getPortalTicketDetailServer(PortalTicketDetailSchema.parse(data));
  });

export const createPortalTicket = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof NewPortalTicketSchema>) => data)
  .handler(async ({ data }) => {
    const { createPortalTicketServer } = await import("@/lib/portal-tickets.server");
    return createPortalTicketServer(NewPortalTicketSchema.parse(data));
  });

export const getPortalTicketCategories = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { getPortalTicketCategoriesServer } = await import("@/lib/portal-tickets.server");
    return getPortalTicketCategoriesServer(PortalTokenSchema.parse(data));
  });