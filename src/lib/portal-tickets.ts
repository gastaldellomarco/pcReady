import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PortalTokenSchema } from "@/lib/portal-shared";

const PortalTicketListSchema = z.object({
  token: z.string().min(32),
  status: z.enum(["all", "open", "in-progress", "completed"]).optional(),
  q: z.string().max(120).optional(),
  sortBy: z.enum(["created_at", "status", "priority"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  deviceId: z.string().uuid().nullable().optional(),
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

const PortalTicketFeedbackSchema = z.object({
  token: z.string().min(32),
  ticketId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
});

const PortalDocumentSignSchema = z.object({
  token: z.string().min(32),
  documentId: z.string().min(1),
  signatureDataUrl: z.string().min(1),
});

export const getPortalDashboard = createServerFn({ method: "POST" })
  .validator(PortalTokenSchema)
  .handler(async ({ data }) => {
    const { getPortalDashboardServer } = await import("@/lib/portal-tickets.server");
    return getPortalDashboardServer(data);
  });

export const listPortalTickets = createServerFn({ method: "POST" })
  .validator(PortalTicketListSchema)
  .handler(async ({ data }) => {
    const { listPortalTicketsServer } = await import("@/lib/portal-tickets.server");
    return listPortalTicketsServer(data);
  });

export const getPortalTicketDetail = createServerFn({ method: "POST" })
  .validator(PortalTicketDetailSchema)
  .handler(async ({ data }) => {
    const { getPortalTicketDetailServer } = await import("@/lib/portal-tickets.server");
    return getPortalTicketDetailServer(data);
  });

export const createPortalTicket = createServerFn({ method: "POST" })
  .validator(NewPortalTicketSchema)
  .handler(async ({ data }) => {
    const { createPortalTicketServer } = await import("@/lib/portal-tickets.server");
    return createPortalTicketServer(data);
  });

export const submitPortalTicketFeedback = createServerFn({ method: "POST" })
  .validator(PortalTicketFeedbackSchema)
  .handler(async ({ data }) => {
    const { submitPortalTicketFeedbackServer } = await import("@/lib/portal-tickets.server");
    return submitPortalTicketFeedbackServer(data);
  });

export const getPortalProfileOverview = createServerFn({ method: "POST" })
  .validator(PortalTokenSchema)
  .handler(async ({ data }) => {
    const { getPortalProfileOverviewServer } = await import("@/lib/portal-tickets.server");
    return getPortalProfileOverviewServer(data);
  });

export const getPortalTicketCategories = createServerFn({ method: "POST" })
  .validator(PortalTokenSchema)
  .handler(async ({ data }) => {
    const { getPortalTicketCategoriesServer } = await import("@/lib/portal-tickets.server");
    return getPortalTicketCategoriesServer(data);
  });

export const listPortalDevices = createServerFn({ method: "POST" })
  .validator(PortalTokenSchema)
  .handler(async ({ data }) => {
    const { listPortalDevicesServer } = await import("@/lib/portal-devices.server");
    return listPortalDevicesServer(data);
  });

export const listPortalDocuments = createServerFn({ method: "POST" })
  .validator(PortalTokenSchema)
  .handler(async ({ data }) => {
    const { listPortalDocumentsServer } = await import("@/lib/portal-documents.server");
    return listPortalDocumentsServer(data);
  });

export const signPortalDocument = createServerFn({ method: "POST" })
  .validator(PortalDocumentSignSchema)
  .handler(async ({ data }) => {
    const { signPortalDocumentServer } = await import("@/lib/portal-documents.server");
    return signPortalDocumentServer(data);
  });
