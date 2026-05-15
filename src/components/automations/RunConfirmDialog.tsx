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
import { cn } from "@/lib/utils";
import type { AutomationRule } from "@/types/automation";
import {
  computeRiskLevel,
  checkCompleteness,
  getImpactDescription,
  getSideEffects,
  RISK_LEVEL_CONFIG,
} from "@/lib/automations/automation-guardrails";
import { AlertTriangle, Info, Play, ShieldAlert, ListChecks } from "lucide-react";

interface RunConfirmDialogProps {
  open: boolean;
  rule: AutomationRule | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function RunConfirmDialog({
  open,
  rule,
  onOpenChange,
  onConfirm,
  loading,
}: RunConfirmDialogProps) {
  if (!rule) return null;

  const riskLevel = computeRiskLevel(rule);
  const completeness = checkCompleteness(rule);
  const impacts = getImpactDescription(rule);
  const sideEffects = getSideEffects(rule);
  const riskCfg = RISK_LEVEL_CONFIG[riskLevel];

  const canRun = completeness.complete;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-accent" />
            Esecuzione: {rule.name}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Verifica l'impatto previsto prima di eseguire questa automazione.
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
            <ShieldAlert className={cn("h-5 w-5", riskCfg.color)} />
            <div className="flex-1">
              <span className={cn("text-sm font-semibold", riskCfg.color)}>
                Rischio: {riskCfg.label}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {riskLevel === "critical"
                  ? "Automazione schedulata con azioni ad alto impatto. Prestare massima attenzione."
                  : riskLevel === "high"
                    ? "Automazione con azioni che modificano dati sensibili."
                    : riskLevel === "medium"
                      ? "Automazione con azioni che generano notifiche o comunicazioni."
                      : "Automazione a basso impatto, prevalentemente informativa."}
              </p>
            </div>
          </div>

          {/* Completeness Warning */}
          {!canRun && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-700">
                  Regola incompleta — esecuzione bloccata
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-red-600">
                  {completeness.missing.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Impact Preview */}
          {canRun && impacts.length > 0 && (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ListChecks className="h-4 w-4 text-text3" />
                <span className="text-xs font-semibold uppercase tracking-wide text-text3">
                  Impatto previsto
                </span>
              </div>
              <ul className="space-y-1">
                {impacts.map((impact, i) => (
                  <li
                    key={i}
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
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-700">
                  Side-effect esterni
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-amber-600">
                  {sideEffects.map((effect, i) => (
                    <li key={i}>{effect}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <Separator />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Annulla</AlertDialogCancel>
          <Button
            variant={riskLevel === "high" || riskLevel === "critical" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={!canRun || loading}
            className="gap-1.5"
          >
            {loading ? (
              "Esecuzione in corso..."
            ) : (
              <>
                <Play className="h-4 w-4" />
                Esegui ora
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
