import { useState } from "react";
import { Button } from "@/components/ui/button";
import TriggerStep from "./steps/TriggerStep";
import ConditionsStep from "./steps/ConditionsStep";
import ActionsStep from "./steps/ActionsStep";
import ScheduleStep from "./steps/ScheduleStep";
import ReviewStep from "./steps/ReviewStep";

export type TriggerDef = { type: string; config?: Record<string, any> };
export type ConditionDef = { id: string; type: string; config?: Record<string, any> };
export type ActionDef = { id: string; type: string; config?: Record<string, any> };

export default function AutomationWizard({
  initial,
  onCancel,
  onSave,
}: {
  initial?: any;
  onCancel: () => void;
  onSave: (flow: any) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [trigger, setTrigger] = useState<TriggerDef | null>(initial?.trigger_definition ?? null);
  const [conditions, setConditions] = useState<ConditionDef[]>(initial?.conditions_definition ?? []);
  const [actions, setActions] = useState<ActionDef[]>(initial?.actions_definition ?? []);
  const [schedule, setSchedule] = useState<any>(initial?.schedule_definition ?? null);
  const [errors, setErrors] = useState<{ trigger?: string; actions?: string; general?: string }>({});

  function validateCurrent(currentStep: number): { ok: boolean; message?: string } {
    // step-specific validation
    if (currentStep === 0) {
      if (!trigger) return { ok: false, message: "Trigger obbligatorio" };
      return { ok: true };
    }
    if (currentStep === 2) {
      if (!actions || actions.length === 0) return { ok: false, message: "Almeno un'azione è richiesta" };
      return { ok: true };
    }
    // default: allow
    return { ok: true };
  }

  function generateSummary() {
    if (!trigger || actions.length === 0) return "Regola incompleta";
    const triggerLabel = trigger.type;
    const actionLabels = actions.map((a) => a.type).join(" e ");
    return `Quando ${triggerLabel}, esegui ${actionLabels}.`;
  }

  function handleNext() {
    const v = validateCurrent(step);
    if (!v.ok) {
      // set inline errors based on step
      if (step === 0) setErrors((e) => ({ ...e, trigger: v.message }));
      if (step === 2) setErrors((e) => ({ ...e, actions: v.message }));
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSave() {
    const flow = {
      name,
      description,
      trigger_definition: trigger,
      conditions_definition: conditions,
      actions_definition: actions,
      schedule_definition: schedule,
      summary: generateSummary(),
      version: initial?.version ?? 1,
    };
    onSave(flow);
  }

  return (
    <div>
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
            {errors.trigger && <div className="mt-2 text-sm text-rose-600">{errors.trigger}</div>}
          </div>
        )}
        {step === 1 && (
          <div>
            <ConditionsStep value={conditions} onChange={(v) => { setConditions(v); setErrors((e) => ({ ...e, general: undefined })); }} />
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
            {errors.actions && <div className="mt-2 text-sm text-rose-600">{errors.actions}</div>}
          </div>
        )}
        {step === 3 && <ScheduleStep value={schedule} onChange={setSchedule} />}
        {step === 4 && (
          <ReviewStep
            name={name}
            description={description}
            trigger={trigger}
            conditions={conditions}
            actions={actions}
            schedule={schedule}
            summary={generateSummary()}
            onChangeName={setName}
            onChangeDescription={setDescription}
          />
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Annulla</Button>
        {step > 0 && <Button variant="ghost" onClick={handlePrev}>Indietro</Button>}
        {step < 4 && <Button onClick={handleNext}>Avanti</Button>}
        {step === 4 && <Button onClick={handleSave}>Salva</Button>}
      </div>
    </div>
  );
}
