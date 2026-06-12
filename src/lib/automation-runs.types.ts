// ─── Constants ────────────────────────────────────────────────────────

export const AUTOMATION_RUN_LOG_SELECT =
  "id, automation_id, triggered_at, triggered_by, status, duration_ms, trigger_payload, actions_executed, error_message, is_dry_run";

// ─── Status types ──────────────────────────────────────────────────────

export type RunLogStatus = "success" | "error" | "dry_run" | "skipped";

export type ActionResultStatus = "success" | "error" | "skipped";

export type HealthStatus = "healthy" | "degraded" | "failing" | "never_run";

// ─── Result types ──────────────────────────────────────────────────────

export interface ActionResult {
  action: string;
  status: ActionResultStatus;
  blockId?: string;
  blockType?: "trigger" | "condition" | "action";
  input?: Record<string, any>;
  /** Structured outcome (es. id aggiornati, canale email usato) */
  details?: Record<string, any>;
  result?: any;
  error?: string;
}

export interface DryRunStep {
  stepIndex: number;
  type: "trigger" | "condition" | "action";
  label: string;
  result: "pass" | "skip" | "error";
  detail: string;
}

export interface DryRunResult {
  steps: DryRunStep[];
  summary: "success" | "blocked" | "error";
}

export interface AutomationRunLog {
  id: string;
  automation_id: string;
  triggered_at: string;
  triggered_by: string | null;
  status: RunLogStatus;
  duration_ms: number | null;
  trigger_payload: Record<string, any> | null;
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
