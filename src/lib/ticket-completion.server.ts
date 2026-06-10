import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppSettings } from "@/lib/app-settings";
import {
  getEmailTemplateByEvent,
  sendEmailEvent,
} from "@/lib/email-helpers.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import { fmtDate } from "@/lib/pcready";
import {
  generateCompletionPdf,
  type CompletionPdfTemplate,
  type TicketPdfData,
  type TicketChecklistSummary,
} from "./completion-pdf";

// ─── Types ────────────────────────────────────────────────────────────

/** Raw ticket row as fetched from the DB — subset of TicketPdfData before enrichment. */
interface TicketRow {
  id: string;
  ticket_code: string;
  client: string;
  client_id: string | null;
  requester: string;
  end_user?: string | null;
  model: string | null;
  serial?: string | null;
  os?: string | null;
  software?: string | null;
  notes: string | null;
  public_notes?: string | null;
  checklist?: Record<string, Record<string, boolean>> | null;
  checklist_structure?: Record<
    string,
    {
      label?: string;
      items?: Array<{ id: string; text: string; type?: string; required?: boolean }>;
    }
  > | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_at: string;
  device?: {
    model: string;
    serial: string | null;
    os: string | null;
  } | null;
}

interface ClientData {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
}

// ─── Orchestration ────────────────────────────────────────────────────

/**
 * Completes a ticket by:
 * 1. Generating a completion report PDF
 * 2. Uploading it to Supabase Storage
 * 3. Sending email to client with PDF link
 * 4. Notifying admins
 */
