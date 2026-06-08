import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

/**
 * A single widget annotation row as returned by the database.
 */
export interface WidgetAnnotationRow {
  id: string;
  user_id: string;
  widget_id: string;
  text: string;
  note_date: string | null;
  created_at: string;
  updated_at: string;
}

const ANNOTATION_SELECT = "id, user_id, widget_id, text, note_date, created_at, updated_at";

async function getAuthedUser(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Non autenticato", { status: 401 });
  return data.user;
}

/**
 * Server function: lists all annotations for the authenticated user,
 * optionally filtered by widgetId.
 */
const WAnnListSchema = z.object({ accessToken: z.string(), widgetId: z.string().optional() });
const WAnnCreateSchema = z.object({ accessToken: z.string(), annotation: z.object({ widget_id: z.string(), text: z.string(), note_date: z.string().nullable().optional() }) });
const WAnnUpdateSchema = z.object({ accessToken: z.string(), annotationId: z.string(), updates: z.object({ text: z.string().optional(), note_date: z.string().nullable().optional() }) });
const WAnnDeleteSchema = z.object({ accessToken: z.string(), annotationId: z.string() });

export const listWidgetAnnotations = createServerFn({ method: "POST" })
  .validator(WAnnListSchema)
  .handler(async ({ data: { accessToken, widgetId } }) => {
    const user = await getAuthedUser(accessToken);

    let query = supabaseAdmin
      .from("widget_annotations")
      .select(ANNOTATION_SELECT)
      .eq("user_id", user.id);

    if (widgetId) query = query.eq("widget_id", widgetId);

    const { data: rows, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;
    return (rows ?? []) as Database["public"]["Tables"]["widget_annotations"]["Row"][];
  });

export const CreateAnnotationSchema = z.object({
  widget_id: z.string().min(1),
  text: z.string().min(1).max(500),
  note_date: z.string().nullable().optional(),
});

export const UpdateAnnotationSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  note_date: z.string().nullable().optional(),
});

/**
 * Server function: creates a new widget annotation for the authenticated user.
 */
export const createWidgetAnnotation = createServerFn({ method: "POST" })
  .validator(WAnnCreateSchema)
  .handler(async ({ data: { accessToken, annotation } }) => {
    const user = await getAuthedUser(accessToken);
    const input = CreateAnnotationSchema.parse(annotation);

    const { data: row, error } = await supabaseAdmin
      .from("widget_annotations")
      .insert({
        user_id: user.id,
        widget_id: input.widget_id,
        text: input.text,
        note_date: input.note_date ?? null,
      })
      .select(ANNOTATION_SELECT)
      .single();

    if (error) throw error;
    return row as Database["public"]["Tables"]["widget_annotations"]["Row"];
  });


/**
 * Server function: updates an existing annotation owned by the authenticated user.
 */
export const updateWidgetAnnotation = createServerFn({ method: "POST" })
  .validator(WAnnUpdateSchema)
  .handler(async ({ data: { accessToken, annotationId, updates } }) => {
    const user = await getAuthedUser(accessToken);
    const input = UpdateAnnotationSchema.parse(updates);

    const { data: row, error } = await supabaseAdmin
      .from("widget_annotations")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", annotationId)
      .eq("user_id", user.id)
      .select(ANNOTATION_SELECT)
      .single();

    if (error) throw error;
    return row as Database["public"]["Tables"]["widget_annotations"]["Row"];
  });

/**
 * Server function: deletes an annotation owned by the authenticated user.
 */
export const deleteWidgetAnnotation = createServerFn({ method: "POST" })
  .validator(WAnnDeleteSchema)
  .handler(async ({ data: { accessToken, annotationId } }) => {
    const user = await getAuthedUser(accessToken);

    const { error } = await supabaseAdmin
      .from("widget_annotations")
      .delete()
      .eq("id", annotationId)
      .eq("user_id", user.id);

    if (error) throw error;
    return { success: true };
  });
