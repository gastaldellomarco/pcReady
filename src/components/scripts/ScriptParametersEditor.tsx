import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ScriptParameter } from "@/lib/schemas/scripts";

interface ScriptParametersEditorProps {
  value: ScriptParameter[];
  onChange: (params: ScriptParameter[]) => void;
  disabled?: boolean;
}

export function ScriptParametersEditor({ value, onChange, disabled }: ScriptParametersEditorProps) {
  const { t } = useTranslation("scripts");

  function addParameter() {
    onChange([
      ...(value ?? []),
      { name: "", label: "", type: "text", required: false },
    ]);
  }

  function updateParameter(index: number, patch: Partial<ScriptParameter>) {
    const next = [...(value ?? [])];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeParameter(index: number) {
    onChange((value ?? []).filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="pc-label">
          {t("editor.fieldParameters", "Parametri")}
        </span>
        <button
          type="button"
          className="text-xs text-accent hover:underline"
          onClick={addParameter}
          disabled={disabled}
        >
          <Plus className="size-3 inline" />{" "}
          {t("editor.addParameter", "Aggiungi parametro")}
        </button>
      </div>

      <p className="text-[11px] text-text3">
        {t(
          "editor.parametersHelp",
          'Usa {{nome_parametro}} nel codice per inserire il valore a runtime.'
        )}
      </p>

      {(value ?? []).length === 0 ? (
        <div className="text-xs text-text3 italic py-2">
          {t("editor.noParameters", "Nessun parametro definito.")}
        </div>
      ) : (
        <div className="space-y-2">
          {(value ?? []).map((param, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              <input
                className="pc-input min-w-[100px] flex-1 text-xs"
                value={param.name}
                onChange={(e) => updateParameter(idx, { name: e.target.value.trim() })}
                placeholder={t("editor.paramName", "nome_var")}
                disabled={disabled}
                aria-label={t("editor.paramNameLabel", "Nome variabile")}
              />
              <input
                className="pc-input min-w-[100px] flex-1 text-xs"
                value={param.label}
                onChange={(e) => updateParameter(idx, { label: e.target.value })}
                placeholder={t("editor.paramLabel", "Etichetta")}
                disabled={disabled}
                aria-label={t("editor.paramLabelLabel", "Etichetta parametro")}
              />
              <select
                className="pc-input w-auto text-xs"
                value={param.type}
                onChange={(e) =>
                  updateParameter(idx, { type: e.target.value as ScriptParameter["type"] })
                }
                disabled={disabled}
                aria-label={t("editor.paramType", "Tipo parametro")}
              >
                <option value="text">{t("editor.paramTypeText", "Testo")}</option>
                <option value="number">{t("editor.paramTypeNumber", "Numero")}</option>
                <option value="boolean">{t("editor.paramTypeBoolean", "Sì/No")}</option>
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={param.required}
                  onChange={(e) => updateParameter(idx, { required: e.target.checked })}
                  disabled={disabled}
                />
                {t("editor.paramRequired", "Obbligatorio")}
              </label>
              <button
                type="button"
                onClick={() => removeParameter(idx)}
                disabled={disabled}
                className="pc-btn-icon"
                style={{ color: "var(--danger)" }}
                title={t("editor.removeParameter", "Rimuovi parametro")}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
