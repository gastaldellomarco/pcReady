import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildDownloadFileName } from "@/lib/export-format";
import { requireAdmin } from "./admin-users.server";

/**
 *
 */
export type ActivityLogEntry = {
  id: string;
  type: "sys" | "auto" | "user";
  message: string;
  ticket_id: string | null;
  actor_id: string | null;
  created_at: string;
  actor_name?: string;
  // Extended columns
  action_type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string | null;
  severity?: string | null;
  session_id?: string | null;
};

/**
 *
 */
export type AuditLogEntryRaw = Record<string, unknown>;

/**
 *
 */
export type AuditLogFilters = {
  user?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  entityType?: string;
  outcome?: string;
  pageSize?: number;
};

/**
 *
 */
export type AuditLogKpi = {
  eventsToday: number;
  events7d: number;
  recentErrors: number;
};

/**
 *
 */
export type AuditLogUserOption = {
  actor_name: string;
  count: number;
};

export const getAuditLog = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { accessToken: string; page?: number; pageSize?: number; filters?: AuditLogFilters }) =>
      data,
  )
  .handler(async ({ data: { accessToken, page = 1, pageSize = 25, filters } }) => {
    await requireAdmin(accessToken);

    // Fetch all matching rows server-side, deduplicate by (message + created_at second),
    // then apply pagination in JS. This ensures duplicates (same message and same second)
    // are removed before returning results.
    // Use deduplicated view created by migration: activity_log_dedup
    // cast query to any to avoid strict typed relation names in supabase client
    let baseQuery: any = supabaseAdmin.from("activity_log_dedup" as any).select(
      `
        id,
        type,
        action_type,
        entity_type,
        entity_id,
        old_value,
        new_value,
        ip_address,
        severity,
        session_id,
        message,
        ticket_id,
        actor_id,
        created_at,
        actor_name,
        actor_initials
      `,
      { count: "exact" },
    );

    // apply filters to baseQuery

    if (filters?.search) {
      baseQuery = baseQuery.or(
        `actor_name.ilike.%${filters.search}%,message.ilike.%${filters.search}%`,
      );
    }

    if (filters?.user) {
      baseQuery = baseQuery.ilike("actor_name", `%${filters.user}%`);
    }

    if (filters?.actionType) {
      baseQuery = baseQuery.eq("action_type", filters.actionType);
    }

    if (filters?.outcome) {
      baseQuery = baseQuery.eq("severity", filters.outcome);
    }

    if (filters?.entityType) {
      baseQuery = baseQuery.eq("entity_type", filters.entityType);
    }

    if (filters?.dateFrom) {
      baseQuery = baseQuery.gte("created_at", filters.dateFrom);
    }

    if (filters?.dateTo) {
      baseQuery = baseQuery.lte("created_at", filters.dateTo);
    }

    const { data, error } = await baseQuery.order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as any[];

    // Deduplicate by message + created_at (to the second)
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const row of rows) {
      const key = `${row.message}|${String(row.created_at).slice(0, 19)}`; // same second
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    const total = deduped.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // apply pagination server-side after deduplication
    const start = (page - 1) * pageSize;
    const pageRows = deduped.slice(start, start + pageSize);

    const entries: ActivityLogEntry[] = pageRows.map((row: any) => ({
      id: row.id,
      type: row.type as ActivityLogEntry["type"],
      action_type: row.action_type ?? null,
      entity_type: row.entity_type ?? null,
      entity_id: row.entity_id ?? null,
      old_value: row.old_value ?? null,
      new_value: row.new_value ?? null,
      ip_address: row.ip_address ?? null,
      severity: row.severity ?? "info",
      session_id: row.session_id ?? null,
      message: row.message,
      ticket_id: row.ticket_id,
      actor_id: row.actor_id,
      created_at: row.created_at,
      actor_name: row.actor_name || "Sistema",
    }));

    const result: any = {
      total,
      page,
      pageSize,
      totalPages,
      entries,
    };
    return result;
  });

export const getAuditLogKpi = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    await requireAdmin(accessToken);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [eventsTodayRes, events7dRes, recentErrorsRes] = await Promise.all([
      supabaseAdmin
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
      supabaseAdmin
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      supabaseAdmin
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", oneDayAgo)
        .eq("severity", "critical"),
    ]);

    return {
      eventsToday: eventsTodayRes.count ?? 0,
      events7d: events7dRes.count ?? 0,
      recentErrors: recentErrorsRes.count ?? 0,
    };
  });

export const getAuditLogUsers = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    await requireAdmin(accessToken);

    const { data, error } = await supabaseAdmin
      .from("activity_log")
      .select("actor_name")
      .not("actor_name", "is", null)
      .order("actor_name", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const seen = new Map<string, number>();
    for (const row of rows) {
      if (row.actor_name) {
        seen.set(row.actor_name, (seen.get(row.actor_name) ?? 0) + 1);
      }
    }

    return Array.from(seen.entries()).map(([actor_name, count]) => ({
      actor_name,
      count,
    }));
  });

