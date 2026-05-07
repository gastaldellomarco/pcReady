import { FlaskConical } from "lucide-react";
import type { AutomationRunLog } from "@/lib/automation-runs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RunStatusBadge } from "./RunLogDrawer";

interface DryRunDialogProps {
  open: boolean;
  run: AutomationRunLog | null;
  onOpenChange: (open: boolean) => void;
}

export function DryRunDialog({ open, run, onOpenChange }: DryRunDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Risultato dry-run
          </DialogTitle>
        </DialogHeader>
        {!run ? (
          <div className="py-8 text-center text-sm text-text3">Nessun risultato disponibile</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <RunStatusBadge status={run.status} isDryRun={run.is_dry_run} />
              <span className="text-sm text-text3">{run.duration_ms ?? 0} ms</span>
            </div>
            {run.error_message && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {run.error_message}
              </div>
            )}
            <div className="space-y-2">
              {(run.actions_executed ?? []).map((action, index) => (
                <div key={`${action.action}-${index}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{action.action}</div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono">
                      {action.status}
                    </span>
                  </div>
                  {action.error && <div className="mt-2 text-sm text-red-700">{action.error}</div>}
                  {action.result !== undefined && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-100 p-2 font-mono text-xs">
                      {JSON.stringify(action.result, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
