import { Plus, FilterX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createDefaultCondition } from "@/domain/automation";
import { cn } from "@/lib/utils";
import { ConditionRow } from "./ConditionRow";
import type {
  ConditionsGroup,
  AutomationCondition,
  ConditionLogic,
} from "@/domain/automation";

interface AutomationConditionsBuilderProps {
  value?: ConditionsGroup;
  onChange: (group: ConditionsGroup) => void;
  triggerName?: string;
}

/**
 *
 */
export function AutomationConditionsBuilder({
  value,
  onChange,
  triggerName,
}: AutomationConditionsBuilderProps) {
  const { t } = useTranslation("automations");

  const group: ConditionsGroup = value || {
    conditions: [],
    logic: "AND",
  };

  const handleLogicChange = (newLogic: ConditionLogic) => {
    onChange({
      ...group,
      logic: newLogic,
    });
  };

  const handleAddCondition = () => {
    const newCondition = createDefaultCondition();
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const handleUpdateCondition = (
    index: number,
    updatedCondition: AutomationCondition
  ) => {
    const newConditions = [...group.conditions];
    newConditions[index] = updatedCondition;
    onChange({
      ...group,
      conditions: newConditions,
    });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({
      ...group,
      conditions: newConditions,
    });
  };

  const hasConditions = group.conditions.length > 0;

  return (
    <div className="space-y-4">
      {/* Header with logic toggle */}
      <div className="rounded-lg border border-border bg-surface1 p-4">
        <p className="mb-3 text-sm font-medium">
          {t("conditionsBuilder.whenConditions", "Quando queste condizioni sono soddisfatte:")}
        </p>

        {/* Logic toggle */}
        <div className="flex flex-wrap gap-2 relative z-10">
          <label
            role="button"
            tabIndex={0}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors pointer-events-auto select-none",
              group.logic === "AND"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border hover:border-accent/50"
            )}
            onClick={() => handleLogicChange("AND")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLogicChange("AND"); } }}
          >
            <input
              type="radio"
              name="conditionLogic"
              value="AND"
              checked={group.logic === "AND"}
              onChange={() => handleLogicChange("AND")}
              className="sr-only pointer-events-none"
            />
            {t("conditionsBuilder.logic.and", "Tutte devono essere vere (AND)")}
          </label>

          <label
            role="button"
            tabIndex={0}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors pointer-events-auto select-none",
              group.logic === "OR"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border hover:border-accent/50"
            )}
            onClick={() => handleLogicChange("OR")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleLogicChange("OR"); } }}
          >
            <input
              type="radio"
              name="conditionLogic"
              value="OR"
              checked={group.logic === "OR"}
              onChange={() => handleLogicChange("OR")}
              className="sr-only pointer-events-none"
            />
            {t("conditionsBuilder.logic.or", "Basta che una sia vera (OR)")}
          </label>
        </div>
      </div>

      {/* Conditions list */}
      {hasConditions ? (
        <div className="space-y-0">
          {group.conditions.map((condition, index) => (
            <ConditionRow
              key={condition.id}
              condition={condition}
              onChange={(updated) => handleUpdateCondition(index, updated)}
              onRemove={() => handleRemoveCondition(index)}
              showConnector={index > 0}
              connectorType={group.logic}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-xl border border-dashed border-border bg-surface1/50 p-6 text-center">
          <FilterX className="mx-auto size-8 text-text3" />
          <p className="mt-2 text-sm font-medium text-foreground">
            {t("conditionsBuilder.emptyState.title", "Nessun filtro configurato")}
          </p>
          <p className="mt-1 text-xs text-text3">
            {t("conditionsBuilder.emptyState.description", "L'automazione si attiverà per ogni {{trigger}}", {
              trigger: triggerName || t("conditionsBuilder.emptyState.defaultTrigger", "evento"),
            })}
          </p>
          <button
            type="button"
            onClick={handleAddCondition}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" />
            {t("conditionsBuilder.emptyState.addFirst", "+ Aggiungi la prima condizione")}
          </button>
        </div>
      )}

      {/* Add condition button (when conditions exist) */}
      {hasConditions && (
        <button
          type="button"
          onClick={handleAddCondition}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm font-medium text-text3 hover:border-accent hover:text-accent transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("conditionsBuilder.actions.addCondition", "+ Aggiungi condizione")}
        </button>
      )}
    </div>
  );
}
