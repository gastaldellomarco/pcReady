import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PortalTokenSchema = z.object({ token: z.string().min(32) });

const PortalTicketListSchema = z.object({
  token: z.string().min(32),
  status: z.enum(["all", "open", "in-progress", "completed"]).optional(),
  q: z.string().max(120).optional(),
  sortBy: z.enum(["created_at", "status", "priority"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const NewPortalTicketSchema = z.object({
  token: z.string().min(32),
  title: z.string().min(3).max(160),
  description: z.string().min(5).max(5000),
  category: z.string().min(1).max(80),
  urgency: z.enum(["low", "normal", "high", "urgent"]),
  requestType: z.enum(["technical_issue", "request", "device_fault"]),
  deviceId: z.string().uuid().nullable().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().min(1).max(200),
        mimeType: z.string().max(120).optional(),
        dataUrl: z.string().min(1),
      }),
    )
    .max(3)
    .optional(),
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
  .inputValidator((data: z.input<typeof PortalTicketListSchema>) => data)
  .handler(async ({ data }) => {
    const { listPortalTicketsServer } = await import("@/lib/portal-tickets.server");
    return listPortalTicketsServer(PortalTicketListSchema.parse(data));
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

export const listPortalDevices = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { listPortalDevicesServer } = await import("@/lib/portal-tickets.server");
    return listPortalDevicesServer(PortalTokenSchema.parse(data));
  });

export const submitPortalTicketFeedback = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { token: string; ticketId: string; rating: number; comment?: string | null }) => data,
  )
  .handler(async ({ data }) => {
    const { submitPortalTicketFeedbackServer } = await import("@/lib/portal-tickets.server");
    return submitPortalTicketFeedbackServer(
      z
        .object({
          token: z.string().min(32),
          ticketId: z.string().uuid(),
          rating: z.number().int().min(1).max(5),
          comment: z.string().max(2000).nullable().optional(),
        })
        .parse(data),
    );
  });

export const getPortalTicketCategories = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof PortalTokenSchema>) => data)
  .handler(async ({ data }) => {
    const { getPortalTicketCategoriesServer } = await import("@/lib/portal-tickets.server");
    return getPortalTicketCategoriesServer(PortalTokenSchema.parse(data));
  });
