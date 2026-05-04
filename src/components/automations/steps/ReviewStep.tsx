import React from "react";
import { fmtDateTime } from "@/lib/pcready";

export default function ReviewStep({
  name,
  description,
  trigger,
  conditions,
  actions,
  schedule,
  summary,
  onChangeName,
  onChangeDescription,
}: {
  name: string;
  description: string | null;
  trigger: any;
  conditions: any[];
  actions: any[];
  schedule: any;
  summary: string;
  onChangeName: (s: string) => void;
  onChangeDescription: (s: string) => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Review & Publish</h3>
      <p className="text-sm text-text3">Controlla la regola e pubblicala.</p>

      <div className="mt-3 space-y-2">
        <div>
          <label className="text-sm">Nome</label>
          <input className="block w-full mt-1 rounded-md border px-2 py-1" value={name} onChange={(e) => onChangeName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Descrizione</label>
          <input className="block w-full mt-1 rounded-md border px-2 py-1" value={description ?? ""} onChange={(e) => onChangeDescription(e.target.value)} />
        </div>

        <div className="rounded border p-3">
          <div className="text-sm font-medium">Summary</div>
          <div className="text-sm text-text3 mt-1">{summary}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-sm font-medium">Trigger</div>
          <div className="text-sm text-text3 mt-1">{trigger?.type}</div>
        </div>

        <div className="rounded border p-3">
          <div className="text-sm font-medium">Azioni</div>
          <ul className="text-sm text-text3 mt-1 list-disc pl-5">
            {actions.map((a) => (
              <li key={a.id}>{a.type}</li>
            ))}
          </ul>
        </div>

        {schedule && (
          <div className="rounded border p-3">
            <div className="text-sm font-medium">Schedule</div>
            <div className="text-sm text-text3 mt-1">{schedule.type}{schedule.cron ? ` - ${schedule.cron}` : ""}</div>
          </div>
        )}
      </div>
    </div>
  );
}
