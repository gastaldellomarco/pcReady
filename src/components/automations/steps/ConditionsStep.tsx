import { cn } from "@/lib/utils";
import { Plus, X, ArrowUp, ArrowDown } from "lucide-react";

function uid(prefix = "c") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const OPERATORS = [
  { value: "field_equals", label: "Campo uguale a" },
  { value: "field_not_equals", label: "Campo diverso da" },
  { value: "field_greater_than", label: "Maggiore di" },
  { value: "field_less_than", label: "Minore di" },
  { value: "field_contains", label: "Contiene" },
  { value: "field_starts_with", label: "Inizia con" },
  { value: "field_ends_with", label: "Finisce con" },
  { value: "priority_high", label: "Priorita alta" },
  { value: "tag_contains", label: "Tag contiene" },
];

export default function ConditionsStep({
  value,
  onChange,
}: {
  value: any[];
  onChange: (v: any[]) => void;
}) {
  const addCondition = () => {
    onChange([
      ...(value || []),
      { id: uid(), type: "field_equals", config: { field: "", value: "" } },
    ]);
  };

  function update(id: string, patch: any) {
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
      <h3 className="text-lg font-semibold">Condizioni</h3>
      <p className="text-sm text-text3">
        Aggiungi condizioni opzionali che devono essere soddisfatte per eseguire le azioni.
      </p>

      <div className="mt-4 space-y-2">
        {(value || []).map((c, index) => (
          <div key={c.id}>
            {index > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text3">
                  E
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
                onChange={(e) => update(c.id, { type: e.target.value })}
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
                    placeholder="Campo"
                    value={c.config?.field ?? ""}
                    onChange={(e) =>
                      update(c.id, {
                        config: { ...(c.config || {}), field: e.target.value },
                      })
                    }
                  />
                  <input
                    className="rounded-md border border-border px-2 py-1.5 text-xs bg-background w-28"
                    placeholder="Valore"
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
                  title="Sposta su"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(c.id)}
                  disabled={index === (value || []).length - 1}
                  className="rounded p-1 text-text3 hover:bg-surface3 disabled:opacity-30"
                  title="Sposta giu"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  title="Rimuovi"
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
          Aggiungi condizione
        </button>
      </div>

      {(value || []).length === 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-border bg-background/40 p-4 text-center text-xs text-text3">
          Nessuna condizione — la regola si attivera sempre quando il trigger e soddisfatto.
        </div>
      )}
    </div>
  );
}
