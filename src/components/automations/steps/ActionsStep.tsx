import React from "react";

function uid(prefix = 'a') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function ActionsStep({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  const addAction = () => {
    onChange([...(value || []), { id: uid(), type: "create_ticket", config: {} }]);
  };

  function update(id: string, patch: any) {
    onChange((value || []).map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function remove(id: string) {
    onChange((value || []).filter((c) => c.id !== id));
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Azioni</h3>
      <p className="text-sm text-text3">Definisci le azioni che verranno eseguite.</p>

      <div className="mt-3 space-y-2">
        {(value || []).map((a) => (
          <div key={a.id} className="flex gap-2">
            <select value={a.type} onChange={(e) => update(a.id, { type: e.target.value })} className="rounded-md border px-2 py-1">
              <option value="create_ticket">Crea ticket</option>
              <option value="update_status">Aggiorna stato</option>
              <option value="assign_technician">Assegna tecnico</option>
              <option value="send_email">Invia email</option>
            </select>
            <input className="rounded-md border px-2 py-1" placeholder="opzionale" value={a.config?.note ?? ""} onChange={(e) => update(a.id, { config: { ...a.config, note: e.target.value } })} />
            <button onClick={() => remove(a.id)} className="text-sm text-rose-600">Rimuovi</button>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button onClick={addAction} className="rounded bg-slate-100 px-3 py-1 text-sm">Aggiungi azione</button>
      </div>
    </div>
  );
}
