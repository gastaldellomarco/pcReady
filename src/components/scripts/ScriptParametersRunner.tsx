import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ScriptParameter } from "@/lib/schemas/scripts";

interface ScriptParametersRunnerProps {
  parameters: ScriptParameter[];
  onApply: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function ScriptParametersRunner({ parameters, onApply, onCancel }: ScriptParametersRunnerProps) {
  const { t } = useTranslation("scripts");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canRun = useMemo(() => {
    for (const param of parameters) {
      if (param.required && !values[param.name]?.trim()) return false;
    }
    return true;
  }, [parameters, values]);

  function handleApply() {
    const newErrors: Record<string, string> = {};
    for (const param of parameters) {
      if (param.required && !values[param.name]?.trim()) {
        newErrors[param.name] = t("runner.requiredField", "Campo obbligatorio");
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onApply(values);
  }

  return (
    <div
      className="rounded-md border p-4 space-y-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="text-sm font-bold">
        {t("runner.title", "Parametri richiesti")}
      </div>
      <p className="text-xs text-text2">
        {t("runner.description", "Compila i parametri prima di eseguire lo script.")}
      </p>
      <div className="space-y-2">
        {parameters.map((param) => (
          <div key={param.name} className="space-y-1">
            <label className="flex items-center gap-1 text-xs font-medium">
              {param.label || param.name}
              {param.required && <span className="text-destructive">*</span>}
            </label>
            {param.type === "boolean" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values[param.name] === "true"}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [param.name]: e.target.checked ? "true" : "false",
                    }))
                  }
                />
                {param.label || param.name}
              </label>
            ) : param.type === "number" ? (
              <input
                className="pc-input text-sm"
                type="number"
                value={values[param.name] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                }
                placeholder={param.label || param.name}
                aria-label={param.label || param.name}
              />
            ) : (
              <input
                className="pc-input text-sm"
                value={values[param.name] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                }
                placeholder={param.label || param.name}
                aria-label={param.label || param.name}
              />
            )}
            {errors[param.name] && (
              <p className="text-xs text-destructive">{errors[param.name]}</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onCancel}>
          {t("runner.cancel", "Annulla")}
        </button>
        <button
          className="pc-btn pc-btn-primary pc-btn-sm"
          onClick={handleApply}
          disabled={!canRun}
        >
          {t("runner.run", "Esegui")}
        </button>
      </div>
    </div>
  );
}
