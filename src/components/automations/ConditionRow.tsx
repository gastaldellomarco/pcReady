import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFieldDef, isMultiValueOperator } from "@/domain/automation";
import { FieldSelector } from "./FieldSelector";
import { OperatorSelector } from "./OperatorSelector";
import { ValueInput } from "./ValueInput";
import type { AutomationCondition } from "@/domain/automation";

interface ConditionRowProps {
  condition: AutomationCondition;
  onChange: (condition: AutomationCondition) => void;
  onRemove: () => void;
  showConnector?: boolean;
  connectorType?: "AND" | "OR";
}

/**
 *
 */
export function ConditionRow({
  condition,
  onChange,
  onRemove,
  showConnector,
  connectorType,
}: ConditionRowProps) {
  const { t } = useTranslation("automations");
  const fieldDef = getFieldDef(condition.field);

  const handleFieldChange = (newFieldValue: string) => {
    const newFieldDef = getFieldDef(newFieldValue);
    const availableOperators = newFieldDef
      ? getFieldDef(newFieldValue)?.type === "number"
        ? ["eq", "neq", "gt", "lt"]
        : ["eq", "neq", "contains"]
      : [];

    // Reset operator if current one is not available for new field
    const newOperator = availableOperators.includes(condition.operator)
      ? condition.operator
      : (availableOperators[0] as AutomationCondition["operator"]) || "eq";

    // Reset value based on new operator
    const newValue = isMultiValueOperator(newOperator) ? [] : "";

    onChange({
      ...condition,
      field: newFieldValue,
      operator: newOperator,
      value: newValue,
      valueType: newFieldDef?.type === "number" ? "number" : "string",
    });
  };

  const handleOperatorChange = (newOperator: AutomationCondition["operator"]) => {
    // Reset value when switching to/from multi-value operator
    const needsArray = isMultiValueOperator(newOperator);
    const hadArray = isMultiValueOperator(condition.operator);

    let newValue: string | number | string[];
    if (needsArray && !hadArray) {
      newValue = condition.value ? [String(condition.value)] : [];
    } else if (!needsArray && hadArray) {
      newValue = Array.isArray(condition.value) ? condition.value[0] || "" : "";
    } else {
      newValue = condition.value;
    }

    onChange({
      ...condition,
      operator: newOperator,
      value: newValue,
    });
  };

  return (
    <div className="space-y-2">
      {showConnector && (
        <div className="flex items-center justify-center py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text3">
            {connectorType === "AND"
              ? t("conditionsBuilder.actions.and", "E")
              : t("conditionsBuilder.actions.or", "OPPURE")}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr,auto,1fr,auto]">
          {/* Field selector */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text3">
              {t("conditionsBuilder.field.placeholder", "Campo")}
            </label>
            <FieldSelector value={condition.field} onChange={handleFieldChange} />
          </div>

          {/* Operator selector */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text3">
              {t("conditionsBuilder.operator.placeholder", "Operatore")}
            </label>
            <OperatorSelector
              fieldValue={condition.field}
              value={condition.operator}
              onChange={handleOperatorChange}
            />
          </div>

          {/* Value input */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text3">
              {t("conditionsBuilder.value.placeholder", "Valore")}
            </label>
            <ValueInput
              field={fieldDef}
              operator={condition.operator}
              value={condition.value}
              onChange={(newValue) => onChange({ ...condition, value: newValue })}
            />
          </div>

          {/* Remove button */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-2 text-red-600 hover:bg-red-50"
              title={t("conditionsBuilder.actions.removeCondition", "Rimuovi")}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
