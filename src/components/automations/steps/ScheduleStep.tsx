import React from "react";

export default function ScheduleStep({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Schedule</h3>
      <p className="text-sm text-text3">Imposta la schedulazione (opzionale).</p>

      <div className="mt-3">
        <label className="text-sm">Tipo</label>
        <select className="ml-2 rounded-md border px-2 py-1" value={value?.type ?? "none"} onChange={(e) => onChange({ type: e.target.value })}>
          <option value="none">Nessuna</option>
          <option value="cron">Cron</option>
          <option value="interval">Intervallo</option>
        </select>
      </div>

      {value?.type === "cron" && (
        <div className="mt-3">
          <label className="text-sm">Expression</label>
          <input className="block mt-1 rounded-md border px-2 py-1 w-full" value={value?.cron ?? ""} onChange={(e) => onChange({ ...value, cron: e.target.value })} />
        </div>
      )}
    </div>
  );
}
