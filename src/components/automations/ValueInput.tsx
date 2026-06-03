import { X, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isMultiValueOperator } from "@/domain/automation";
import type {
  ConditionFieldDef,
  ConditionOperator,
} from "@/domain/automation";

interface ValueInputProps {
  field: ConditionFieldDef | undefined;
  operator: ConditionOperator;
  value: string | number | string[];
  onChange: (value: string | number | string[]) => void;
}

/**
 *
 */
export function ValueInput({
  field,
  operator,
  value,
  onChange,
}: ValueInputProps) {
  const { t } = useTranslation("automations");

  // Handle multi-value operators (in)
  if (isMultiValueOperator(operator)) {
    const values = Array.isArray(value) ? value : value ? [String(value)] : [];

    return (
      <div className="space-y-2">
        {values.map((val, idx) => (
          <div key={idx} className="flex items-center gap-2">
            {field?.type === "select" && field.options ? (
              <select
                value={val}
                onChange={(e) => {
                  const newValues = [...values];
                  newValues[idx] = e.target.value;
                  onChange(newValues);
                }}
                className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              >
                <option value="">{t("conditionsBuilder.value.placeholder", "Seleziona")}</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field?.type === "number" ? (
              <input
                type="number"
                value={val}
                onChange={(e) => {
                  const newValues = [...values];
                  newValues[idx] = e.target.value;
                  onChange(newValues);
                }}
                placeholder={t("conditionsBuilder.value.placeholderNumber", "Inserisci numero")}
                className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              />
            ) : (
              <input
                type="text"
                value={val}
                onChange={(e) => {
                  const newValues = [...values];
                  newValues[idx] = e.target.value;
                  onChange(newValues);
                }}
                placeholder={t("conditionsBuilder.value.placeholderString", "Inserisci testo")}
                className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              />
            )}
            <button
              type="button"
              onClick={() => {
                const newValues = values.filter((_, i) => i !== idx);
                onChange(newValues);
              }}
              className="rounded p-1.5 text-red-600 hover:bg-red-50"
              title={t("conditionsBuilder.value.removeItem", "Rimuovi")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            onChange([...values, ""]);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text3 hover:border-accent hover:text-accent transition-colors"
        >
          <Plus className="size-3.5" />
          {t("conditionsBuilder.value.addItem", "+ Aggiungi")}
        </button>
      </div>
    );
  }

  // Single value input based on field type
  if (field?.type === "select" && field.options) {
    return (
      <select
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background"
      >
        <option value="">{t("conditionsBuilder.value.placeholder", "Seleziona")}</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field?.type === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : value || ""}
        onChange={(e) => {
          const num = e.target.value === "" ? "" : Number(e.target.value);
          onChange(num);
        }}
        placeholder={t("conditionsBuilder.value.placeholderNumber", "Inserisci numero")}
        className="w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background"
      />
    );
  }

  // Reference fields (simplified - just text input for now)
  if (field?.type === "reference") {
    return (
      <input
        type="text"
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("conditionsBuilder.value.placeholder", "Inserisci ID riferimento")}
        className="w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background font-mono text-xs"
      />
    );
  }

  // Default string input
  return (
    <input
      type="text"
      value={String(value || "")}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("conditionsBuilder.value.placeholderString", "Inserisci testo")}
      className="w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background"
    />
  );
}
