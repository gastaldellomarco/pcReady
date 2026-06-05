import { createPortalFn, PortalTokenSchema } from "@/lib/portal-shared";
import { z } from "zod";

const TICKET_MODULE = "@/lib/portal-tickets.server";
const DEVICE_MODULE = "@/lib/portal-devices.server";
const DOCUMENT_MODULE = "@/lib/portal-documents.server";

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

export const getPortalDashboard = createPortalFn(PortalTokenSchema, TICKET_MODULE, "getPortalDashboardServer");
export const listPortalTickets = createPortalFn(PortalTicketListSchema, TICKET_MODULE, "listPortalTicketsServer");
export const getPortalTicketDetail = createPortalFn(PortalTicketDetailSchema, TICKET_MODULE, "getPortalTicketDetailServer");
export const createPortalTicket = createPortalFn(NewPortalTicketSchema, TICKET_MODULE, "createPortalTicketServer");
export const submitPortalTicketFeedback = createPortalFn(PortalTicketFeedbackSchema, TICKET_MODULE, "submitPortalTicketFeedbackServer");
export const getPortalProfileOverview = createPortalFn(PortalTokenSchema, TICKET_MODULE, "getPortalProfileOverviewServer");
export const getPortalTicketCategories = createPortalFn(PortalTokenSchema, TICKET_MODULE, "getPortalTicketCategoriesServer");

export const listPortalDevices = createPortalFn(PortalTokenSchema, DEVICE_MODULE, "listPortalDevicesServer");

export const listPortalDocuments = createPortalFn(PortalTokenSchema, DOCUMENT_MODULE, "listPortalDocumentsServer");
export const signPortalDocument = createPortalFn(PortalDocumentSignSchema, DOCUMENT_MODULE, "signPortalDocumentServer");
