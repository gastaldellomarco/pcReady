import { Clock, Play, Plus, Square, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import {
  formatDuration,
  type TicketTimeEntry,
  useCreateManualTimeEntry,
  useDeleteTimeEntry,
  useStartTicketTimer,
  useStopTicketTimer,
  useTicketTimeSummary,
} from "@/lib/queries/ticketTimeEntries";

function toLocalInputValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  return new Date(value).toISOString();
}

/**
 *
 */
export function TicketTimeTracking({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const { user, canEdit } = useAuth();
  const summaryQuery = useTicketTimeSummary(ticketId, user?.id);
  const summary = summaryQuery.data;
  const startMut = useStartTicketTimer(ticketId);
  const stopMut = useStopTicketTimer(ticketId);
  const manualMut = useCreateManualTimeEntry(ticketId);
  const deleteMut = useDeleteTimeEntry(ticketId);
  const [description, setDescription] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStart, setManualStart] = useState(
    toLocalInputValue(new Date(Date.now() - 60 * 60 * 1000)),
  );
  const [manualEnd, setManualEnd] = useState(toLocalInputValue());
  const [manualDescription, setManualDescription] = useState("");

  const entries = useMemo(() => summary?.entries ?? [], [summary?.entries]);
  const activeEntry = summary?.activeEntry ?? null;
  const activeMinutes = activeEntry
    ? Math.max(1, Math.round((Date.now() - new Date(activeEntry.started_at).getTime()) / 60000))
    : 0;

  async function start() {
    if (!user || !canEdit)
      return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    try {
      await startMut.mutateAsync(user.id);
      toast.success(t("timeTracking.startSuccess", "Timer avviato"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("timeTracking.startError", "Errore avvio timer"));
    }
  }

  async function stop(entry: TicketTimeEntry) {
    if (!canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    try {
      await stopMut.mutateAsync({ entry, description: description || null });
      setDescription("");
      toast.success(t("timeTracking.stopSuccess", "Timer fermato"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("timeTracking.stopError", "Errore stop timer"));
    }
  }

  async function addManual(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !canEdit)
      return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    const started = new Date(manualStart).getTime();
    const ended = new Date(manualEnd).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) {
      return toast.error(t("timeTracking.invalidInterval", "Intervallo orario non valido"));
    }
    try {
      await manualMut.mutateAsync({
        userId: user.id,
        startedAt: fromLocalInputValue(manualStart),
        endedAt: fromLocalInputValue(manualEnd),
        description: manualDescription || null,
      });
      setManualDescription("");
      setManualOpen(false);
      toast.success(t("timeTracking.manualSuccess", "Tempo inserito"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("timeTracking.manualError", "Errore inserimento tempo"));
    }
  }

  async function remove(id: string) {
    if (!canEdit) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t("timeTracking.deleteSuccess", "Intervallo eliminato"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("timeTracking.deleteError", "Errore eliminazione intervallo"));
    }
  }

  return (
    <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[13px] font-bold">
            <Clock className="size-4 text-text3" /> {t("timeTracking.title", "Tempo lavorato")}
          </h3>
          <p className="text-[11px] text-text3">
            {t("timeTracking.total", "Totale registrato: {{duration}}", {
              duration: formatDuration(summary?.totalMinutes ?? 0),
            })}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {activeEntry ? (
              <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={() => stop(activeEntry)}>
                <Square className="size-3" /> {t("timeTracking.stop", "Stop")}{" "}
                {formatDuration(activeMinutes)}
              </button>
            ) : (
              <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={start}>
                <Play className="size-3" /> {t("timeTracking.start", "Avvia timer")}
              </button>
            )}
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => setManualOpen((v) => !v)}
            >
              <Plus className="size-3" /> {t("timeTracking.manual", "Manuale")}
            </button>
          </div>
        )}
      </div>

      {activeEntry && (
        <div
          className="mb-3 rounded-lg border p-3"
          style={{ borderColor: "var(--accent)", background: "rgba(27,79,216,.06)" }}
        >
          <div className="mb-2 text-[12px] font-semibold">
            {t("timeTracking.timerActive", "Timer attivo da {{date}}", {
              date: fmtDateTime(activeEntry.started_at),
            })}
          </div>
          <input
            className="pc-input w-full"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t(
              "timeTracking.descriptionPlaceholder",
              "Descrizione lavoro (opzionale, salvata allo stop)",
            )}
            aria-label={t("timeTracking.descriptionLabel", "Descrizione lavoro")}
          />
        </div>
      )}

      {manualOpen && canEdit && (
        <form
          onSubmit={addManual}
          className="mb-3 grid gap-2 rounded-lg border p-3 md:grid-cols-2"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <label className="text-[12px] font-semibold">
            {t("timeTracking.startLabel", "Inizio")}
            <input
              type="datetime-local"
              className="pc-input mt-1 w-full"
              value={manualStart}
              onChange={(event) => setManualStart(event.target.value)}
            />
          </label>
          <label className="text-[12px] font-semibold">
            {t("timeTracking.endLabel", "Fine")}
            <input
              type="datetime-local"
              className="pc-input mt-1 w-full"
              value={manualEnd}
              onChange={(event) => setManualEnd(event.target.value)}
            />
          </label>
          <input
            className="pc-input md:col-span-2"
            value={manualDescription}
            onChange={(event) => setManualDescription(event.target.value)}
            placeholder={t("timeTracking.activityPlaceholder", "Descrizione attività")}
            aria-label={t("timeTracking.activityLabel", "Descrizione attività")}
          />
          <div className="md:col-span-2 flex justify-end">
            <button className="pc-btn pc-btn-primary pc-btn-sm" type="submit">
              {t("timeTracking.save", "Salva intervallo")}
            </button>
          </div>
        </form>
      )}

      {summaryQuery.isLoading && (
        <div className="text-[12px] text-text3">
          {t("timeTracking.loadingText", "Caricamento tempi...")}
        </div>
      )}
      {!summaryQuery.isLoading && entries.length === 0 && (
        <div className="text-[12px] text-text3">
          {t("timeTracking.emptyText", "Nessun tempo registrato")}
        </div>
      )}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">
              {entry.user?.initials || "??"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold">
                {entry.user?.full_name || t("timeTracking.user", "Utente")} ·{" "}
                {entry.ended_at
                  ? formatDuration(entry.duration_minutes ?? 0)
                  : `${t("timeTracking.active", "attivo")} (${formatDuration(Math.max(1, Math.round((Date.now() - new Date(entry.started_at).getTime()) / 60000)))})`}
              </div>
              <div className="text-[11px] text-text3">
                {fmtDateTime(entry.started_at)} {"->"}{" "}
                {entry.ended_at
                  ? fmtDateTime(entry.ended_at)
                  : t("timeTracking.inProgress", "in corso")}
              </div>
              {entry.description && (
                <div className="mt-1 text-[12px] text-text2">{entry.description}</div>
              )}
            </div>
            {canEdit && entry.ended_at && (
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm text-red-600"
                onClick={() => remove(entry.id)}
              >
                <Trash2 className="size-3" /> {t("timeTracking.delete", "Elimina")}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