export async function completeTicket(params: {
  ticketId: string;
  changedBy: string;
  accessToken?: string;
  template?: CompletionPdfTemplate;
  notifyClient?: boolean;
}): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
  const { ticketId } = params;
  const pdfTemplate: CompletionPdfTemplate = params.template ?? "customer";
  const shouldNotifyClient = params.notifyClient !== false && pdfTemplate === "customer";

  try {
    // Fetch ticket data
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets" as any)
      .select(
        "id, ticket_code, client, client_id, requester, end_user, model, serial, os, software, notes, public_notes, checklist, checklist_structure, status, priority, assignee_id, created_at, device:devices(model, serial, os), assignee:profiles!tickets_assignee_id_fkey(full_name)",
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      console.error("Failed to fetch ticket:", ticketError);
      return { success: false, error: "Ticket not found" };
    }

    const row = ticket as unknown as TicketRow;
    const ticketData: TicketPdfData = {
      ...row,
      completed_at: new Date().toISOString(),
      assignee_name: (ticket as any).assignee?.full_name || "Non assegnato",
    };

    const { data: publicNotes, error: publicNotesError } = await supabaseAdmin
      .from("ticket_notes" as any)
      .select("id, content, created_at, author:profiles(full_name)")
      .eq("ticket_id", ticketData.id)
      .eq("is_internal", false)
      .order("created_at", { ascending: true });
    if (publicNotesError) {
      console.error("Failed to fetch public ticket notes for completion PDF:", publicNotesError);
    }
    ticketData.public_notes_log = ((publicNotes ?? []) as any[]).map((note) => ({
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      author_name: note.author?.full_name ?? null,
    }));

    const [
      { data: statusHistory, error: statusHistoryError },
      { data: timeEntries, error: timeEntriesError },
      { data: checklistInstances, error: checklistInstancesError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ticket_status_history" as any)
        .select("to_status, changed_at")
        .eq("ticket_id", ticketData.id)
        .in("to_status", ["in-progress", "testing", "ready", "completed"])
        .order("changed_at", { ascending: true }),
      supabaseAdmin
        .from("ticket_time_entries" as any)
        .select("duration_minutes, started_at, ended_at")
        .eq("ticket_id", ticketData.id),
      supabaseAdmin
        .from("ticket_checklist_instances" as any)
        .select(
          "id, title, structure, status, completed_at, completion_confirmed, signature_name, responses:ticket_checklist_responses(item_key, value, compiled_at)",
        )
        .eq("ticket_id", ticketData.id)
        .order("created_at", { ascending: true }),
    ]);
    if (statusHistoryError) {
      console.error(
        "Failed to fetch ticket status history for completion PDF:",
        statusHistoryError,
      );
    }
    if (timeEntriesError) {
      console.error("Failed to fetch ticket time entries for completion PDF:", timeEntriesError);
    }
    if (checklistInstancesError) {
      console.error(
        "Failed to fetch ticket checklist instances for completion PDF:",
        checklistInstancesError,
      );
    }
    ticketData.status_history = ((statusHistory ?? []) as any[]).map((entry) => ({
      to_status: entry.to_status,
      changed_at: entry.changed_at,
    }));
    ticketData.taken_in_charge_at = ticketData.status_history[0]?.changed_at ?? null;
    ticketData.total_work_minutes = ((timeEntries ?? []) as any[]).reduce((sum, entry) => {
      if (typeof entry.duration_minutes === "number") return sum + entry.duration_minutes;
      if (entry.started_at && entry.ended_at) {
        return (
          sum +
          Math.max(
            0,
            Math.round(
              (new Date(entry.ended_at).getTime() - new Date(entry.started_at).getTime()) / 60000,
            ),
          )
        );
      }
      return sum;
    }, 0);
    ticketData.checklist_summaries = buildChecklistSummaries(
      (checklistInstances ?? []) as any[],
      ticketData.checklist,
      ticketData.checklist_structure,
    );

    // Fetch client data for email
    let clientData: ClientData | null = null;
    if (ticketData.client_id) {
      const { data: client } = await supabaseAdmin
        .from("clients" as any)
        .select("id, name, company_name, email")
        .eq("id", ticketData.client_id)
        .maybeSingle();
      if (client) {
        clientData = client as unknown as ClientData;
      }
    }

    // Get app settings for email template variables
    let orgName = "PCReady";
    let supportEmail = "support@pcready.it";
    const portalUrl = process.env.PORTAL_URL || "https://app.pcready.it/portal";

    if (params.accessToken) {
      try {
        const settings = await getAppSettings({ data: { accessToken: params.accessToken } });
        orgName = settings.organization_name || orgName;
        supportEmail = settings.support_email || supportEmail;
      } catch {
        // Use defaults
      }
    }

    // Generate PDF buffer via the extracted deep module
    const pdfBuffer = await generateCompletionPdf(ticketData, pdfTemplate);

    // Upload to Supabase Storage
    const pdfPath = `completions/${ticketData.ticket_code}-${pdfTemplate}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("ticket-documents")
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload PDF:", uploadError);
      return { success: false, error: "Failed to upload PDF" };
    }

    // Create signed URL (valid for 30 days)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from("ticket-documents")
      .createSignedUrl(pdfPath, 60 * 60 * 24 * 30); // 30 days

    if (signedUrlError) {
      console.error("Failed to create signed URL:", signedUrlError);
      return { success: false, error: "Failed to create download link" };
    }

    const pdfUrl = signedUrlData?.signedUrl || "";

    const emailTemplate = await getEmailTemplateByEvent("ticket_completed");

    // Send email to client if we have an email
    const clientEmail = clientData?.email;
    if (shouldNotifyClient && clientEmail && emailTemplate && clientData) {
      const completedDate = fmtDate(ticketData.completed_at);

      const templateVars: Record<string, string> = {
        "{{organization_name}}": orgName,
        "{{support_email}}": supportEmail,
        "{{user_name}}": clientData.name || ticketData.client,
        "{{user_email}}": clientEmail || "",
        "{{ticket_code}}": ticketData.ticket_code,
        "{{ticket_title}}": ticketData.model || ticketData.notes || "Ticket assistenza",
        "{{client_name}}": clientData.company_name || clientData.name || ticketData.client,
        "{{assignee_name}}": ticketData.assignee_name || "Non assegnato",
        "{{completed_date}}": completedDate,
        "{{pdf_link}}": pdfUrl,
        "{{portal_link}}": portalUrl,
      };

      void sendEmailEvent({
        eventType: "ticket_completed",
        to: clientEmail,
        variables: templateVars,
      }).catch((err) => {
        console.error("Failed to send ticket completed email:", err);
      });
    }

    // Notify admins
    await createNotificationForAdmins({
      type: "ticket_completed",
      title: `Ticket ${ticketData.ticket_code} completato`,
      body: `${ticketData.client} - ${ticketData.model || "Ticket assistenza"}`,
      payload: {
        ticketId: ticketData.id,
        ticketCode: ticketData.ticket_code,
        clientId: ticketData.client_id,
        pdfUrl,
      },
      link: "/tickets",
    });

    return { success: true, pdfUrl };
  } catch (error) {
    console.error("Error completing ticket:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ─── Checklist Helpers ────────────────────────────────────────────────

function buildChecklistSummaries(
  instances: any[],
  legacyState?: TicketRow["checklist"],
  legacyStructure?: TicketRow["checklist_structure"],
): TicketChecklistSummary[] {
  const summaries = instances.map((instance) => buildChecklistSummaryFromInstance(instance));
  if (summaries.length) return summaries;
  const legacy = buildLegacyChecklistSummary(legacyState, legacyStructure);
  return legacy ? [legacy] : [];
}

function buildChecklistSummaryFromInstance(instance: any): TicketChecklistSummary {
  const structure = normalizeChecklistStructure(instance.structure);
  const responses = new Map<string, string | null>(
    ((instance.responses ?? instance.ticket_checklist_responses ?? []) as any[]).map(
      (response) => [response.item_key, response.value ?? null],
    ),
  );
  let done = 0;
  let total = 0;
  let requiredMissing = 0;
  const sections = Object.entries(structure).map(([sectionKey, section]) => {
    let sectionDone = 0;
    const completedItems: string[] = [];
    const missingItems: string[] = [];
    const items = Array.isArray(section.items) ? section.items : [];
    items.forEach((item) => {
      total += 1;
      const value = responses.get(`${sectionKey}:${item.id}`);
      const completed = isChecklistItemComplete(item, value);
      if (completed) {
        done += 1;
        sectionDone += 1;
        completedItems.push(formatChecklistItemResult(item, value));
      } else if (item.required) {
        requiredMissing += 1;
        missingItems.push(item.text || item.id);
      }
    });
    return {
      title: section.label || humanizeValue(sectionKey),
      done: sectionDone,
      total: items.length,
      requiredMissing: missingItems,
      completedItems,
    };
  });

  return {
    id: instance.id,
    title: instance.title || "Checklist operativa",
    status: instance.status || "pending",
    done,
    total,
    requiredMissing,
    completed_at: instance.completed_at ?? null,
    completion_confirmed: Boolean(instance.completion_confirmed),
    signature_name: instance.signature_name ?? null,
    sections,
  };
}

function buildLegacyChecklistSummary(
  state?: TicketRow["checklist"],
  structure?: TicketRow["checklist_structure"],
): TicketChecklistSummary | null {
  const normalizedStructure = normalizeChecklistStructure(structure);
  if (!Object.keys(normalizedStructure).length) return null;
  let done = 0;
  let total = 0;
  let requiredMissing = 0;
  const sections = Object.entries(normalizedStructure).map(([sectionKey, section]) => {
    const items = Array.isArray(section.items) ? section.items : [];
    let sectionDone = 0;
    const completedItems: string[] = [];
    const missingItems: string[] = [];
    items.forEach((item) => {
      total += 1;
      const completed = Boolean(state?.[sectionKey]?.[item.id]);
      if (completed) {
        done += 1;
        sectionDone += 1;
        completedItems.push(item.text || item.id);
      } else if (item.required) {
        requiredMissing += 1;
        missingItems.push(item.text || item.id);
      }
    });
    return {
      title: section.label || humanizeValue(sectionKey),
      done: sectionDone,
      total: items.length,
      requiredMissing: missingItems,
      completedItems,
    };
  });
  if (!total) return null;
  return {
    id: "legacy-checklist",
    title: "Checklist operativa ticket",
    status: done === total ? "completed" : done > 0 ? "in_progress" : "pending",
    done,
    total,
    requiredMissing,
    completed_at: null,
    completion_confirmed: done === total && requiredMissing === 0,
    signature_name: null,
    sections,
  };
}

function normalizeChecklistStructure(
  raw: unknown,
): Record<
  string,
  { label?: string; items: Array<{ id: string; text: string; type?: string; required?: boolean }> }
> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<
    string,
    {
      label?: string;
      items: Array<{ id: string; text: string; type?: string; required?: boolean }>;
    }
  >;
}

function isChecklistItemComplete(
  item: { type?: string; required?: boolean },
  value?: string | null,
) {
  const itemType = item.type || "checkbox";
  if (itemType === "checkbox") return value === "checked" || value === "true";
  return Boolean(value?.trim());
}

function formatChecklistItemResult(
  item: { id: string; text: string; type?: string },
  value?: string | null,
) {
  if (!value || item.type === "checkbox" || !item.type) return item.text || item.id;
  return `${item.text || item.id}: ${value}`;
}

function humanizeValue(value?: string | null) {
  const normalized = String(value ?? "")
    .replace(
      /\u00C2\u00B7|\u00E2\u20AC\u201C|\u00E2\u20AC\u201D|\u00E2\u20AC\u00A2/g,
      "-",
    )
    .replace(/\u00EF\u00BC\u0161/g, ":")
    .replace(/\xA0/g, " ")
    .trim();
  if (!normalized || normalized === "-" || normalized.toLowerCase() === "n/d")
    return "Non disponibile";
  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

// ─── Signed URL ───────────────────────────────────────────────────────

/**
 * Gets the signed URL for a completion PDF.
 */
export async function getCompletionPdfUrl(ticketId: string): Promise<string | null> {
  // Find the PDF file in storage
  const { data: files, error } = await supabaseAdmin.storage
    .from("ticket-documents")
    .list("completions", {
      limit: 100,
      search: ticketId,
    });

  if (error || !files || files.length === 0) {
    return null;
  }

  // Get the most recent file
  const sortedFiles = files.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );
  const latestFile = sortedFiles[0];

  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
    .from("ticket-documents")
    .createSignedUrl(`completions/${latestFile.name}`, 60 * 60 * 24); // 24 hours

  if (signedUrlError) {
    console.error("Failed to create signed URL:", signedUrlError);
    return null;
  }

  return signedUrlData?.signedUrl || null;
}
