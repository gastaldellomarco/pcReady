import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./admin-users.server";

export type ActivityLogEntry = {
  id: string;
  type: "sys" | "auto" | "user";
  message: string;
  ticket_id: string | null;
  actor_id: string | null;
  created_at: string;
  actor_name?: string;
};

export type AuditLogFilters = {
  user?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const getAuditLog = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string; page?: number; pageSize?: number; filters?: AuditLogFilters }) => data)
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

    if (filters?.user) {
      baseQuery = baseQuery.ilike("actor_name", `%${filters.user}%`);
    }

    if (filters?.actionType) {
      baseQuery = baseQuery.eq("type", filters.actionType);
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
      message: row.message,
      ticket_id: row.ticket_id,
      actor_id: row.actor_id,
      created_at: row.created_at,
      actor_name: row.actor_name || "Sistema",
    }));

    return {
      entries,
      total,
      page,
      pageSize,
      totalPages,
    };
  });

export const exportAuditLog = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string; filters?: AuditLogFilters }) => data)
  .handler(async ({ data: { accessToken, filters } }) => {
    await requireAdmin(accessToken);

    let query = supabaseAdmin
      .from("activity_log")
      .select(`
        id,
        type,
        message,
        ticket_id,
        actor_id,
        created_at,
        profiles!activity_log_actor_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false });

    if (filters?.user) {
      query = query.ilike("profiles.full_name", `%${filters.user}%`);
    }

    if (filters?.actionType) {
      query = query.eq("type", filters.actionType);
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

    // Generate CSV
    const csvHeader = "Data,Ora,Utente,Tipo,Azione,Ticket\n";
    const csvRows = dedup.map((row: any) => {
      const date = new Date(row.created_at);
      const dateStr = date.toLocaleDateString("it-IT");
      const timeStr = date.toLocaleTimeString("it-IT");
      const actor = row.profiles?.full_name || "Sistema";
      const type = row.type === "sys" ? "Sistema" : row.type === "auto" ? "Automatico" : "Utente";
      const message = `"${(row.message || "").replace(/"/g, '""')}"`;
      const ticket = row.ticket_id || "";

      return `${dateStr},${timeStr},${actor},${type},${message},${ticket}`;
    }).join("\n");

    const csv = csvHeader + csvRows;

    return {
      csv,
      filename: `audit-log-${new Date().toISOString().split("T")[0]}.csv`,
    };
  });