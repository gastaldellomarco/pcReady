import { AlertTriangle, Info, Play, ShieldAlert, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  computeRiskLevel,
  checkCompleteness,
  getImpactDescription,
  getSideEffects,
  RISK_LEVEL_CONFIG,
} from "@/lib/automations/automation-guardrails";
import { cn } from "@/lib/utils";
import type { AutomationRule } from "@/types/automation";

interface RunConfirmDialogProps {
  open: boolean;
  rule: AutomationRule | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

/**
 *
 */
export function RunConfirmDialog({
  open,
  rule,
  onOpenChange,
  onConfirm,
  loading,
}: RunConfirmDialogProps) {
  const { t } = useTranslation("automations");

  if (!rule) return null;

  const riskLevel = computeRiskLevel(rule);
  const completeness = checkCompleteness(rule);
  const impacts = getImpactDescription(rule);
  const sideEffects = getSideEffects(rule);
  const riskCfg = RISK_LEVEL_CONFIG[riskLevel];

  const canRun = completeness.complete;

  const riskDescriptions: Record<string, string> = {
    critical: t("runConfirm.riskDescriptions.critical", "Scheduled automation with high-impact actions. Proceed with extreme caution."),
    high: t("runConfirm.riskDescriptions.high", "Automation with actions that modify sensitive data."),
    medium: t("runConfirm.riskDescriptions.medium", "Automation with actions that generate notifications or communications."),
    low: t("runConfirm.riskDescriptions.low", "Low-impact automation, primarily informational."),
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Play className="size-5 text-accent" />
            {t("runConfirm.title", "Execution: {{name}}", { name: rule.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("runConfirm.description", "Verify the expected impact before running this automation.")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Risk Level Badge */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border p-3",
              riskCfg.bg,
              riskCfg.border,
            )}
          >
            <ShieldAlert className={cn("size-5", riskCfg.color)} />
            <div className="flex-1">
              <span className={cn("text-sm font-semibold", riskCfg.color)}>
                {t("runConfirm.riskLabel", "Risk: {{level}}", { level: riskCfg.label })}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {riskDescriptions[riskLevel]}
              </p>
            </div>
          </div>

          {/* Completeness Warning */}
          {!canRun && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  {t("runConfirm.incomplete", "Incomplete rule — execution blocked")}
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-red-600">
                  {completeness.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Impact Preview */}
          {canRun && impacts.length > 0 && (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ListChecks className="size-4 text-text3" />
                <span className="text-xs font-semibold uppercase tracking-wide text-text3">
                  {t("runConfirm.expectedImpact", "Expected impact")}
                </span>
              </div>
              <ul className="space-y-1">
                {impacts.map((impact) => (
                  <li
                    key={impact}
                    className={cn(
                      "text-sm",
                      impact.startsWith("  →") ? "pl-4 text-muted-foreground" : "font-medium",
                    )}
                  >
                    {impact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Side Effects Warning */}
          {canRun && sideEffects.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700">{t("runConfirm.sideEffects", "External side effects")}</p>
                <ul className="mt-1 list-inside list-disc text-xs text-amber-600">
                  {sideEffects.map((effect) => (
                    <li key={effect}>{effect}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("runConfirm.cancel", "Cancel")}</AlertDialogCancel>
          <Button
            variant={riskLevel === "high" || riskLevel === "critical" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={!canRun || loading}
            className="gap-1.5"
          >
            {loading ? (
              t("runConfirm.running", "Running...")
            ) : (
              <>
                <Play className="size-4" />
                {t("runConfirm.execute", "Run now")}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
