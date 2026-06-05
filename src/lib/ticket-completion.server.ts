import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppSettings } from "@/lib/app-settings";
import { getEmailTemplateByEvent, sendEmailEvent } from "@/lib/email-helpers.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import { STATUS_META, fmtDate } from "@/lib/pcready";

type CompletionPdfTemplate = "customer" | "technical";

interface TicketData {
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
  assignee_name: string | null;
  created_at: string;
  completed_at: string;
  taken_in_charge_at?: string | null;
  total_work_minutes?: number;
  device?: {
    model: string;
    serial: string | null;
    os: string | null;
  } | null;
  public_notes_log?: TicketPublicNote[];
  checklist_summaries?: TicketChecklistSummary[];
  status_history?: Array<{ to_status: string; changed_at: string }>;
}

interface TicketChecklistSummary {
  id: string;
  title: string;
  status: string;
  done: number;
  total: number;
  requiredMissing: number;
  completed_at: string | null;
  completion_confirmed: boolean;
  signature_name: string | null;
  sections: Array<{
    title: string;
    done: number;
    total: number;
    requiredMissing: string[];
    completedItems: string[];
  }>;
}

interface TicketPublicNote {
  id: string;
  content: string;
  created_at: string;
  author_name: string | null;
}

type PDFKitDocument = any;

interface ClientData {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
}

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

    const ticketData = ticket as unknown as TicketData;
    ticketData.completed_at = new Date().toISOString();
    ticketData.assignee_name = (ticket as any).assignee?.full_name || "Non assegnato";

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

    // Generate PDF buffer
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

/**
 * Generates a professional PDF buffer for the ticket completion report.
 */
