import { CheckCircle, FlaskConical, Loader2, MinusCircle, XCircle, Ban } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { AutomationRule } from "@/types/automation";
import { executeDryRun, type DryRunResult, type DryRunStep } from "@/lib/automation-runs";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DryRunDialogProps {
  open: boolean;
  rule: AutomationRule | null;
  onOpenChange: (open: boolean) => void;
}

export function DryRunDialog({ open, rule, onOpenChange }: DryRunDialogProps) {
  const { session } = useAuth();
  const runDryRun = useServerFn(executeDryRun);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [running, setRunning] = useState(false);

  async function handleRunDryRun() {
    if (!rule || !session?.access_token) return;
    setRunning(true);
    try {
      const data = await runDryRun({
        data: { flowId: rule.id, accessToken: session.access_token },
      });
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dry-run non riuscito");
    } finally {
      setRunning(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) setResult(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-blue-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-600" />
            Test (Dry-Run)
            {rule?.name && (
              <>
                <span className="text-muted-foreground font-normal">:</span>
                <span className="font-normal">{rule.name}</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Clear dry-run indicator */}
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <Ban className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <Badge className="bg-blue-600 text-white text-[10px] uppercase border-transparent mb-1">
              Simulazione — nessuna azione reale
            </Badge>
            <p className="text-xs text-blue-700">
              Questa esecuzione simulata mostra il percorso che l&apos;automazione seguirebbe
              senza applicare modifiche reali. Ideale per verificare la configurazione prima
              di un&apos;esecuzione effettiva.
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Button variant="outline" onClick={handleRunDryRun} disabled={!rule || running} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            Simula esecuzione (dry-run)
          </Button>
          {!result && (
            <div className="py-6 text-center text-sm text-text3">
              Avvia la simulazione per vedere trigger, condizioni e azioni step-by-step.
            </div>
          )}
          {result && (
            <div className="space-y-3">
              <div className="text-sm text-text3">Esito simulazione: {result.summary}</div>
              <div className="space-y-2">
                {result.steps
                  .filter((step): step is DryRunStep => step != null)
                  .map((step) => (
                    <DryRunStepCard key={`${step.stepIndex}-${step.type}`} step={step} />
                  ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DryRunStepCard({ step }: { step: DryRunStep }) {
  const result = step?.result ?? "error";
  const Icon =
    result === "pass" ? CheckCircle : result === "skip" ? MinusCircle : XCircle;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        result === "pass" && "border-green-200 bg-green-50",
        result === "skip" && "border-yellow-200 bg-yellow-50",
        result === "error" && "border-red-200 bg-red-50",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5",
          result === "pass" && "text-green-600",
          result === "skip" && "text-yellow-600",
          result === "error" && "text-red-600",
        )}
      />
      <div>
        <p className="text-sm font-medium">{step?.label ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{step?.detail ?? ""}</p>
      </div>
    </div>
  );
}
