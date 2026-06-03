import { ArrowLeft, ArrowRight, Save, FlaskConical, Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { mapLegacyTriggerType } from "@/domain/automation";
// DSL validation
import {
  validateTrigger,
  validateActions,
  formatValidationErrors,
} from "@/domain/automation.schema";
import {
  validateWizardPayload,
  groupErrorsBySection,
  getSectionLabel,
} from "@/lib/automations/flow-validation";
import { getTemplateById } from "@/lib/automations/templates";
import { cn } from "@/lib/utils";
import ActionsStep from "./steps/ActionsStep";
import EventStep from "./steps/EventStep";
import FiltersStep from "./steps/FiltersStep";
import ReviewStep from "./steps/ReviewStep";
import TemplateStep from "./steps/TemplateStep";
import type {
  TriggerDef,
  ConditionDef,
  ActionDef,
  ScheduleDef,
  WizardFlowPayload,
} from "@/types/automation";

function mapLegacyActionType(type: string): string {
  const mapping: Record<string, string> = {
    send_email: "send_email",
    update_ticket_status: "update_ticket",
    create_notification: "create_notification",
    update_device_status: "update_device",
    assign_ticket: "assign_ticket",
  };
  return mapping[type] || "send_email";
}

/**
 *
 */
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
  const { t } = useTranslation("automations");

  const STEPS = [
    { label: t("wizard.steps.template", "Modello"), description: t("wizard.steps.templateDesc", "Scegli un template") },
    { label: t("wizard.steps.event", "Evento"), description: t("wizard.steps.eventDesc", "Quando si attiva") },
    { label: t("wizard.steps.filters", "Filtri"), description: t("wizard.steps.filtersDesc", "Condizioni opzionali") },
    { label: t("wizard.steps.actions", "Azioni"), description: t("wizard.steps.actionsDesc", "Cosa succede") },
    { label: t("wizard.steps.review", "Riepilogo"), description: t("wizard.steps.reviewDesc", "Verifica e salva") },
  ];

  // Skip template step if editing existing automation
  const isEditing = Boolean(initial?.name);
  const [step, setStep] = useState(isEditing ? 1 : 0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [trigger, setTrigger] = useState<TriggerDef | null>(initial?.trigger_definition ?? null);
  const [conditions, setConditions] = useState<ConditionDef[]>(
    initial?.conditions_definition ?? [],
  );
  const [actions, setActions] = useState<ActionDef[]>(initial?.actions_definition ?? []);
  // schedule kept for backward compatibility with existing automations
  const [schedule] = useState<ScheduleDef | null>(initial?.schedule_definition ?? null);
  const [changeNote, setChangeNote] = useState(initial?.changeNote ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  function handleSelectTemplate(templateId: string | null) {
    setSelectedTemplateId(templateId);
    
    if (templateId) {
      const template = getTemplateById(templateId);
      if (template) {
        // Pre-populate wizard with template data
        setName(template.defaultPayload.name || "");
        setDescription(template.defaultPayload.description || "");
        setCategory(template.defaultPayload.category || null);
        setTrigger(template.defaultPayload.trigger_definition || null);
        setConditions(template.defaultPayload.conditions_definition || []);
        setActions(template.defaultPayload.actions_definition || []);
      }
    }
    
    // Advance to Event step
    setStep(1);
  }

  // Schema-based validation for each step
  function validateCurrent(currentStep: number): { ok: boolean; message?: string; fieldErrors?: Record<string, string> } {
    // Step 0 (Template) - no validation needed, always can proceed
    if (currentStep === 0) return { ok: true };

    // Step 1 (Event) - trigger required with schema validation
    if (currentStep === 1) {
      if (!trigger) {
        return { ok: false, message: t("wizard.validation.selectTrigger", "Seleziona un trigger") };
      }
      // Validate trigger with DSL schema
      const dslTriggerType = mapLegacyTriggerType(trigger.type);
      const triggerValidation = validateTrigger({
        type: dslTriggerType,
        config: trigger.config || {},
      });
      if (!triggerValidation.valid) {
        return {
          ok: false,
          message: triggerValidation.errors.map((e) => e.message).join(", "),
          fieldErrors: formatValidationErrors(triggerValidation.errors),
        };
      }
      return { ok: true };
    }

    // Step 2 (Filters) - optional, always valid
    if (currentStep === 2) return { ok: true };

    // Step 3 (Actions) - at least one action required with schema validation
    if (currentStep === 3) {
      if (!actions || actions.length === 0) {
        return { ok: false, message: t("wizard.validation.addAction", "Aggiungi almeno un'azione") };
      }
      // Validate actions with DSL schema (convert from legacy ActionDef)
      const dslActions = actions.map((a, index) => ({
        id: a.id,
        type: mapLegacyActionType(a.type),
        order: index,
        config: a.config || {},
      }));
      const actionsValidation = validateActions(dslActions);
      if (!actionsValidation.valid) {
        return {
          ok: false,
          message: actionsValidation.errors.map((e) => e.message).join(", "),
          fieldErrors: formatValidationErrors(actionsValidation.errors),
        };
      }
      return { ok: true };
    }

    return { ok: true };
  }

  function generateSummary() {
    if (!trigger || actions.length === 0) return t("wizard.validation.incompleteRule", "Incomplete rule");
    const triggerLabel = trigger.type;
    const actionLabels = actions.map((a) => a.type).join(" e ");
    return t("wizard.validation.summary", "When \"{{trigger}}\", execute {{actions}}.", { trigger: triggerLabel, actions: actionLabels });
  }

  function handleNext() {
    const v = validateCurrent(step);
    if (!v.ok) {
      // Set specific field errors from validation
      if (v.fieldErrors) {
        setErrors(v.fieldErrors);
      } else {
        // Generic error for the step
        const stepKey = step === 1 ? "trigger" : step === 3 ? "actions" : "general";
        setErrors({ [stepKey]: v.message || "" });
      }
      return;
    }
    setErrors({}); // Clear errors on successful validation
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
                  "flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  i < step && "bg-accent text-accent-foreground cursor-pointer",
                  i === step && "bg-accent/20 text-accent ring-2 ring-accent/40",
                  i > step && "bg-surface3 text-text3 cursor-default",
                )}
                disabled={i > step}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn("mx-2 h-0.5 w-8 sm:w-12", i < step ? "bg-accent" : "bg-surface3")}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between px-0.5">
          {STEPS.map((s, i) => (
            <span
              key={s.label}
              className={cn("text-[10px] font-medium", i === step ? "text-accent" : "text-text3")}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="space-y-4">
        {step === 0 && (
          <TemplateStep
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={handleSelectTemplate}
          />
        )}
        {step === 1 && (
          <div>
            <EventStep
              value={trigger}
              onChange={(v) => {
                setTrigger(v);
                setErrors((e) => {
                  const newErrors = { ...e };
                  delete newErrors.trigger;
                  return newErrors;
                });
              }}
            />
            {errors.trigger && <div className="mt-2 text-sm text-rose-600">{errors.trigger}</div>}
          </div>
        )}
        {step === 2 && (
          <div>
            <FiltersStep
              value={conditions}
              onChange={(v) => {
                setConditions(v);
                setErrors((e) => {
                  const newErrors = { ...e };
                  delete newErrors.general;
                  return newErrors;
                });
              }}
              triggerName={trigger?.type}
            />
          </div>
        )}
        {step === 3 && (
          <div>
            <ActionsStep
              value={actions}
              onChange={(v) => {
                setActions(v);
                setErrors((e) => {
                  const newErrors = { ...e };
                  delete newErrors.actions;
                  // Also clear action-specific errors
                  Object.keys(newErrors).forEach((key) => {
                    if (key.startsWith("actions[")) delete newErrors[key];
                  });
                  return newErrors;
                });
              }}
              triggerType={trigger?.type}
            />
            {/* Display general actions error */}
            {errors.actions && <div className="mt-2 text-sm text-rose-600">{errors.actions}</div>}
            {/* Display field-specific errors */}
            {Object.entries(errors).filter(([k]) => k.startsWith("actions[")).map(([k, v]) => (
              <div key={k} className="mt-1 text-xs text-rose-600">
                {v}
              </div>
            ))}
          </div>
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
            onChangeName={setName}
            onChangeDescription={setDescription}
            onChangeCategory={(v) => setCategory(v || null)}
            onNavigateToStep={setStep}
          />
        )}

        {/* Inline validation errors */}
        {step === 4 && validation && !validation.valid && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1.5">
            <p className="text-sm font-semibold text-red-700">
              {t("wizard.validation.fixErrors", "Fix the following errors before saving:")}
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
            <p className="text-sm font-semibold text-amber-700">
              {t("wizard.validation.warnings", "Warnings:")}
            </p>
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
            <label className="text-sm font-medium">{t("wizard.changeNote", "Change note")}</label>
            <textarea
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
              rows={2}
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder={t("wizard.changeNotePlaceholder", "Describe what changed in this version...")}
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <div>
          {step === 4 && onTest && (
            <Button variant="outline" size="sm" onClick={onTest} className="gap-1.5">
              <FlaskConical className="size-4" />
              {t("wizard.testRule", "Test rule")}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {t("wizard.cancel", "Cancel")}
          </Button>
          {step > 0 && (
            <Button variant="outline" onClick={handlePrev} className="gap-1">
              <ArrowLeft className="size-4" />
              {t("wizard.back", "Back")}
            </Button>
          )}
          {step < STEPS.length - 1 && (
            <Button onClick={handleNext} className="gap-1">
              {t("wizard.next", "Next")}
              <ArrowRight className="size-4" />
            </Button>
          )}
          {step === STEPS.length - 1 && (
            <Button onClick={handleSave} className="gap-1.5">
              <Save className="size-4" />
              {t("wizard.save", "Save rule")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