async function generateCompletionPdf(
  ticket: TicketData,
  template: CompletionPdfTemplate = "customer",
): Promise<Buffer> {
  try {
    const pdfkitModule = (await import("pdfkit").catch(() => null)) as unknown as {
      default: new (options?: Record<string, unknown>) => PDFKitDocument;
    } | null;
    if (!pdfkitModule) {
      throw new Error("pdfkit not available - install with: npm install pdfkit");
    }

    const PDFDocument = pdfkitModule.default;
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 64, left: 46, right: 46 },
      bufferPages: true,
      info: {
        Title: `Verbale completamento ${ticket.ticket_code}`,
        Author: "PCReady",
        Subject: "Verbale di completamento ticket",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const marginX = 46;
    const contentWidth = pageWidth - marginX * 2;
    const brand = {
      blue: "#1B4FD8",
      navy: "#0F172A",
      cyan: "#0EA5E9",
      slate: "#475569",
      muted: "#64748B",
      border: "#DDE5F2",
      soft: "#F5F8FF",
      panel: "#F8FAFC",
      success: "#0F9F6E",
      warning: "#D97706",
    };

    const isTechnicalTemplate = template === "technical";
    const templateLabel = isTechnicalTemplate ? "Report tecnico interno" : "Verbale cliente";
    const statusLabel = ticketStatusToLabel(ticket.status);
    const priorityLabel = priorityToLabel(ticket.priority);
    const deviceModel = ticket.device?.model || ticket.model || "Non specificato";
    const serial = ticket.device?.serial || ticket.serial || "-";
    const os = ticket.device?.os || ticket.os || "-";
    const generatedAt = new Date().toISOString();
    const totalTicketDuration = formatDurationBetween(ticket.created_at, ticket.completed_at);
    const takeoverDuration = ticket.taken_in_charge_at
      ? formatDurationBetween(ticket.created_at, ticket.taken_in_charge_at)
      : "Non registrato";
    const workDuration = formatMinutesDuration(ticket.total_work_minutes ?? 0) || "Non registrato";

    let y = 42;

    function drawLogo(x: number, yPos: number) {
      doc.save();
      doc.roundedRect(x, yPos, 38, 38, 10).fill(brand.blue);
      doc.roundedRect(x + 9, yPos + 9, 20, 20, 5).fill("#FFFFFF");
      doc.roundedRect(x + 14, yPos + 14, 10, 10, 3).fill(brand.cyan);
      doc.restore();
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor(brand.navy)
        .text("PCReady", x + 50, yPos + 2);
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(brand.muted)
        .text(`Assistenza tecnica · ${templateLabel}`, x + 51, yPos + 25);
    }

    function chip(text: string, x: number, yPos: number, color: string, width = 86) {
      doc.save();
      doc.roundedRect(x, yPos, width, 22, 11).fill(color);
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#FFFFFF")
        .text(text.toUpperCase(), x, yPos + 7, { width, align: "center" });
      doc.restore();
    }

    function addManagedPage() {
      doc.addPage();
      y = 44;
      drawContinuationHeader();
      y = 82;
    }

    function drawContinuationHeader() {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(brand.blue).text("PCReady", marginX, y);
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(brand.muted)
        .text(`${templateLabel} ${ticket.ticket_code}`, marginX + 76, y, { width: 220 });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(brand.muted)
        .text(formatPdfDateTime(generatedAt), pageWidth - marginX - 170, y, {
          width: 170,
          align: "right",
        });
      doc
        .moveTo(marginX, y + 18)
        .lineTo(pageWidth - marginX, y + 18)
        .strokeColor(brand.border)
        .stroke();
    }

    function ensureSpace(height: number) {
      if (y + height <= pageHeight - 78) return;
      addManagedPage();
    }

    function sectionTitle(title: string, subtitle?: string) {
      ensureSpace(132);
      doc.font("Helvetica-Bold").fontSize(14).fillColor(brand.navy).text(title, marginX, y);
      if (subtitle) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(brand.muted)
          .text(subtitle, marginX, y + 18, { width: contentWidth });
        y += 38;
      } else {
        y += 24;
      }
    }

    function drawCard(height: number) {
      ensureSpace(height + 12);
      doc.save();
      doc.roundedRect(marginX, y, contentWidth, height, 12).fillAndStroke("#FFFFFF", brand.border);
      doc.restore();
    }

    function labelValue(label: string, value: string, x: number, yPos: number, width: number) {
      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor(brand.muted)
        .text(cleanPdfText(label).toUpperCase(), x, yPos, { width });
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor(brand.navy)
        .text(cleanPdfText(value || "-"), x, yPos + 13, { width });
    }

    function splitTextForHeight(text: string, width: number, maxHeight: number, fontSize: number) {
      const normalized = cleanWorkText(text) || "-";
      const chunks: string[] = [];
      let current = "";
      const paragraphs = normalized.split(/\n{2,}/);

      const heightOf = (value: string) =>
        doc.font("Helvetica").fontSize(fontSize).heightOfString(value, { width });
      const pushCurrent = () => {
        if (current.trim()) chunks.push(current.trim());
        current = "";
      };

      paragraphs.forEach((paragraph) => {
        const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
        if (heightOf(candidate) <= maxHeight) {
          current = candidate;
          return;
        }
        if (current) pushCurrent();
        paragraph.split(/(?<=[.!?])\s+/).forEach((sentence) => {
          const sentenceCandidate = current ? `${current} ${sentence}` : sentence;
          if (heightOf(sentenceCandidate) <= maxHeight) {
            current = sentenceCandidate;
            return;
          }
          if (current) pushCurrent();
          sentence.split(/\s+/).forEach((word) => {
            const wordCandidate = current ? `${current} ${word}` : word;
            if (heightOf(wordCandidate) <= maxHeight) current = wordCandidate;
            else {
              pushCurrent();
              current = word;
            }
          });
        });
      });
      pushCurrent();
      return chunks.length ? chunks : ["-"];
    }

    function workField(title: string, value: string, options?: { accent?: string }) {
      const safeValue = cleanPdfText(value) || "-";
      const innerWidth = contentWidth - 38;
      const textWidth = innerWidth - 18;
      const chunks = splitTextForHeight(safeValue, textWidth, pageHeight - 190, 10);

      chunks.forEach((chunk, index) => {
        const panelTitle = index === 0 ? title : `${title} (continua)`;
        const valueHeight = doc
          .font("Helvetica")
          .fontSize(10)
          .heightOfString(chunk, { width: textWidth });
        const height = Math.max(58, valueHeight + 42);
        ensureSpace(height + 12);
        doc.save();
        doc
          .roundedRect(marginX, y, contentWidth, height, 10)
          .fillAndStroke("#FFFFFF", brand.border);
        if (options?.accent) {
          doc.roundedRect(marginX, y, 5, height, 3).fill(options.accent);
        }
        doc.restore();
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(brand.navy)
          .text(cleanPdfText(panelTitle), marginX + 18, y + 13, { width: innerWidth });
        doc
          .font("Helvetica")
          .fontSize(10)
          .lineGap(3)
          .fillColor(brand.slate)
          .text(chunk, marginX + 18, y + 31, { width: textWidth });
        y += height + 12;
      });
    }

    function workBulletList(title: string, items: string[]) {
      const safeItems = items.length
        ? items.map(cleanPdfText)
        : ["Intervento completato senza ulteriori dettagli operativi pubblicati."];
      const innerWidth = contentWidth - 42;
      const chunks: string[][] = [];
      let currentChunk: string[] = [];
      let currentHeight = 0;
      const maxBodyHeight = pageHeight - 210;

      safeItems.forEach((item) => {
        const itemHeight = Math.max(
          18,
          doc
            .font("Helvetica")
            .fontSize(10)
            .heightOfString(item, { width: innerWidth - 28 }) + 8,
        );
        if (currentChunk.length && currentHeight + itemHeight > maxBodyHeight) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentHeight = 0;
        }
        currentChunk.push(item);
        currentHeight += itemHeight;
      });
      if (currentChunk.length) chunks.push(currentChunk);

      chunks.forEach((chunk, chunkIndex) => {
        const bodyHeight = chunk.reduce((sum, item) => {
          return (
            sum +
            Math.max(
              18,
              doc
                .font("Helvetica")
                .fontSize(10)
                .heightOfString(item, { width: innerWidth - 28 }) + 8,
            )
          );
        }, 0);
        const height = Math.max(72, bodyHeight + 42);
        ensureSpace(height + 12);
        doc.save();
        doc
          .roundedRect(marginX, y, contentWidth, height, 10)
          .fillAndStroke(brand.panel, brand.border);
        doc.restore();
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(brand.navy)
          .text(
            cleanPdfText(chunkIndex === 0 ? title : `${title} (continua)`),
            marginX + 18,
            y + 13,
            {
              width: innerWidth,
            },
          );
        let bulletY = y + 34;
        chunk.forEach((item) => {
          const itemHeight = Math.max(
            18,
            doc
              .font("Helvetica")
              .fontSize(10)
              .heightOfString(item, { width: innerWidth - 28 }) + 8,
          );
          doc.circle(marginX + 23, bulletY + 6, 2.4).fill(brand.blue);
          doc
            .font("Helvetica")
            .fontSize(10)
            .lineGap(3)
            .fillColor(brand.slate)
            .text(item, marginX + 36, bulletY, { width: innerWidth - 28 });
          bulletY += itemHeight;
        });
        y += height + 12;
      });
    }

    function drawChecklistSection(summaries: TicketChecklistSummary[], detailed = false) {
      sectionTitle(
        "Checklist eseguite",
        detailed
          ? "Riepilogo tecnico dei controlli associati al ticket, con evidenza degli step obbligatori."
          : "Riepilogo dei controlli standardizzati eseguiti prima della chiusura.",
      );

      if (!summaries.length) {
        workField(
          "Checklist associate",
          "Nessuna checklist operativa associata al ticket al momento della generazione del verbale.",
          { accent: brand.muted },
        );
        return;
      }

      summaries.forEach((checklist, index) => {
        const pct = checklist.total ? Math.round((checklist.done / checklist.total) * 100) : 0;
        const detailItems = checklist.sections.flatMap((section) => [
          ...section.requiredMissing.map(
            (item) => `Obbligatorio non completato · ${section.title}: ${item}`,
          ),
          ...section.completedItems
            .slice(0, Math.max(0, 4 - section.requiredMissing.length))
            .map((item) => `${section.title}: ${item}`),
        ]);
        const shownDetails = detailItems.slice(0, detailed ? 18 : 8);
        const hiddenCount = Math.max(0, detailItems.length - shownDetails.length);
        const height = 112 + shownDetails.length * 18 + (hiddenCount ? 18 : 0);
        ensureSpace(height + 14);

        doc.save();
        doc
          .roundedRect(marginX, y, contentWidth, height, 12)
          .fillAndStroke("#FFFFFF", brand.border);
        doc.restore();
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(brand.navy)
          .text(cleanPdfText(`${index + 1}. ${checklist.title}`), marginX + 16, y + 14, {
            width: contentWidth - 180,
          });
        const statusColor = checklist.requiredMissing ? brand.warning : brand.success;
        chip(
          checklistStatusToLabel(checklist.status),
          marginX + contentWidth - 112,
          y + 12,
          statusColor,
          96,
        );
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(brand.muted)
          .text(
            cleanPdfText(
              `${formatProgressText(checklist.done, checklist.total, "voci completate")} | ${pct}%${
                checklist.completed_at
                  ? ` | completata il ${formatPdfDateTime(checklist.completed_at)}`
                  : ""
              }`,
            ),
            marginX + 16,
            y + 34,
            { width: contentWidth - 32 },
          );

        const barX = marginX + 16;
        const barY = y + 56;
        const barWidth = contentWidth - 32;
        doc.roundedRect(barX, barY, barWidth, 8, 4).fill("#E2E8F0");
        doc
          .roundedRect(barX, barY, Math.max(4, Math.round((barWidth * pct) / 100)), 8, 4)
          .fill(statusColor);

        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor(checklist.requiredMissing ? brand.warning : brand.success)
          .text(
            checklist.requiredMissing
              ? `${checklist.requiredMissing} step obbligatori non completati`
              : "Tutti gli step obbligatori risultano completati",
            marginX + 16,
            y + 74,
            { width: contentWidth - 32 },
          );

        let detailY = y + 94;
        shownDetails.forEach((item) => {
          const isMissing = item.startsWith("Obbligatorio non completato");
          doc
            .circle(marginX + 21, detailY + 5, 2.2)
            .fill(isMissing ? brand.warning : brand.success);
          doc
            .font("Helvetica")
            .fontSize(8.5)
            .fillColor(brand.slate)
            .text(cleanPdfText(item), marginX + 32, detailY, { width: contentWidth - 48 });
          detailY += 18;
        });
        if (hiddenCount) {
          doc
            .font("Helvetica-Oblique")
            .fontSize(8.5)
            .fillColor(brand.muted)
            .text(
              `+ ${hiddenCount} ulteriori voci omesse nel riepilogo compatto`,
              marginX + 32,
              detailY,
              {
                width: contentWidth - 48,
              },
            );
        }
        y += height + 14;
      });
    }

    function drawFinalVerificationSection(summaries: TicketChecklistSummary[]) {
      const total = summaries.reduce((sum, checklist) => sum + checklist.total, 0);
      const done = summaries.reduce((sum, checklist) => sum + checklist.done, 0);
      const missing = summaries.reduce((sum, checklist) => sum + checklist.requiredMissing, 0);
      const confirmed = summaries.filter((checklist) => checklist.completion_confirmed).length;
      const finalOutcome = !summaries.length
        ? "Verifica finale basata su chiusura ticket: nessuna checklist strutturata associata."
        : missing > 0
          ? `Verifica finale con attenzione: ${missing} step obbligatori risultano non completati.`
          : `Verifica finale positiva: ${formatProgressText(done, total, "controlli completati")} e nessun obbligatorio mancante.`;
      sectionTitle(
        "Verifiche finali",
        "Esito sintetico dei controlli procedurali prima della chiusura.",
      );
      workField(
        "Esito verifiche",
        `${finalOutcome}${
          summaries.length
            ? ` Conferme completamento checklist: ${formatProgressText(
                confirmed,
                summaries.length,
                "confermate",
              )}.`
            : ""
        }`,
        { accent: missing > 0 ? brand.warning : brand.success },
      );
    }

    function drawSignatureSection() {
      sectionTitle(
        "Firme e presa visione",
        "Sezione facoltativa per formalizzare la consegna, la chiusura intervento o la presa visione del cliente.",
      );

      const height = 188;
      ensureSpace(height + 14);
      doc.save();
      doc.roundedRect(marginX, y, contentWidth, height, 14).fillAndStroke("#FFFFFF", brand.border);
      doc.restore();

      const confirmedBy = (ticket.checklist_summaries ?? [])
        .map((checklist) => checklist.signature_name)
        .find(Boolean);
      const techName = displayValue(ticket.assignee_name, "Tecnico non assegnato");
      const customerName = displayValue(ticket.requester, "Referente cliente");
      const leftX = marginX + 18;
      const rightX = marginX + contentWidth / 2 + 10;
      const signatureWidth = contentWidth / 2 - 34;

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(brand.navy)
        .text("Firma tecnico", leftX, y + 18, { width: signatureWidth });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brand.muted)
        .text(`Nome: ${techName}`, leftX, y + 36, { width: signatureWidth });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brand.muted)
        .text(`Data e ora: ${formatPdfDateTime(ticket.completed_at)}`, leftX, y + 52, {
          width: signatureWidth,
        });
      doc
        .moveTo(leftX, y + 96)
        .lineTo(leftX + signatureWidth, y + 96)
        .strokeColor(brand.border)
        .stroke();
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(brand.muted)
        .text(
          confirmedBy
            ? `Conferma digitale/checklist: ${confirmedBy}`
            : "Firma autografa o conferma digitale facoltativa",
          leftX,
          y + 104,
          { width: signatureWidth },
        );

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(brand.navy)
        .text("Firma cliente / referente", rightX, y + 18, { width: signatureWidth });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brand.muted)
        .text(`Nome: ${customerName}`, rightX, y + 36, { width: signatureWidth });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brand.muted)
        .text("Data e ora: __________________________", rightX, y + 52, { width: signatureWidth });
      doc
        .moveTo(rightX, y + 96)
        .lineTo(rightX + signatureWidth, y + 96)
        .strokeColor(brand.border)
        .stroke();
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor(brand.muted)
        .text("Firma facoltativa per presa visione / accettazione intervento", rightX, y + 104, {
          width: signatureWidth,
        });

      const acceptanceY = y + 136;
      doc.roundedRect(leftX, acceptanceY, 14, 14, 3).strokeColor(brand.border).stroke();
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(brand.slate)
        .text(
          "Presa visione: il referente dichiara di aver ricevuto il verbale e prende atto dell'esito dell'intervento indicato nel presente documento.",
          leftX + 22,
          acceptanceY - 1,
          { width: contentWidth - 58 },
        );

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(brand.muted)
        .text(
          `Riferimento verificabile: ticket ${ticket.ticket_code} · documento generato da PCReady il ${formatPdfDateTime(generatedAt)}`,
          leftX,
          y + 168,
          { width: contentWidth - 36, align: "center" },
        );

      y += height + 14;
    }

    // Header with identity and document metadata.
    drawLogo(marginX, y);
    doc
      .font("Helvetica-Bold")
      .fontSize(19)
      .fillColor(brand.navy)
      .text(
        isTechnicalTemplate ? "Report tecnico completamento" : "Verbale di completamento",
        marginX + 245,
        y + 1,
        {
          width: contentWidth - 245,
          align: "right",
        },
      );
    doc
      .font("Helvetica")
      .fontSize(9.5)
      .fillColor(brand.muted)
      .text(`Generato il ${formatPdfDateTime(generatedAt)}`, marginX + 245, y + 26, {
        width: contentWidth - 245,
        align: "right",
      });
    y += 62;

    // Hero summary box: key facts readable immediately.
    doc.save();
    doc.roundedRect(marginX, y, contentWidth, 112, 16).fillAndStroke(brand.soft, "#C8D8F5");
    doc.restore();
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor(brand.blue)
      .text(ticket.ticket_code, marginX + 18, y + 18, { width: 170 });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(brand.muted)
      .text("Riferimento ticket", marginX + 20, y + 45, { width: 170 });
    chip(statusLabel, marginX + 20, y + 68, brand.success, 108);
    chip(priorityLabel, marginX + 136, y + 68, priorityColor(ticket.priority, brand), 94);

    const summaryX = marginX + 258;
    const summaryCol = (contentWidth - 284) / 2;
    labelValue("Cliente", ticket.client || "-", summaryX, y + 20, summaryCol);
    labelValue(
      "Tecnico",
      ticket.assignee_name || "Non assegnato",
      summaryX + summaryCol + 18,
      y + 20,
      summaryCol,
    );
    labelValue("Apertura", formatPdfDateTime(ticket.created_at), summaryX, y + 63, summaryCol);
    labelValue(
      "Completamento",
      formatPdfDateTime(ticket.completed_at),
      summaryX + summaryCol + 18,
      y + 63,
      summaryCol,
    );
    y += 136;

    sectionTitle(
      "Dati ticket",
      "Riepilogo amministrativo e riferimenti principali dell'intervento.",
    );
    drawCard(136);
    const col = (contentWidth - 56) / 3;
    labelValue("Richiedente", displayValue(ticket.requester), marginX + 18, y + 18, col);
    labelValue("Utente finale", displayValue(ticket.end_user), marginX + 28 + col, y + 18, col);
    labelValue(
      "Titolo",
      displayValue(ticket.model, "Ticket assistenza"),
      marginX + 38 + col * 2,
      y + 18,
      col,
    );
    labelValue("Stato", statusLabel, marginX + 18, y + 58, col);
    labelValue("Priorità", priorityLabel, marginX + 28 + col, y + 58, col);
    labelValue("Codice", ticket.ticket_code, marginX + 38 + col * 2, y + 58, col);
    labelValue("Durata totale ticket", totalTicketDuration, marginX + 18, y + 98, col);
    labelValue("Tempo presa in carico", takeoverDuration, marginX + 28 + col, y + 98, col);
    labelValue("Tempo lavorato registrato", workDuration, marginX + 38 + col * 2, y + 98, col);
    y += 156;

    sectionTitle(
      "Dispositivo",
      "Informazioni tecniche del dispositivo o dell'ambiente interessato.",
    );
    drawCard(84);
    labelValue("Modello / asset", displayValue(deviceModel), marginX + 18, y + 18, col);
    labelValue("Seriale", displayValue(serial), marginX + 28 + col, y + 18, col);
    labelValue("Sistema operativo", displayValue(os), marginX + 38 + col * 2, y + 18, col);
    labelValue(
      "Software / servizio",
      displayValue(ticket.software),
      marginX + 18,
      y + 55,
      contentWidth - 36,
    );
    y += 104;

    const execution = buildWorkExecutionSummary(ticket, statusLabel, template);
    sectionTitle(
      "Esecuzione del lavoro",
      isTechnicalTemplate
        ? "Riepilogo tecnico operativo dell'intervento, utile per audit e storico manutenzione."
        : "Riepilogo dell'intervento in linguaggio chiaro per cliente e amministrazione.",
    );
    workField("Problema segnalato", execution.problem, { accent: brand.blue });
    workField("Diagnosi tecnica", execution.diagnosis, { accent: brand.cyan });
    workBulletList("Attività svolte", execution.activities);
    workField("Esito finale", execution.outcome, { accent: brand.success });
    workField("Eventuali anomalie residue", execution.residualIssues, { accent: brand.warning });
    workField("Raccomandazioni post-intervento", execution.recommendations, { accent: brand.blue });

    drawChecklistSection(ticket.checklist_summaries ?? [], isTechnicalTemplate);
    drawFinalVerificationSection(ticket.checklist_summaries ?? []);

    if (isTechnicalTemplate) {
      sectionTitle(
        "Dettagli tecnici interni",
        "Informazioni complete per uso tecnico/amministrativo.",
      );
      workField("Note tecniche", ticket.notes || "Nessuna nota tecnica interna disponibile.", {
        accent: brand.cyan,
      });
      workBulletList(
        "Log sintetico stati",
        (ticket.status_history ?? []).map(
          (entry) =>
            `${formatPdfDateTime(entry.changed_at)} · Stato: ${ticketStatusToLabel(entry.to_status)}`,
        ),
      );
      workField(
        "Riferimenti interni",
        `ID ticket: ${ticket.id}\nID cliente: ${ticket.client_id || "Non disponibile"}\nID tecnico assegnatario: ${ticket.assignee_id || "Non disponibile"}`,
        { accent: brand.muted },
      );
    }

    drawSignatureSection();

    // Footer with page numbering and ticket reference.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const footerY = pageHeight - 48;
      doc
        .moveTo(marginX, footerY - 10)
        .lineTo(pageWidth - marginX, footerY - 10)
        .strokeColor(brand.border)
        .stroke();
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(brand.muted)
        .text("Documento generato automaticamente da PCReady", marginX, footerY, {
          width: 220,
        });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(brand.muted)
        .text(`Ticket ${ticket.ticket_code}`, marginX + 225, footerY, {
          width: 130,
          align: "center",
        });
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(brand.muted)
        .text(`Pagina ${i + 1} di ${range.count}`, pageWidth - marginX - 110, footerY, {
          width: 110,
          align: "right",
        });
    }

    doc.end();

    await new Promise<void>((resolve) => {
      doc.on("end", () => resolve());
    });

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("PDF generation failed, falling back to placeholder:", error);
    return Buffer.from("PDF Placeholder - Ticket Completion Report");
  }
}

function ticketStatusToLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "In attesa",
    "in-progress": "In lavorazione",
    testing: "Verifica tecnica",
    ready: "Risolto",
    completed: "Completato",
    archived: "Archiviato",
  };
  return (
    labels[status] ||
    STATUS_META[status as keyof typeof STATUS_META]?.label ||
    humanizeValue(status)
  );
}

function priorityToLabel(priority: string) {
  const labels: Record<string, string> = {
    low: "Bassa",
    med: "Media",
    medium: "Media",
    normal: "Normale",
    high: "Alta",
    urgent: "Urgente",
  };
  return labels[priority] || humanizeValue(priority);
}

function priorityColor(priority: string, brand: { warning: string; muted: string; blue: string }) {
  if (priority === "high" || priority === "urgent") return brand.warning;
  if (priority === "low") return brand.muted;
  return brand.blue;
}

function checklistStatusToLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Da eseguire",
    in_progress: "In corso",
    completed: "Completata",
  };
  return labels[status] || humanizeValue(status);
}

function buildChecklistSummaries(
  instances: any[],
  legacyState?: TicketData["checklist"],
  legacyStructure?: TicketData["checklist_structure"],
): TicketChecklistSummary[] {
  const summaries = instances.map((instance) => buildChecklistSummaryFromInstance(instance));
  if (summaries.length) return summaries;
  const legacy = buildLegacyChecklistSummary(legacyState, legacyStructure);
  return legacy ? [legacy] : [];
}

