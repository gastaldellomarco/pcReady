import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TicketAssignedEmailSchema = z.object({
  ticketId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

const ChecklistCompletedEmailSchema = z.object({
  ticketId: z.string().uuid(),
  checklistName: z.string().min(1),
});

export const sendTicketAssignedEmail = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof TicketAssignedEmailSchema>) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchEmailForUser, getEmailCommonVariables, sendEmailEvent, userAllowsEmail } =
      await import("@/lib/email-helpers.server");
    const { ticketId, assigneeId } = TicketAssignedEmailSchema.parse(data);
    const allowed = await userAllowsEmail(assigneeId, "notify_ticket_assigned");
    if (!allowed) return { skipped: true };

    const assigneeEmail = await fetchEmailForUser(assigneeId);
    if (!assigneeEmail) return { skipped: true };

    const { data: ticket, error } = await supabaseAdmin
      .from("tickets" as any)
      .select("id, ticket_code, client, model, notes, device:devices(model)")
      .eq("id", ticketId)
      .maybeSingle();

    if (error) throw error;
    if (!ticket) return { skipped: true };

    const common = await getEmailCommonVariables(assigneeId, assigneeEmail);
    const ticketRow = ticket as any;
    const title =
      ticketRow.model || ticketRow.device?.model || ticketRow.notes || ticketRow.ticket_code;

    await sendEmailEvent({
      eventType: "ticket_assigned",
      to: assigneeEmail,
      variables: {
        "{{organization_name}}": common.organizationName,
        "{{support_email}}": common.supportEmail,
        "{{user_name}}": common.userName,
        "{{user_email}}": assigneeEmail,
        "{{ticket_code}}": ticketRow.ticket_code,
        "{{ticket_title}}": title,
        "{{ticket_link}}": `${common.appUrl}/tickets`,
      },
    });

    return { ok: true };
  });

export const sendChecklistCompletedEmail = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof ChecklistCompletedEmailSchema>) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchEmailForUser, getEmailCommonVariables, sendEmailEvent, userAllowsEmail } =
      await import("@/lib/email-helpers.server");
    const { ticketId, checklistName } = ChecklistCompletedEmailSchema.parse(data);

    const { data: ticket, error } = await supabaseAdmin
      .from("tickets" as any)
      .select("id, ticket_code, assignee_id")
      .eq("id", ticketId)
      .maybeSingle();

    if (error) throw error;
    const ticketRow = ticket as {
      id: string;
      ticket_code: string;
      assignee_id: string | null;
    } | null;
    if (!ticketRow?.assignee_id) return { skipped: true };

    const assigneeId = ticketRow.assignee_id;
    const allowed = await userAllowsEmail(assigneeId, "notify_checklist_completed");
    if (!allowed) return { skipped: true };

    const assigneeEmail = await fetchEmailForUser(assigneeId);
    if (!assigneeEmail) return { skipped: true };

    const common = await getEmailCommonVariables(assigneeId, assigneeEmail);

    await sendEmailEvent({
      eventType: "checklist_completed",
      to: assigneeEmail,
      variables: {
        "{{organization_name}}": common.organizationName,
        "{{support_email}}": common.supportEmail,
        "{{user_name}}": common.userName,
        "{{user_email}}": assigneeEmail,
        "{{checklist_name}}": checklistName,
        "{{ticket_code}}": ticketRow.ticket_code,
        "{{ticket_link}}": `${common.appUrl}/tickets`,
      },
    });

    return { ok: true };
  });
