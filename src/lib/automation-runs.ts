import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type RunLogStatus = "success" | "error" | "dry_run" | "skipped";
export type ActionResultStatus = "success" | "error" | "skipped";
export type HealthStatus = "healthy" | "degraded" | "failing" | "never_run";

export interface ActionResult {
  action: string;
  status: ActionResultStatus;
  result?: unknown;
  error?: string;
}

export interface AutomationRunLog {
  id: string;
  automation_id: string;
  triggered_at: string;
  triggered_by: string | null;
  status: RunLogStatus;
  duration_ms: number | null;
  trigger_payload: Record<string, unknown> | null;
  actions_executed: ActionResult[] | null;
  error_message: string | null;
  is_dry_run: boolean;
}

export interface AutomationRunStats {
  automation_id: string;
  success: number;
  error: number;
  dry_run: number;
  skipped: number;
  health: HealthStatus;
  recent: Pick<AutomationRunLog, "status">[];
}

export interface AutomationDashboardKpis {
  activeAutomations: number;
  runsToday: number;
  successToday: number;
  errorToday: number;
  successRate7d: number;
  automationsWithRecentErrors: number;
}

const AuthedSchema = z.object({ accessToken: z.string() });
const AutomationInputSchema = AuthedSchema.extend({
  automationId: z.string().uuid(),
});
const RunInputSchema = AutomationInputSchema.extend({
  isDryRun: z.boolean(),
  triggerPayload: z.record(z.unknown()).optional(),
});

export const listAutomationRunLogs = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof AutomationInputSchema>) => data)
  .handler(async ({ data }) => {
    const input = AutomationInputSchema.parse(data);
    const { requireAutomationRunnerUser, supabaseAdmin } = await import("./automation-runs.server");
    await requireAutomationRunnerUser(input.accessToken);

    const { data: rows, error } = await supabaseAdmin
      .from("automation_run_logs" as any)
      .select("*")
      .eq("automation_id", input.automationId)
      .order("triggered_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (rows ?? []) as AutomationRunLog[];
  });

export const runAutomationNow = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof RunInputSchema>) => data)
  .handler(async ({ data }) => {
    const input = RunInputSchema.parse(data);
    const { executeAutomationRun, requireAutomationRunnerUser } = await import(
      "./automation-runs.server"
    );
    const user = await requireAutomationRunnerUser(input.accessToken);
    return executeAutomationRun({
      automationId: input.automationId,
      triggeredBy: user.id,
      isDryRun: input.isDryRun,
      triggerPayload: input.triggerPayload,
    });
  });

export const getAutomationRunStats = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof AuthedSchema>) => data)
  .handler(async ({ data }) => {
    const input = AuthedSchema.parse(data);
    const { computeHealth, requireAutomationRunnerUser, supabaseAdmin } = await import(
      "./automation-runs.server"
    );
    await requireAutomationRunnerUser(input.accessToken);

    const { data: flows, error: flowsError } = await supabaseAdmin
      .from("automation_flows" as any)
      .select("id, active");
    if (flowsError) throw flowsError;

    const { data: logs, error: logsError } = await supabaseAdmin
      .from("automation_run_logs" as any)
      .select("automation_id, status, triggered_at")
      .order("triggered_at", { ascending: false });
    if (logsError) throw logsError;

    const byAutomation = new Map<string, any[]>();
    (logs ?? []).forEach((log: any) => {
      const arr = byAutomation.get(log.automation_id) ?? [];
      arr.push(log);
      byAutomation.set(log.automation_id, arr);
    });

    const stats: Record<string, AutomationRunStats> = {};
    (flows ?? []).forEach((flow: any) => {
      const rows = byAutomation.get(flow.id) ?? [];
      stats[flow.id] = {
        automation_id: flow.id,
        success: rows.filter((row) => row.status === "success").length,
        error: rows.filter((row) => row.status === "error").length,
        dry_run: rows.filter((row) => row.status === "dry_run").length,
        skipped: rows.filter((row) => row.status === "skipped").length,
        health: computeHealth(rows.slice(0, 5)),
        recent: rows.slice(0, 5).map((row) => ({ status: row.status })),
      };
    });

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayRows = (logs ?? []).filter(
      (log: any) => new Date(log.triggered_at).getTime() >= todayStart.getTime(),
    );
    const sevenDayRows = (logs ?? []).filter(
      (log: any) => new Date(log.triggered_at).getTime() >= sevenDaysAgo.getTime(),
    );
    const sevenDaySuccess = sevenDayRows.filter((log: any) => log.status === "success").length;
    const sevenDayErrors = sevenDayRows.filter((log: any) => log.status === "error").length;
    const successRateBase = sevenDaySuccess + sevenDayErrors;

    const kpis: AutomationDashboardKpis = {
      activeAutomations: (flows ?? []).filter((flow: any) => flow.active).length,
      runsToday: todayRows.length,
      successToday: todayRows.filter((log: any) => log.status === "success").length,
      errorToday: todayRows.filter((log: any) => log.status === "error").length,
      successRate7d: successRateBase ? Math.round((sevenDaySuccess / successRateBase) * 100) : 100,
      automationsWithRecentErrors: Object.values(stats).filter((item) =>
        item.recent.some((log) => log.status === "error"),
      ).length,
    };

    return { stats, kpis };
  });
