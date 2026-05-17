import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Save, FlaskConical, Check } from "lucide-react";
import TriggerStep from "./steps/TriggerStep";
import ConditionsStep from "./steps/ConditionsStep";
import ActionsStep from "./steps/ActionsStep";
import ScheduleStep from "./steps/ScheduleStep";
import ReviewStep from "./steps/ReviewStep";
import type {
  TriggerDef,
  ConditionDef,
  ActionDef,
  ScheduleDef,
  WizardFlowPayload,
} from "@/types/automation";
import {
  validateWizardPayload,
  groupErrorsBySection,
  getSectionLabel,
} from "@/lib/automations/flow-validation";

const STEPS = [
  { label: "Trigger", description: "Evento scatenante" },
  { label: "Condizioni", description: "Filtri opzionali" },
  { label: "Azioni", description: "Cosa eseguire" },
  { label: "Schedule", description: "Pianificazione" },
  { label: "Riepilogo", description: "Verifica e salva" },
];

export default function AutomationWizard({
  initial,
  onCancel,
  onSave,
  onTest,
}: {
  initial?: WizardFlowPayload & { version?: number };
  onCancel: () => void;
  onSave: (flow: WizardFlowPayload) => void;
  onTest?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [trigger, setTrigger] = useState<TriggerDef | null>(initial?.trigger_definition ?? null);
  const [conditions, setConditions] = useState<ConditionDef[]>(
    initial?.conditions_definition ?? [],
  );
  const [actions, setActions] = useState<ActionDef[]>(initial?.actions_definition ?? []);
  const [schedule, setSchedule] = useState<ScheduleDef | null>(
    initial?.schedule_definition ?? null,
  );
  const [changeNote, setChangeNote] = useState(initial?.changeNote ?? "");
  const [errors, setErrors] = useState<{ trigger?: string; actions?: string; general?: string }>(
    {},
  );

  // Compute inline validation for ReviewStep
  const flowPreview = {
    name,
    description,
    category,
    trigger_definition: trigger,
    conditions_definition: conditions,
    actions_definition: actions,
    schedule_definition: schedule,
    summary: generateSummary(),
    version: initial?.version ?? 1,
    changeNote,
  };
  const validation = step === 4 ? validateWizardPayload(flowPreview) : null;

  function validateCurrent(currentStep: number): { ok: boolean; message?: string } {
    if (currentStep === 0) {
      if (!trigger) return { ok: false, message: "Seleziona un trigger" };
      return { ok: true };
    }
    if (currentStep === 2) {
      if (!actions || actions.length === 0)
        return { ok: false, message: "Aggiungi almeno un'azione" };
      return { ok: true };
    }
    return { ok: true };
  }

  function generateSummary() {
    if (!trigger || actions.length === 0) return "Regola incompleta";
    const triggerLabel = trigger.type;
    const actionLabels = actions.map((a) => a.type).join(" e ");
    return `Quando "${triggerLabel}", esegui ${actionLabels}.`;
  }

  function handleNext() {
    const v = validateCurrent(step);
    if (!v.ok) {
      if (step === 0) setErrors((e) => ({ ...e, trigger: v.message }));
      if (step === 2) setErrors((e) => ({ ...e, actions: v.message }));
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSave() {
    const flow = {
      name,
      description,
      category,
      trigger_definition: trigger,
      conditions_definition: conditions,
      actions_definition: actions,
      schedule_definition: schedule,
      summary: generateSummary(),
      version: initial?.version ?? 1,
      changeNote,
    };
    onSave(flow);
  }

  return (
    <div>
      {/* Step progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  i < step && "bg-accent text-accent-foreground cursor-pointer",
                  i === step && "bg-accent/20 text-accent ring-2 ring-accent/40",
                  i > step && "bg-surface3 text-text3 cursor-default",
                )}
                disabled={i > step}
              >
                {i < step ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 h-0.5 w-8 sm:w-12",
                    i < step ? "bg-accent" : "bg-surface3",
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between px-0.5">
          {STEPS.map((s, i) => (
            <span
              key={s.label}
              className={cn(
                "text-[10px] font-medium",
                i === step ? "text-accent" : "text-text3",
              )}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="space-y-4">
        {step === 0 && (
          <div>
            <TriggerStep
              value={trigger}
              onChange={(v) => {
                setTrigger(v);
                setErrors((e) => ({ ...e, trigger: undefined }));
              }}
            />
            {errors.trigger && (
              <div className="mt-2 text-sm text-rose-600">{errors.trigger}</div>
            )}
          </div>
        )}
        {step === 1 && (
          <div>
            <ConditionsStep
              value={conditions}
              onChange={(v) => {
                setConditions(v);
                setErrors((e) => ({ ...e, general: undefined }));
              }}
            />
          </div>
        )}
        {step === 2 && (
          <div>
            <ActionsStep
              value={actions}
              onChange={(v) => {
                setActions(v);
                setErrors((e) => ({ ...e, actions: undefined }));
              }}
            />
            {errors.actions && (
              <div className="mt-2 text-sm text-rose-600">{errors.actions}</div>
            )}
          </div>
        )}
        {step === 3 && (
          <ScheduleStep value={schedule} onChange={setSchedule} />
        )}
        {step === 4 && (
          <ReviewStep
            name={name}
            description={description}
            category={category}
            trigger={trigger}
            conditions={conditions}
            actions={actions}
            schedule={schedule}
            summary={generateSummary()}
            onChangeName={setName}
            onChangeDescription={setDescription}
            onChangeCategory={(v) => setCategory(v || null)}
          />
        )}

        {/* Inline validation errors */}
        {step === 4 && validation && !validation.valid && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
            <p className="text-sm font-semibold text-red-700">
              Correggi i seguenti errori prima di salvare:
            </p>
            {Object.entries(groupErrorsBySection(validation.errors)).map(([section, errs]) => (
              <div key={section}>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mt-2">
                  {getSectionLabel(section)}
                </p>
                <ul className="mt-0.5 list-disc list-inside space-y-0.5">
                  {errs
                    .filter((e) => e.severity === "error")
                    .map((err, i) => (
                      <li key={i} className="text-xs text-red-600">
                        {err.message}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Inline warnings */}
        {step === 4 && validation && validation.errors.some((e) => e.severity === "warning") && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5">
            <p className="text-sm font-semibold text-amber-700">Avvisi:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {validation.errors
                .filter((e) => e.severity === "warning")
                .map((err, i) => (
                  <li key={i} className="text-xs text-amber-600">
                    {err.message}
                  </li>
                ))}
            </ul>
          </div>
        )}
        {step === 4 && (
          <div>
            <label className="text-sm font-medium">Nota modifica</label>
            <textarea
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
              rows={2}
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder="Descrivi cosa e cambiato in questa versione..."
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <div>
          {step === 4 && onTest && (
            <Button variant="outline" size="sm" onClick={onTest} className="gap-1.5">
              <FlaskConical className="h-4 w-4" />
              Testa regola
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annulla
          </Button>
          {step > 0 && (
            <Button variant="outline" onClick={handlePrev} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button onClick={handleNext} className="gap-1">
              Avanti
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {step === STEPS.length - 1 && (
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="h-4 w-4" />
              Salva regola
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
