import { cn } from "@/lib/utils";
import {
  Ticket,
  ClipboardCheck,
  Clock,
  MousePointerClick,
  AlertTriangle,
  Siren,
} from "lucide-react";
import type { TriggerDef } from "@/types/automation";

const TRIGGER_OPTIONS = [
  {
    value: "ticket_created",
    label: "Ticket creato",
    description: "Quando un nuovo ticket viene aperto",
    icon: Ticket,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
  },
  {
    value: "ticket_updated",
    label: "Ticket aggiornato",
    description: "Quando un ticket esistente viene modificato",
    icon: Ticket,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 border-indigo-200",
  },
  {
    value: "checklist_completed",
    label: "Checklist completata",
    description: "Quando una checklist di preparazione viene completata",
    icon: ClipboardCheck,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 border-cyan-200",
  },
  {
    value: "sla_warning",
    label: "SLA in scadenza",
    description: "Quando un ticket si avvicina alla scadenza SLA",
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
  },
  {
    value: "sla_breached",
    label: "SLA violato",
    description: "Quando un ticket supera la scadenza SLA",
    icon: Siren,
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
  },
  {
    value: "scheduled",
    label: "Schedulato",
    description: "Esecuzione pianificata con espressione cron",
    icon: Clock,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
  },
  {
    value: "manual",
    label: "Manuale",
    description: "Eseguita solo manualmente o da un trigger esterno",
    icon: MousePointerClick,
    color: "text-slate-600",
    bgColor: "bg-slate-50 border-slate-200",
  },
];

export default function TriggerStep({
  value,
  onChange,
}: {
  value: TriggerDef | null;
  onChange: (v: TriggerDef) => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Trigger</h3>
      <p className="text-sm text-text3">
        Scegli l&apos;evento che attivera questa regola di automazione.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {TRIGGER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value?.type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ type: opt.value as TriggerDef["type"], config: {} })}
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                isSelected
                  ? `${opt.bgColor} ${opt.color} border-current shadow-sm`
                  : "border-border bg-background hover:border-accent/40 hover:bg-accent/5",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? `${opt.bgColor}` : "bg-surface2",
                )}
              >
                <Icon className={cn("h-5 w-5", isSelected ? opt.color : "text-text3")} />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isSelected ? opt.color : "text-foreground",
                  )}
                >
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs text-text3 leading-relaxed">{opt.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {value?.type === "scheduled" && (
        <div className="mt-4">
          <label className="text-sm font-medium">Espressione Cron</label>
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            value={(value.config?.cron as string) ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                config: { ...(value.config || {}), cron: e.target.value },
              })
            }
            placeholder="es. 0 8 * * * (ogni giorno alle 8:00)"
          />
          <p className="mt-1 text-xs text-text3">
            Formato standard cron a 5 campi: minuto ora giorno mese giorno-settimana
          </p>
        </div>
      )}
    </div>
  );
}