function buildChecklistSummaryFromInstance(instance: any): TicketChecklistSummary {
  const structure = normalizeChecklistStructure(instance.structure);
  const responses = new Map<string, string | null>(
    ((instance.responses ?? instance.ticket_checklist_responses ?? []) as any[]).map((response) => [
      response.item_key,
      response.value ?? null,
    ]),
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
  state?: TicketData["checklist"],
  structure?: TicketData["checklist_structure"],
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

function formatPdfDateTime(value?: string | Date | null) {
  if (!value) return "Non disponibile";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Non disponibile";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDurationBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return "Non disponibile";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return "Non disponibile";
  }
  return formatMinutesDuration(Math.round((endMs - startMs) / 60000));
}

function formatMinutesDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? "giorno" : "giorni"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "ora" : "ore"}`);
  if (mins || !parts.length) parts.push(`${mins} ${mins === 1 ? "minuto" : "minuti"}`);
  return parts.slice(0, 3).join(" e ");
}

function displayValue(value?: string | null, fallback = "Non disponibile") {
  const normalized = cleanPdfText(value);
  if (!normalized || normalized === "-" || normalized.toLowerCase() === "n/d") return fallback;
  return normalized;
}

function humanizeValue(value?: string | null) {
  const normalized = displayValue(value, "Non disponibile");
  if (normalized === "Non disponibile") return normalized;
  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

interface WorkExecutionSummary {
  problem: string;
  diagnosis: string;
  activities: string[];
  outcome: string;
  residualIssues: string;
  recommendations: string;
}

function buildWorkExecutionSummary(
  ticket: TicketData,
  statusLabel: string,
  template: CompletionPdfTemplate,
): WorkExecutionSummary {
  const publicText = [
    ticket.public_notes,
    ...(ticket.public_notes_log ?? []).map((note) => note.content),
  ]
    .filter(Boolean)
    .join("\n\n");
  const technicalText =
    template === "technical" ? [ticket.notes, publicText].filter(Boolean).join("\n\n") : publicText;
  const structured = extractStructuredWorkFields(technicalText);
  const title = ticket.model || ticket.device?.model || "ticket";

  const activitiesFromNotes = (ticket.public_notes_log ?? [])
    .map((note) => {
      const prefix = note.created_at
        ? `${formatPdfDateTime(note.created_at)}${note.author_name ? ` · ${note.author_name}` : ""}`
        : note.author_name;
      return `${prefix ? `${prefix}: ` : ""}${cleanWorkText(note.content)}`;
    })
    .filter((item) => item.length > 0);

  const inferredActivities = splitActivities(structured.activities || publicText).filter(Boolean);

  return {
    problem:
      structured.problem ||
      cleanWorkText(
        (template === "technical" ? ticket.notes : ticket.public_notes) ||
          ticket.public_notes ||
          ticket.model ||
          "Richiesta di assistenza registrata sul ticket.",
      ),
    diagnosis:
      structured.diagnosis ||
      "Diagnosi tecnica completata dal tecnico assegnatario sulla base delle informazioni raccolte e delle verifiche effettuate durante l'intervento.",
    activities: [...inferredActivities, ...activitiesFromNotes].length
      ? dedupeStrings([...inferredActivities, ...activitiesFromNotes]).slice(0, 12)
      : [
          `Verifica della richiesta e presa in carico del ticket ${ticket.ticket_code}.`,
          `Intervento tecnico su ${title}.`,
          "Validazione finale dell'esito prima della chiusura del ticket.",
        ],
    outcome:
      structured.outcome ||
      `Intervento completato con esito "${statusLabel}" in data ${formatPdfDateTime(ticket.completed_at)}.`,
    residualIssues:
      structured.residualIssues || "Nessuna anomalia residua segnalata al momento della chiusura.",
    recommendations:
      structured.recommendations ||
      "Conservare il presente verbale per audit e storico manutenzione. In caso di ricomparsa del problema, aprire una nuova richiesta indicando il riferimento di questo ticket.",
  };
}

function extractStructuredWorkFields(text: string) {
  const fields: Record<string, string> = {};
  const labels: Record<string, keyof WorkExecutionSummary | "activities"> = {
    "problema segnalato": "problem",
    problema: "problem",
    richiesta: "problem",
    "diagnosi tecnica": "diagnosis",
    diagnosi: "diagnosis",
    "attività svolte": "activities",
    "attivita svolte": "activities",
    attivita: "activities",
    "esito finale": "outcome",
    esito: "outcome",
    "anomalie residue": "residualIssues",
    "eventuali anomalie residue": "residualIssues",
    anomalie: "residualIssues",
    "raccomandazioni post-intervento": "recommendations",
    raccomandazioni: "recommendations",
  };

  const labelPattern = Object.keys(labels)
    .sort((a, b) => b.length - a.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(?:^|\\n)\\s*(${labelPattern})\\s*[:\\uFF1A-]\\s*`, "gi");
  const matches = [...text.matchAll(regex)];
  matches.forEach((match, index) => {
    const rawLabel = match[1].toLowerCase();
    const key = labels[rawLabel];
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const value = cleanWorkText(text.slice(start, end));
    if (value) fields[key] = value;
  });

  return fields as Partial<Record<keyof WorkExecutionSummary | "activities", string>>;
}

