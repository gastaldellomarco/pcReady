import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import type {
  ActionResult,
  AutomationRunLog,
  HealthStatus,
  RunLogStatus,
} from "@/lib/automation-runs";

export { supabaseAdmin };

interface ExecuteAutomationInput {
  automationId: string;
  triggeredBy: string;
  isDryRun: boolean;
  triggerPayload?: Record<string, any>;
}

export async function requireAutomationRunnerUser(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Non autenticato", { status: 401 });

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .in("role", ["admin", "tech"])
    .maybeSingle();
  if (roleError) throw roleError;
  if (!role) throw new Response("Permessi insufficienti", { status: 403 });

  return data.user;
}

export async function executeAutomationRun({
  automationId,
  triggeredBy,
  isDryRun,
  triggerPayload = {},
}: ExecuteAutomationInput) {
  const started = Date.now();
  const { data: flow, error } = await supabaseAdmin
    .from("automation_flows" as any)
    .select("id, name, active, flow_definition, actions_definition, trigger_definition")
    .eq("id", automationId)
    .single();
  if (error) throw error;

  const flowAny = flow as any;
  const actions = extractActions(flowAny);
  const trigger =
    flowAny.trigger_definition || flowAny.flow_definition?.meta?.wizard?.trigger_definition || null;
  let status: RunLogStatus = isDryRun ? "dry_run" : "success";
  let errorMessage: string | null = null;
  let actionsExecuted: ActionResult[] = [];

  try {
    if (!trigger && !flowAny.flow_definition?.nodes?.length) {
      throw new Error("Flow senza trigger o nodi validi");
    }

    if (!actions.length) {
      status = "skipped";
      actionsExecuted = [
        {
          action: "validate_flow",
          status: "skipped",
          result: { reason: "Nessuna action configurata" },
        },
      ];
    } else {
      actionsExecuted = actions.map((action, index) => simulateAction(action, index, isDryRun));
      const failed = actionsExecuted.find((action) => action.status === "error");
      if (failed) throw new Error(failed.error || "Action fallita");
    }
  } catch (runError) {
    status = "error";
    errorMessage = runError instanceof Error ? runError.message : "Errore esecuzione automazione";
    if (!actionsExecuted.length) {
      actionsExecuted = [
        {
          action: "validate_flow",
          status: "error",
          error: errorMessage,
        },
      ];
    }
  }

  const durationMs = Date.now() - started;
  const { data: log, error: insertError } = await supabaseAdmin
    .from("automation_run_logs" as any)
    .insert({
      automation_id: automationId,
      triggered_by: triggeredBy,
      status,
      duration_ms: durationMs,
      trigger_payload: triggerPayload,
      actions_executed: actionsExecuted,
      error_message: errorMessage,
      is_dry_run: isDryRun,
    })
    .select("*")
    .single();
  if (insertError) throw insertError;

  await supabaseAdmin
    .from("automation_flows" as any)
    .update({
      last_run_at: new Date().toISOString(),
      flow_definition: {
        ...(flowAny.flow_definition || {}),
        meta: {
          ...(flowAny.flow_definition?.meta || {}),
          last_run_at: new Date().toISOString(),
          last_run_status: status,
        },
      },
    })
    .eq("id", automationId);

  if (status === "error") {
    await notifyAutomationFailure({
      flowId: automationId,
      flowName: flowAny.name,
      error: errorMessage || "Errore automazione",
    });
  }

  return log as unknown as AutomationRunLog;
}

export async function notifyAutomationFailure({
  flowId,
  flowName,
  error,
}: {
  flowId?: string | null;
  flowName: string;
  error: string;
}) {
  await createNotificationForAdmins({
    type: "automation_failed",
    title: `Automazione fallita: ${flowName}`,
    body: error,
    payload: { flow_id: flowId ?? null, flow_name: flowName },
    link: "/automations",
  });
}

export function computeHealth(logs: Pick<AutomationRunLog, "status">[]): HealthStatus {
  if (!logs.length) return "never_run";
  const lastThree = logs.slice(0, 3);
  if (lastThree.length === 3 && lastThree.every((log) => log.status === "error")) return "failing";
  const lastFive = logs.slice(0, 5);
  if (lastFive.some((log) => log.status === "error")) return "degraded";
  if (lastFive.every((log) => log.status === "success")) return "healthy";
  return "degraded";
}

function extractActions(flow: any) {
  const fromColumn = Array.isArray(flow.actions_definition) ? flow.actions_definition : null;
  if (fromColumn?.length) return fromColumn;

  const wizardActions = flow.flow_definition?.meta?.wizard?.actions_definition;
  if (Array.isArray(wizardActions) && wizardActions.length) return wizardActions;

  const nodeActions = flow.flow_definition?.nodes
    ?.filter((node: any) => node.type === "action")
    .map((node: any) => ({
      type: node.data?.label || "action",
      config: node.data?.config || {},
    }));
  return Array.isArray(nodeActions) ? nodeActions : [];
}

function simulateAction(action: any, index: number, isDryRun: boolean): ActionResult {
  const actionName = String(
    action.type || action.action || action.data?.label || `Action ${index + 1}`,
  );
  if (action.config?.force_error || action.force_error) {
    return {
      action: actionName,
      status: "error",
      error: "Errore simulato dalla configurazione action",
    };
  }

  return {
    action: actionName,
    status: "success",
    result: isDryRun
      ? { mode: "dry_run", message: "Azione validata, nessun effetto applicato" }
      : { mode: "manual_run", message: "Azione registrata dal runtime controllato" },
  };
}
