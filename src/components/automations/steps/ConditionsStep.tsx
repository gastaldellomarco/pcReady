import React from "react";

function uid(prefix = 'c') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function ConditionsStep({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const addCondition = () => {
    onChange([...(value || []), { id: uid(), type: "field_equals", config: { field: "", value: "" } }]);
  };

  function update(id: string, patch: any) {
    onChange((value || []).map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remove(id: string) {
    onChange((value || []).filter((c) => c.id !== id));
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Condizioni</h3>
      <p className="text-sm text-text3">Aggiungi condizioni che devono essere soddisfatte.</p>

      <div className="mt-3 space-y-2">
        {(value || []).map((c) => (
          <div key={c.id} className="flex gap-2">
            <select value={c.type} onChange={(e) => update(c.id, { type: e.target.value })} className="rounded-md border px-2 py-1">
              <option value="field_equals">Campo uguale</option>
              <option value="priority_high">Priorità alta</option>
              <option value="tag_contains">Tag contiene</option>
            </select>
            {c.type === "field_equals" && (
              <>
                <input className="rounded-md border px-2 py-1" placeholder="field" value={c.config.field} onChange={(e) => update(c.id, { config: { ...c.config, field: e.target.value } })} />
                <input className="rounded-md border px-2 py-1" placeholder="value" value={c.config.value} onChange={(e) => update(c.id, { config: { ...c.config, value: e.target.value } })} />
              </>
            )}
            <button onClick={() => remove(c.id)} className="text-sm text-rose-600">Rimuovi</button>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button onClick={addCondition} className="rounded bg-slate-100 px-3 py-1 text-sm">Aggiungi condizione</button>
      </div>
    </div>
  );
}