function splitActivities(text: string) {
  return cleanWorkText(text)
    .split(/\n+|(?:^|\s)[\u2022*-]\s+/)
    .map((item) => cleanWorkText(item.replace(/^\d+[.)]\s*/, "")))
    .filter((item) => item.length > 0 && item.length < 600);
}

function cleanWorkText(text: string) {
  return cleanPdfText(text)
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanPdfText(value?: string | null) {
  return String(value ?? "")
    .replace(/\u00C2\u00B7/g, "|")
    .replace(/\u00C3\u00A0/g, "\u00E0")
    .replace(/\u00C3\u00A8/g, "\u00E8")
    .replace(/\u00C3\u00A9/g, "\u00E9")
    .replace(/\u00C3\u00AC/g, "\u00EC")
    .replace(/\u00C3\u00B2/g, "\u00F2")
    .replace(/\u00C3\u00B9/g, "\u00F9")
    .replace(/\u00E2\u20AC\u201C/g, "-")
    .replace(/\u00E2\u20AC\u201D/g, "-")
    .replace(/\u00E2\u20AC\u00A2/g, "-")
    .replace(/\u00EF\u00BC\u0161/g, ":")
    .replace(/\xA0/g, " ")
    .trim();
}

function formatProgressText(done: number, total: number, label: string) {
  return `${done} di ${total} ${label}`;
}

function dedupeStrings(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