export const getCriticalEvents = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string; limit?: number }) => data)
  .handler(async ({ data: { accessToken, limit = 5 } }) => {
    await requireAdmin(accessToken);

    const { data, error } = await supabaseAdmin
      .from("activity_log_dedup" as any)
      .select(
        `
        id,
        type,
        action_type,
        entity_type,
        entity_id,
        severity,
        message,
        ticket_id,
        actor_id,
        created_at,
        actor_name
      `,
      )
      .eq("severity", "critical")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []) as any[];

    return rows.map((row: any) => ({
      id: row.id,
      type: row.type as ActivityLogEntry["type"],
      action_type: row.action_type ?? null,
      entity_type: row.entity_type ?? null,
      entity_id: row.entity_id ?? null,
      severity: row.severity ?? "critical",
      message: row.message,
      ticket_id: row.ticket_id,
      actor_id: row.actor_id,
      created_at: row.created_at,
      actor_name: row.actor_name || "Sistema",
    }));
  });

export const exportAuditLog = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string; filters?: AuditLogFilters }) => data)
  .handler(async ({ data: { accessToken, filters } }) => {
    await requireAdmin(accessToken);

    let query = supabaseAdmin
      .from("activity_log_dedup" as any)
      .select(
        `
        id,
        type,
        action_type,
        entity_type,
        entity_id,
        severity,
        message,
        ticket_id,
        actor_id,
        created_at,
        actor_name
      `,
      )
      .order("created_at", { ascending: false });

    if (filters?.search) {
      query = query.or(`actor_name.ilike.%${filters.search}%,message.ilike.%${filters.search}%`);
    }

    if (filters?.user) {
      query = query.ilike("actor_name", `%${filters.user}%`);
    }

    if (filters?.actionType) {
      query = query.eq("action_type", filters.actionType);
    }

    if (filters?.outcome) {
      query = query.eq("severity", filters.outcome);
    }

    if (filters?.entityType) {
      query = query.eq("entity_type", filters.entityType);
    }

    if (filters?.dateFrom) {
      query = query.gte("created_at", filters.dateFrom);
    }

    if (filters?.dateTo) {
      query = query.lte("created_at", filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows2 = (data ?? []) as any[];

    // Deduplicate rows (same message and same second)
    const seen = new Set<string>();
    const dedup: any[] = [];
    for (const row of rows2) {
      const key = `${row.message}|${String(row.created_at).slice(0, 19)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(row);
    }

    // Generate CSV with extended columns
    const csvHeader = "Data,Ora,Utente,Tipo,Azione,Dettaglio,Entita,ID Entita,Ticket,Esito\n";
    const csvRows = dedup
      .map((row: any) => {
        const date = new Date(row.created_at);
        const dateStr = date.toLocaleDateString("it-IT");
        const timeStr = date.toLocaleTimeString("it-IT");
        const actor = row.actor_name || "Sistema";
        const type = row.type === "sys" ? "Sistema" : row.type === "auto" ? "Automatico" : "Utente";
        const message = `"${(row.message || "").replace(/"/g, '""')}"`;
        const actionType = row.action_type || "";
        const entityType = row.entity_type || "";
        const entityId = row.entity_id || "";
        const ticket = row.ticket_id || "";
        const severity = row.severity || "info";

        return `${dateStr},${timeStr},${actor},${type},${actionType},${message},${entityType},${entityId},${ticket},${severity}`;
      })
      .join("\n");

    const csv = csvHeader + csvRows;

    return {
      csv,
      filename: buildDownloadFileName("pcready-audit-log", "csv", { dated: true }),
    };
  });

// ---- Audit Presets ----

/**
 *
 */
export type AuditPreset = {
  id: string;
  name: string;
  filters: AuditLogFilters;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const listAuditPresets = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const userId = await requireAdmin(accessToken);

    const { data, error } = await supabaseAdmin
      .from("audit_presets" as any)
      .select("id, name, filters, user_id, created_at, updated_at")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error) throw error;

    return (data ?? []) as unknown as AuditPreset[];
  });

export const saveAuditPreset = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; name: string; filters: AuditLogFilters }) => data)
  .handler(async ({ data: { accessToken, name, filters } }) => {
    const userId = await requireAdmin(accessToken);

    const { data: existing } = await supabaseAdmin
      .from("audit_presets" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("audit_presets" as any)
        .update({ filters: filters as any, updated_at: new Date().toISOString() })
        .eq("id", (existing as any).id)
        .select("id, name, filters, user_id, created_at, updated_at")
        .single();

      if (error) throw error;
      return data as unknown as AuditPreset;
    }

    const { data, error } = await supabaseAdmin
      .from("audit_presets" as any)
      .insert({ name, filters: filters as any, user_id: userId })
      .select("id, name, filters, user_id, created_at, updated_at")
      .single();

    if (error) throw error;
    return data as unknown as AuditPreset;
  });

export const deleteAuditPreset = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; presetId: string }) => data)
  .handler(async ({ data: { accessToken, presetId } }) => {
    const userId = await requireAdmin(accessToken);

    const { error } = await supabaseAdmin
      .from("audit_presets" as any)
      .delete()
      .eq("id", presetId)
      .eq("user_id", userId);

    if (error) throw error;

    return { ok: true };
  });
