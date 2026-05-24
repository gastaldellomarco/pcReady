import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Ticket,
  ClipboardCheck,
  Clock,
  MousePointerClick,
  AlertTriangle,
  Siren,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import type { TriggerDef } from "@/types/automation";

interface EventStepProps {
  value: TriggerDef | null;
  onChange: (v: TriggerDef) => void;
}

export default function EventStep({ value, onChange }: EventStepProps) {
  const { t } = useTranslation("automations");

  const TRIGGER_OPTIONS = [
    {
      value: "ticket_created" as const,
      label: t("eventStep.options.ticket_created", "Nuovo ticket"),
      example: t(
        "eventStep.examples.ticket_created",
        "Quando viene creato un nuovo ticket"
      ),
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
    },
    {
      value: "ticket_updated" as const,
      label: t("eventStep.options.ticket_updated", "Ticket aggiornato"),
      example: t(
        "eventStep.examples.ticket_updated",
        "Quando un ticket esistente viene modificato"
      ),
      icon: Ticket,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 border-indigo-200",
    },
    {
      value: "checklist_completed" as const,
      label: t("eventStep.options.checklist_completed", "Checklist completata"),
      example: t(
        "eventStep.examples.checklist_completed",
        "Quando una checklist di preparazione viene completata"
      ),
      icon: ClipboardCheck,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 border-cyan-200",
    },
    {
      value: "sla_warning" as const,
      label: t("eventStep.options.sla_warning", "SLA in scadenza"),
      example: t(
        "eventStep.examples.sla_warning",
        "Quando un ticket si avvicina alla scadenza SLA"
      ),
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 border-amber-200",
    },
    {
      value: "sla_breached" as const,
      label: t("eventStep.options.sla_breached", "SLA violato"),
      example: t(
        "eventStep.examples.sla_breached",
        "Quando un ticket supera la scadenza SLA"
      ),
      icon: Siren,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
    },
    {
      value: "warranty_expiring_soon" as const,
      label: t("eventStep.options.warranty_expiring_soon", "Garanzia in scadenza"),
      example: t(
        "eventStep.examples.warranty_expiring_soon",
        "Quando la garanzia di un dispositivo sta per scadere"
      ),
      icon: ShieldAlert,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
    },
    {
      value: "warranty_expired" as const,
      label: t("eventStep.options.warranty_expired", "Garanzia scaduta"),
      example: t(
        "eventStep.examples.warranty_expired",
        "Quando un dispositivo ha superato la data di garanzia"
      ),
      icon: ShieldX,
      color: "text-red-700",
      bgColor: "bg-red-50 border-red-200",
    },
    {
      value: "scheduled" as const,
      label: t("eventStep.options.scheduled", "Schedulato"),
      example: t(
        "eventStep.examples.scheduled",
        "Esecuzione automatica con orario predefinito"
      ),
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50 border-purple-200",
    },
    {
      value: "manual" as const,
      label: t("eventStep.options.manual", "Manuale"),
      example: t(
        "eventStep.examples.manual",
        "Solo su azione manuale dell'utente"
      ),
      icon: MousePointerClick,
      color: "text-slate-600",
      bgColor: "bg-slate-50 border-slate-200",
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold">
        {t("eventStep.title", "Quando deve partire questa automazione?")}
      </h3>
      <p className="text-sm text-text3">
        {t(
          "eventStep.description",
          "Scegli l'evento che attiva questa regola. Esempio: quando arriva un nuovo ticket urgente."
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TRIGGER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value?.type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                onChange({
                  type: opt.value as TriggerDef["type"],
                  config: value?.type === opt.value ? value.config : {},
                })
              }
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                isSelected
                  ? `${opt.bgColor} ${opt.color} border-current shadow-sm`
                  : "border-border bg-background hover:border-accent/40 hover:bg-accent/5"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? `${opt.bgColor}` : "bg-surface2"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isSelected ? opt.color : "text-text3"
                  )}
                />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isSelected ? opt.color : "text-foreground"
                  )}
                >
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs text-text3 leading-relaxed">
                  {opt.example}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Conditional config for warranty_expiring_soon */}
      {value?.type === "warranty_expiring_soon" && (
        <div className="mt-4 rounded-lg border border-border bg-surface1 p-4">
          <label className="text-sm font-medium">
            {t("eventStep.warrantyDaysLabel", "Giorni prima della scadenza")}
          </label>
          <input
            type="number"
            min={1}
            max={365}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background sm:w-48"
            value={(value.config?.days as number | string) ?? 30}
            onChange={(e) =>
              onChange({
                ...value,
                config: {
                  ...(value.config || {}),
                  days: Number(e.target.value || 30),
                },
              })
            }
            placeholder="30"
          />
          <p className="mt-1 text-xs text-text3">
            {t(
              "eventStep.warrantyDaysHelp",
              "Esempio: 30 invia l'alert quando la garanzia scade entro 30 giorni."
            )}
          </p>
        </div>
      )}

      {/* Conditional config for scheduled */}
      {value?.type === "scheduled" && (
        <div className="mt-4 rounded-lg border border-border bg-surface1 p-4">
          <label className="text-sm font-medium">
            {t("eventStep.cronLabel", "Espressione Cron")}
          </label>
          <input
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background sm:w-80"
            value={(value.config?.cron as string) ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                config: {
                  ...(value.config || {}),
                  cron: e.target.value,
                },
              })
            }
            placeholder={t(
              "eventStep.cronPlaceholder",
              "es. 0 8 * * * (ogni giorno alle 8:00)"
            )}
          />
          <p className="mt-1 text-xs text-text3">
            {t(
              "eventStep.cronHelp",
              "Formato standard cron a 5 campi: minuto ora giorno mese giorno-settimana"
            )}
          </p>
        </div>
      )}
    </div>
  );
}
