import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";
import type { ConditionDef, ConditionType } from "@/types/automation";

function uid(prefix = "c") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function ConditionsStep({
  value,
  onChange,
}: {
  value: ConditionDef[];
  onChange: (v: ConditionDef[]) => void;
}) {
  const { t } = useTranslation("automations");

  const OPERATORS = [
    { value: "field_equals", label: t("conditions.operators.field_equals", "Field equals") },
    { value: "field_not_equals", label: t("conditions.operators.field_not_equals", "Field not equals") },
    { value: "field_greater_than", label: t("conditions.operators.field_greater_than", "Greater than") },
    { value: "field_less_than", label: t("conditions.operators.field_less_than", "Less than") },
    { value: "field_contains", label: t("conditions.operators.field_contains", "Contains") },
    { value: "field_starts_with", label: t("conditions.operators.field_starts_with", "Starts with") },
    { value: "field_ends_with", label: t("conditions.operators.field_ends_with", "Ends with") },
    { value: "priority_high", label: t("conditions.operators.priority_high", "High priority") },
    { value: "tag_contains", label: t("conditions.operators.tag_contains", "Tag contains") },
  ];

  const addCondition = () => {
    onChange([
      ...(value || []),
      { id: uid(), type: "field_equals", config: { field: "", value: "" } },
    ]);
  };

  function update(id: string, patch: Partial<ConditionDef>) {
    onChange((value || []).map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remove(id: string) {
    onChange((value || []).filter((c) => c.id !== id));
  }

  function moveUp(id: string) {
    const arr = [...(value || [])];
    const idx = arr.findIndex((c) => c.id === id);
    if (idx <= 0) return;
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange(arr);
  }

  function moveDown(id: string) {
    const arr = [...(value || [])];
    const idx = arr.findIndex((c) => c.id === id);
    if (idx < 0 || idx >= arr.length - 1) return;
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange(arr);
  }

  const needsFields = ["field_equals", "field_not_equals", "field_greater_than", "field_less_than", "field_contains", "field_starts_with", "field_ends_with"];

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("conditions.title", "Conditions")}</h3>
      <p className="text-sm text-text3">
        {t("conditions.subtitle", "Add optional conditions that must be met to execute the actions.")}
      </p>

      <div className="mt-4 space-y-2">
        {(value || []).map((c, index) => (
          <div key={c.id}>
            {index > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text3">
                  {t("conditions.and", "AND")}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border p-3",
                "border-border bg-background/60",
              )}
            >
              <select
                value={c.type}
                onChange={(e) => update(c.id, { type: e.target.value as ConditionType })}
                className="rounded-md border border-border px-2 py-1.5 text-xs bg-background"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              {needsFields.includes(c.type) && (
                <>
                  <input
                    className="rounded-md border border-border px-2 py-1.5 text-xs bg-background w-28"
                    placeholder={t("conditions.fieldPlaceholder", "Field")}
                    value={c.config?.field ?? ""}
                    onChange={(e) =>
                      update(c.id, {
                        config: { ...(c.config || {}), field: e.target.value },
                      })
                    }
                  />
                  <input
                    className="rounded-md border border-border px-2 py-1.5 text-xs bg-background w-28"
                    placeholder={t("conditions.valuePlaceholder", "Value")}
                    value={c.config?.value ?? ""}
                    onChange={(e) =>
                      update(c.id, {
                        config: { ...(c.config || {}), value: e.target.value },
                      })
                    }
                  />
                </>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(c.id)}
                  disabled={index === 0}
                  className="rounded p-1 text-text3 hover:bg-surface3 disabled:opacity-30"
                  title={t("conditions.moveUp", "Move up")}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(c.id)}
                  disabled={index === (value || []).length - 1}
                  className="rounded p-1 text-text3 hover:bg-surface3 disabled:opacity-30"
                  title={t("conditions.moveDown", "Move down")}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  title={t("conditions.remove", "Remove")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={addCondition}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-text3 hover:border-accent hover:text-accent transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("conditions.addCondition", "Add condition")}
        </button>
      </div>

      {(value || []).length === 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-background/40 p-4 text-center text-xs text-text3">
          {t("conditions.noConditions", "No conditions — the rule will always trigger when the event occurs.")}
        </div>
      )}
    </div>
  );
}
