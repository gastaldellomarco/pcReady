import { Activity, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import type { AutomationRule } from "@/types/automation";
import type { AutomationDashboardKpis } from "@/lib/automation-runs";
import { AutomationKpiCard } from "./AutomationKpiCard";

export function AutomationKpiHeader({
  rules,
  kpis,
}: {
  rules: AutomationRule[];
  kpis: AutomationDashboardKpis | null;
}) {
  const activeCount = rules.filter((r) => r.active).length;
  const inactiveCount = rules.length - activeCount;
  const totalCount = rules.length;
  const rulesWithErrors = kpis?.automationsWithRecentErrors ?? 0;
  const runsToday = kpis?.runsToday ?? 0;
  const successRate = kpis?.successRate7d ?? 100;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <AutomationKpiCard
        label="Regole totali"
        value={totalCount}
        icon={<Zap className="h-4 w-4" />}
        color="blue"
      />
      <AutomationKpiCard
        label="Attive / Inattive"
        value={`${activeCount} / ${inactiveCount}`}
        icon={<CheckCircle className="h-4 w-4" />}
        color="green"
      />
      <AutomationKpiCard
        label="Esecuzioni 24h"
        value={runsToday}
        icon={<Activity className="h-4 w-4" />}
        color={runsToday > 0 ? "green" : "default"}
      />
      <AutomationKpiCard
        label="Regole con errori"
        value={rulesWithErrors}
        icon={<AlertTriangle className="h-4 w-4" />}
        color={rulesWithErrors > 0 ? "red" : "default"}
        trend={successRate}
      />
    </div>
  );
}
