import React from "react";

export default function TriggerStep({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Trigger</h3>
      <p className="text-sm text-text3">Scegli il tipo di trigger e configura le opzioni.</p>

      <div className="mt-3 flex items-center gap-2">
        <select
          className="rounded-md border px-2 py-1"
          value={value?.type ?? ""}
          onChange={(e) => onChange({ type: e.target.value, config: {} })}
        >
          <option value="">-- Seleziona trigger --</option>
          <option value="ticket_created">Ticket creato</option>
          <option value="ticket_updated">Ticket aggiornato</option>
          <option value="checklist_completed">Checklist completata</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      {value?.type === "scheduled" && (
        <div className="mt-3">
          <label className="text-sm">Cron/Expression</label>
          <input
            className="mt-1 rounded-md border px-2 py-1 w-full"
            value={value.config?.cron ?? ""}
            onChange={(e) => onChange({ ...value, config: { ...(value.config || {}), cron: e.target.value } })}
            placeholder="es. 0 8 * * *"
          />
        </div>
      )}
    </div>
  );
}
