import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtDateTime } from "@/lib/pcready";
import {
  MAINTENANCE_RECURRENCE_LABEL,
  MAINTENANCE_STATUS_META,
  completeMaintenanceSchedule,
  createMaintenanceSchedule,
  daysUntilDate,
  fetchDeviceMaintenanceSchedules,
  fetchMaintenanceHistory,
  fetchTechnicianOptions,
  getMaintenanceStatus,
  todayIsoDate,
  type MaintenanceRecurrence,
  type MaintenanceSchedule,
  type MaintenanceHistoryEntry,
  type TechnicianOption,
} from "@/lib/maintenance";

export function MaintenanceStatusBadge({ schedule }: { schedule: MaintenanceSchedule }) {
  const status = getMaintenanceStatus(schedule);
  const meta = MAINTENANCE_STATUS_META[status];
  return (
    <span
      className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: meta.color, background: meta.background, borderColor: meta.color }}
    >
      {meta.label}
    </span>
  );
}

export function MaintenanceSchedulePanel({
  deviceId,
  currentUserId,
  canEdit,
  compact = false,
}: {
  deviceId: string;
  currentUserId?: string | null;
  canEdit: boolean;
  compact?: boolean;
}) {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [history, setHistory] = useState<MaintenanceHistoryEntry[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "Pulizia hardware",
    description: "",
    recurrence: "monthly" as MaintenanceRecurrence,
    next_due_date: todayIsoDate(),
    assigned_to: "",
    auto_create_ticket: false,
    ticket_title: "",
    ticket_description: "",
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchDeviceMaintenanceSchedules(deviceId),
      fetchMaintenanceHistory(deviceId),
      fetchTechnicianOptions().catch(() => []),
    ])
      .then(([scheduleRows, historyRows, technicianRows]) => {
        if (cancelled) return;
        setSchedules(scheduleRows);
        setHistory(historyRows);
        setTechnicians(technicianRows);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Errore manutenzioni"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const sortedSchedules = useMemo(
    () => [...schedules].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)),
    [schedules],
  );

  async function submitSchedule() {
    if (!draft.title.trim()) return toast.error("Inserisci un titolo per la manutenzione");
    setSaving(true);
    try {
      const created = await createMaintenanceSchedule({
        device_id: deviceId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        recurrence: draft.recurrence,
        next_due_date: draft.next_due_date,
        assigned_to: draft.assigned_to || null,
        auto_create_ticket: draft.auto_create_ticket,
        ticket_template: draft.auto_create_ticket
          ? {
              title: draft.ticket_title.trim() || draft.title.trim(),
              description: draft.ticket_description.trim() || draft.description.trim(),
            }
          : null,
      });
      setSchedules((rows) => [...rows, created]);
      setShowForm(false);
      toast.success("Manutenzione programmata creata");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore creazione manutenzione");
    } finally {
      setSaving(false);
    }
  }

  async function markCompleted(schedule: MaintenanceSchedule) {
    setCompletingId(schedule.id);
    try {
      const updated = await completeMaintenanceSchedule(schedule, currentUserId);
      setSchedules((rows) => rows.map((row) => (row.id === schedule.id ? updated : row)));
      const historyRows = await fetchMaintenanceHistory(deviceId).catch(() => history);
      setHistory(historyRows);
      toast.success("Manutenzione completata e prossima scadenza aggiornata");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore completamento manutenzione");
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="pc-label">Manutenzione programmata</div>
          <p className="mt-1 text-[11px] text-text3">
            Pianifica interventi ricorrenti, traccia completamenti e abilita ticket automatici.
          </p>
        </div>
        {canEdit ? (
          <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3 w-3" /> Nuova manutenzione
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              <span className="pc-label">Titolo</span>
              <input
                className="pc-input mt-1 w-full"
                value={draft.title}
                onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))}
                placeholder="Pulizia hardware"
              />
            </label>
            <label className="text-xs">
              <span className="pc-label">Ricorrenza</span>
              <select
                className="pc-input mt-1 w-full"
                value={draft.recurrence}
                onChange={(e) =>
                  setDraft((v) => ({ ...v, recurrence: e.target.value as MaintenanceRecurrence }))
                }
              >
                {Object.entries(MAINTENANCE_RECURRENCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="pc-label">Prossima scadenza</span>
              <input
                type="date"
                className="pc-input mt-1 w-full"
                value={draft.next_due_date}
                onChange={(e) => setDraft((v) => ({ ...v, next_due_date: e.target.value }))}
              />
            </label>
            <label className="text-xs">
              <span className="pc-label">Tecnico assegnato</span>
              <select
                className="pc-input mt-1 w-full"
                value={draft.assigned_to}
                onChange={(e) => setDraft((v) => ({ ...v, assigned_to: e.target.value }))}
              >
                <option value="">Non assegnato</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs md:col-span-2">
              <span className="pc-label">Descrizione</span>
              <textarea
                className="pc-input mt-1 min-h-[70px] w-full"
                value={draft.description}
                onChange={(e) => setDraft((v) => ({ ...v, description: e.target.value }))}
                placeholder="Dettagli operativi, checklist o note per il tecnico..."
              />
            </label>
            <label className="flex items-center gap-2 text-xs md:col-span-2">
              <input
                type="checkbox"
                checked={draft.auto_create_ticket}
                onChange={(e) => setDraft((v) => ({ ...v, auto_create_ticket: e.target.checked }))}
              />
              Crea automaticamente un ticket alla scadenza
            </label>
            {draft.auto_create_ticket ? (
              <>
                <label className="text-xs">
                  <span className="pc-label">Titolo ticket</span>
                  <input
                    className="pc-input mt-1 w-full"
                    value={draft.ticket_title}
                    onChange={(e) => setDraft((v) => ({ ...v, ticket_title: e.target.value }))}
                    placeholder={draft.title}
                  />
                </label>
                <label className="text-xs">
                  <span className="pc-label">Descrizione ticket</span>
                  <input
                    className="pc-input mt-1 w-full"
                    value={draft.ticket_description}
                    onChange={(e) => setDraft((v) => ({ ...v, ticket_description: e.target.value }))}
                    placeholder="Descrizione predefinita"
                  />
                </label>
              </>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="pc-btn pc-btn-primary pc-btn-sm" disabled={saving} onClick={submitSchedule}>
              {saving ? "Salvataggio..." : "Salva pianificazione"}
            </button>
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => setShowForm(false)}>
              Annulla
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr>
              {["Intervento", "Stato", "Scadenza", "Ricorrenza", "Tecnico", "Azioni"].map((h) => (
                <th key={h} className="border-b px-3 py-2 text-left text-[10px] font-bold uppercase text-text3" style={{ borderColor: "var(--border)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSchedules.map((schedule) => {
              const days = daysUntilDate(schedule.next_due_date);
              return (
                <tr key={schedule.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{schedule.title}</div>
                    {schedule.description ? <div className="text-[11px] text-text3">{schedule.description}</div> : null}
                    {schedule.auto_create_ticket ? <div className="mt-1 text-[10px] text-accent">Ticket automatico attivo</div> : null}
                  </td>
                  <td className="px-3 py-2"><MaintenanceStatusBadge schedule={schedule} /></td>
                  <td className="px-3 py-2">
                    <div>{fmtDate(schedule.next_due_date)}</div>
                    <div className="text-[11px] text-text3">{days == null ? "" : days < 0 ? `${Math.abs(days)} giorni fa` : `tra ${days} giorni`}</div>
                  </td>
                  <td className="px-3 py-2">{MAINTENANCE_RECURRENCE_LABEL[schedule.recurrence]}</td>
                  <td className="px-3 py-2">{schedule.assignee?.display_name || schedule.assigned_to?.slice(0, 8) || "—"}</td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-sm"
                        disabled={completingId === schedule.id}
                        onClick={() => void markCompleted(schedule)}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {completingId === schedule.id ? "Aggiornamento..." : "Segna completata"}
                      </button>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {!sortedSchedules.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-text3">
                  {loading ? "Caricamento manutenzioni..." : "Nessuna manutenzione programmata per questo dispositivo."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!compact ? (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Wrench className="h-3.5 w-3.5" /> Storico interventi
          </div>
          <div className="flex flex-col gap-2">
            {history.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 text-[12px]">
                <CalendarDays className="mt-0.5 h-3.5 w-3.5 text-text3" />
                <div>
                  <div className="font-semibold">Completata il {fmtDateTime(entry.completed_at)}</div>
                  {entry.notes ? <div className="text-text3">{entry.notes}</div> : null}
                </div>
              </div>
            ))}
            {!history.length ? <div className="text-[12px] text-text3">Nessun intervento completato registrato.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
