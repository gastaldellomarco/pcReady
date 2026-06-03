import { useTranslation } from "react-i18next";
import { getOperatorsForField, type ConditionOperator } from "@/domain/automation";

interface OperatorSelectorProps {
  fieldValue: string;
  value: ConditionOperator;
  onChange: (value: ConditionOperator) => void;
}

/**
 *
 */
export function OperatorSelector({
  fieldValue,
  value,
  onChange,
}: OperatorSelectorProps) {
  const { t } = useTranslation("automations");

  const operators = getOperatorsForField(fieldValue);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ConditionOperator)}
      disabled={operators.length === 0}
      className="w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background disabled:opacity-50"
    >
      <option value="">
        {t("conditionsBuilder.operator.placeholder", "Operatore")}
      </option>
      {operators.map((op) => (
        <option key={op.value} value={op.value}>
          {t(`conditionsBuilder.operator.${op.value}`, op.label)}
        </option>
      ))}
    </select>
  );
}
