import { NOTIFICATION_TYPES } from "@/lib/notifications";

function uid(prefix = "a") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const ACTION_TYPES = [
  { value: "send_email", label: "Invia email" },
  { value: "update_ticket_status", label: "Aggiorna stato ticket" },
  { value: "create_notification", label: "Notifica in-app" },
  { value: "update_device_status", label: "Aggiorna stato dispositivo" },
  { value: "assign_ticket", label: "Assegna ticket" },
] as const;

const TICKET_STATUSES = [
  { value: "pending", label: "In attesa" },
  { value: "in-progress", label: "In corso" },
  { value: "testing", label: "In test" },
  { value: "ready", label: "Pronto" },
] as const;

const DEVICE_STATUSES = [
  { value: "available", label: "Disponibile" },
  { value: "assigned", label: "Assegnato" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "retired", label: "Dismesso" },
] as const;

function defaultConfigForType(type: string): Record<string, unknown> {
  switch (type) {
    case "send_email":
      return { to: "", subject: "", body: "", is_html: false };
    case "update_ticket_status":
      return { ticket_id: "", status: "ready" };
    case "create_notification":
      return { user_id: "", type: "ticket_status_changed", title: "", body: "", link: "" };
    case "update_device_status":
      return { device_id: "", status: "available" };
    case "assign_ticket":
      return { ticket_id: "", assignee_id: "" };
    default:
      return {};
  }
}

export default function ActionsStep({
  value,
  onChange,
}: {
  value: any[];
  onChange: (v: any[]) => void;
}) {
  const addAction = () => {
    onChange([
      ...(value || []),
      { id: uid(), type: "send_email", config: defaultConfigForType("send_email") },
    ]);
  };

  function updateConfig(id: string, configPatch: Record<string, unknown>) {
    onChange(
      (value || []).map((c) =>
        c.id === id ? { ...c, config: { ...c.config, ...configPatch } } : c,
      ),
    );
  }

  function setType(id: string, type: string) {
    onChange(
      (value || []).map((c) =>
        c.id === id ? { ...c, type, config: defaultConfigForType(type) } : c,
      ),
    );
  }

  function remove(id: string) {
    onChange((value || []).filter((c) => c.id !== id));
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Azioni</h3>
      <p className="text-sm text-text3">
        Definisci le azioni eseguite dal runtime (Supabase / email).
      </p>
      <p className="mt-1 text-xs text-text3">
        Ticket e dispositivo: lascia vuoto l&apos;ID se il trigger invia{" "}
        <code className="text-xs">ticket_id</code> / <code className="text-xs">device_id</code> nel
        payload.
      </p>

      <div className="mt-3 space-y-4">
        {(value || []).map((a) => (
          <div key={a.id} className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={a.type}
                onChange={(e) => setType(a.id, e.target.value)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                {ACTION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => remove(a.id)} className="text-sm text-rose-600">
                Rimuovi
              </button>
            </div>

            {a.type === "send_email" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs sm:col-span-2">
                  Destinatario (opzionale se nel payload trigger)
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.to as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { to: e.target.value })}
                    placeholder="cliente@esempio.it"
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  Oggetto
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.subject as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { subject: e.target.value })}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  Corpo
                  <textarea
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    rows={3}
                    value={(a.config?.body as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { body: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(a.config?.is_html)}
                    onChange={(e) => updateConfig(a.id, { is_html: e.target.checked })}
                  />
                  Corpo è HTML
                </label>
              </div>
            )}

            {a.type === "update_ticket_status" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  Ticket ID
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.ticket_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { ticket_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
                <label className="text-xs">
                  Stato
                  <select
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.status as string) ?? "ready"}
                    onChange={(e) => updateConfig(a.id, { status: e.target.value })}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {a.type === "create_notification" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  User ID (auth / profile)
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.user_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { user_id: e.target.value })}
                    placeholder="UUID — o usa assignee_id nel payload"
                  />
                </label>
                <label className="text-xs">
                  Tipo
                  <select
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.type as string) ?? "ticket_status_changed"}
                    onChange={(e) => updateConfig(a.id, { type: e.target.value })}
                  >
                    {NOTIFICATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs sm:col-span-2">
                  Titolo
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.title as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { title: e.target.value })}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  Messaggio
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.body as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { body: e.target.value })}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  Link
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.link as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { link: e.target.value })}
                    placeholder="/tickets"
                  />
                </label>
              </div>
            )}

            {a.type === "update_device_status" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  Device ID
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.device_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { device_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
                <label className="text-xs">
                  Stato
                  <select
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.status as string) ?? "available"}
                    onChange={(e) => updateConfig(a.id, { status: e.target.value })}
                  >
                    {DEVICE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {a.type === "assign_ticket" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  Ticket ID
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.ticket_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { ticket_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
                <label className="text-xs">
                  Assegnatario (profile / user UUID)
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.assignee_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { assignee_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={addAction}
          className="rounded bg-slate-100 px-3 py-1 text-sm"
        >
          Aggiungi azione
        </button>
      </div>
    </div>
  );
}
