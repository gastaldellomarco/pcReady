import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";
import type { Database, Json } from "@/integrations/supabase/types";

const StaffTicketPayloadSchema = z.object({
  client: z.string().min(1),
  client_id: z.string().uuid(),
  device_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  category: z.string().nullable().optional(),
  requester: z.string().min(1),
  requester_contact_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  priority: z.enum(["low", "med", "high"]),
  ticket_type: z.string().min(1),
  status: z.literal("pending"),
  assignee_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  software: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  checklist: z.record(z.unknown()).optional(),
  template_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  checklist_template_ids: z.array(z.string().uuid()).optional(),
  checklist_structure: z.unknown().optional(),
  source: z.enum(["internal", "portal"]).optional(),
});

const CreateTicketInputSchema = z.object({
  accessToken: z.string().min(1),
  ticket: StaffTicketPayloadSchema,
});

function sectionAssignmentsFromRawStructure(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, any>)
      .filter(([, section]) => !!section?.assigned_to)
      .map(([key, section]) => [key, section.assigned_to]),
  );
}

function createSupabaseForAccessToken(accessToken: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Response("Configurazione Supabase mancante sul server", { status: 500 });
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const createTicket = createServerFn({ method: "POST" })
  .validator(CreateTicketInputSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseForAccessToken(data.accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Response("Non autenticato", { status: 401 });

    throwIfRateLimited(user.id, RATE_LIMITER_KEYS.CREATE_STAFF_TICKET);

    const t = data.ticket;
    const deviceId = t.device_id && t.device_id.length > 0 ? t.device_id : null;
    const assigneeId = t.assignee_id && t.assignee_id.length > 0 ? t.assignee_id : null;
    const requesterContactId =
      t.requester_contact_id && t.requester_contact_id.length > 0 ? t.requester_contact_id : null;
    const selectedTemplateIds = Array.from(
      new Set(
        [
          ...(t.checklist_template_ids ?? []),
          ...(t.template_id && t.template_id.length > 0 ? [t.template_id] : []),
        ].filter(Boolean),
      ),
    );
    const templateId = selectedTemplateIds[0] ?? null;

    const insertPayload = {
      client: t.client,
      client_id: t.client_id,
      device_id: deviceId,
      category: t.category ?? null,
      requester: t.requester,
      requester_contact_id: requesterContactId,
      priority: t.priority,
      ticket_type: t.ticket_type,
      status: t.status,
      assignee_id: assigneeId,
      software: t.software ?? null,
      notes: t.notes ?? null,
      checklist: (t.checklist ?? {}) as Json,
      template_id: templateId,
      checklist_structure: (t.checklist_structure ?? null) as Json | null,
      source: t.source === "portal" ? "portal" : "internal",
      created_by: user.id,
    };

    const { data: row, error } = await supabase
      .from("tickets")
      .insert(insertPayload as never)
      .select("id, ticket_code")
      .single();

    if (error) throw error;

    const { error: histError } = await supabase.from("ticket_status_history").insert({
      ticket_id: row.id,
      from_status: null,
      to_status: "pending",
      changed_by: user.id,
      changed_at: new Date().toISOString(),
      note: "Ticket creato",
    } as never);
    if (histError) throw histError;

    if (selectedTemplateIds.length > 0) {
      const { data: templates, error: templatesError } = await supabase
        .from("checklist_templates")
        .select("id, name, structure")
        .in("id", selectedTemplateIds as never);
      if (templatesError) throw templatesError;

      const byId = new Map(((templates ?? []) as any[]).map((template) => [template.id, template]));
      const instancePayloads = selectedTemplateIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((template) => ({
          ticket_id: row.id,
          template_id: template.id,
          title: template.name,
          structure: template.structure as Json,
          status: "pending",
          assigned_to: assigneeId,
          section_assignments: sectionAssignmentsFromRawStructure(template.structure) as Json,
        }));

      if (instancePayloads.length > 0) {
        const { error: instancesError } = await (supabase as any)
          .from("ticket_checklist_instances")
          .insert(instancePayloads);
        if (instancesError) throw instancesError;
      }
    }

    return { id: row.id, ticket_code: row.ticket_code };
  });
