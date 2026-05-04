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
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

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

    const { data, error, count } = await query;

    if (error) throw error;

    const rows = (data ?? []) as any[];
    const entries: ActivityLogEntry[] = rows.map((row: any) => ({
      id: row.id,
      type: row.type as ActivityLogEntry["type"],
      message: row.message,
      ticket_id: row.ticket_id,
      actor_id: row.actor_id,
      created_at: row.created_at,
      actor_name: row.profiles?.full_name || "Sistema",
    }));

    return {
      entries,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
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

    // Generate CSV
    const csvHeader = "Data,Ora,Utente,Tipo,Azione,Ticket\n";
    const rows2 = (data ?? []) as any[];
    const csvRows = rows2.map((row: any) => {
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