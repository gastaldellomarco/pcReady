import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface DashboardMonthMetric {
  month: string;
  label: string;
  opened: number;
  closed: number;
  avg_days: number | null;
}

export interface TechnicianKpi {
  technician_id: string | null;
  full_name: string;
  assigned: number;
  completed: number;
  avg_days: number | null;
}

export interface DashboardAnalytics {
  ticketsByMonth: DashboardMonthMetric[];
  technicianKpi: TechnicianKpi[];
  summary: {
    opened: number;
    closed: number;
    avgDays: number | null;
  };
}

const AnalyticsInputSchema = z.object({
  accessToken: z.string().min(1),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: z.input<typeof AnalyticsInputSchema>) => AnalyticsInputSchema.parse(data))
  .handler(async ({ data }): Promise<DashboardAnalytics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const [monthlyRes, technicianRes] = await Promise.all([
      supabaseAdmin.rpc("get_tickets_by_month" as any, {
        date_from: data.dateFrom,
        date_to: data.dateTo,
      }),
      supabaseAdmin.rpc("get_technician_kpi" as any, {
        date_from: data.dateFrom,
        date_to: data.dateTo,
      }),
    ]);

    if (monthlyRes.error) throw monthlyRes.error;
    if (technicianRes.error) throw technicianRes.error;

    const ticketsByMonth = ((monthlyRes.data ?? []) as any[]).map((row) => {
      const month = String(row.month);
      return {
        month,
        label: new Date(month).toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        opened: Number(row.opened ?? 0),
        closed: Number(row.closed ?? 0),
        avg_days: row.avg_days == null ? null : Number(row.avg_days),
      };
    });

    const technicianKpi = ((technicianRes.data ?? []) as any[]).map((row) => ({
      technician_id: row.technician_id ?? null,
      full_name: row.full_name || "Non assegnato",
      assigned: Number(row.assigned ?? 0),
      completed: Number(row.completed ?? 0),
      avg_days: row.avg_days == null ? null : Number(row.avg_days),
    }));

    const opened = ticketsByMonth.reduce((sum, row) => sum + row.opened, 0);
    const closed = ticketsByMonth.reduce((sum, row) => sum + row.closed, 0);
    const avgValues = ticketsByMonth
      .map((row) => row.avg_days)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    return {
      ticketsByMonth,
      technicianKpi,
      summary: {
        opened,
        closed,
        avgDays: avgValues.length
          ? Number((avgValues.reduce((sum, value) => sum + value, 0) / avgValues.length).toFixed(2))
          : null,
      },
    };
  });
