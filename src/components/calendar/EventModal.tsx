import { useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  type CalendarEvent,
  type CalendarEventType,
  type CreateCalendarEventData,
} from "@/lib/queries/calendar";
import { pcReadyColors } from "@/lib/design-system";
import { EVENT_TYPE_COLORS } from "./eventColors";
import type { TechnicianOption } from "./types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  defaultHour?: number | null;
  technicians: TechnicianOption[];
  currentUserId: string;
  canEdit: boolean;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPE_VALUES: CalendarEventType[] = ["intervention", "deadline", "appointment", "availability"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function dateToInput(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function timeToInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ---------------------------------------------------------------------------
// EventModal
// ---------------------------------------------------------------------------

export function EventModal({
  open,
  onClose,
  event,
  defaultDate,
  defaultHour,
  technicians,
  currentUserId,
  canEdit,
  onSaved,
}: EventModalProps) {
  const { t } = useTranslation("calendar");
  const isEdit = !!event;
  const baseDate = defaultDate ?? new Date();

  // ── Derive initial date/time values ──────────────────────────────────────
  const initStartDate = event ? dateToInput(parseISO(event.start_at)) : dateToInput(baseDate);
  const initEndDate = event ? dateToInput(parseISO(event.end_at)) : dateToInput(baseDate);

  const startHourDefault = defaultHour ?? 9;
  const endHourDefault = Math.min(startHourDefault + 1, 23);
  const initStartTime = event
    ? timeToInput(parseISO(event.start_at))
    : `${pad(startHourDefault)}:00`;
  const initEndTime = event
    ? timeToInput(parseISO(event.end_at))
    : startHourDefault >= 23
      ? "23:59"
      : `${pad(endHourDefault)}:00`;

  // ── Form state ────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventType, setEventType] = useState<CalendarEventType>(
    event?.event_type ?? "intervention",
  );
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startDate, setStartDate] = useState(initStartDate);
  const [startTime, setStartTime] = useState(initStartTime);
  const [endDate, setEndDate] = useState(initEndDate);
  const [endTime, setEndTime] = useState(initEndTime);
  const [assigneeId, setAssigneeId] = useState<string | null>(event?.assignee_id ?? null);
  const [ticketId, setTicketId] = useState<string | null>(event?.ticket_id ?? null);
  const [ticketCode, setTicketCode] = useState<string>(event?.ticket_code ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>(
    event?.estimated_duration_minutes != null ? String(event.estimated_duration_minutes) : "",
  );
  const [color, setColor] = useState<string>(event?.color ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!title.trim()) {
      next.title = t("validation.titleRequired", "Il titolo è obbligatorio");
    }

    const startMs = allDay
      ? new Date(`${startDate}T00:00:00`).getTime()
      : new Date(`${startDate}T${startTime}:00`).getTime();
    const endMs = allDay
      ? new Date(`${endDate}T23:59:59`).getTime()
      : new Date(`${endDate}T${endTime}:00`).getTime();

    if (startMs >= endMs) {
      next.end = t("validation.endAfterStart", "La data di fine deve essere successiva alla data di inizio");
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  function handleSave() {
    if (!validate()) return;

    const start_at = allDay
      ? new Date(`${startDate}T00:00:00`).toISOString()
      : buildISO(startDate, startTime);
    const end_at = allDay
      ? new Date(`${endDate}T23:59:59`).toISOString()
      : buildISO(endDate, endTime);

    const payload: CreateCalendarEventData = {
      title: title.trim(),
      event_type: eventType,
      start_at,
      end_at,
      all_day: allDay,
      assignee_id: assigneeId ?? null,
      ticket_id: ticketId ?? null,
      estimated_duration_minutes: estimatedMinutes ? Number(estimatedMinutes) || null : null,
      color: color || null,
      notes: notes.trim() || null,
    };

    if (isEdit && event) {
      updateMutation.mutate(
        { id: event.id, data: payload },
        {
          onSuccess: () => {
            toast.success(t("toasts.eventUpdated", "Evento aggiornato"));
            onSaved();
            onClose();
          },
          onError: (err) => toast.error(t("toasts.updateError", "Errore nell'aggiornamento: {{message}}", { message: err.message })),
        },
      );
    } else {
      createMutation.mutate(
        { data: payload, createdBy: currentUserId },
        {
          onSuccess: () => {
            toast.success(t("toasts.eventCreated", "Evento creato"));
            onSaved();
            onClose();
          },
          onError: (err) => toast.error(t("toasts.createError", "Errore nella creazione: {{message}}", { message: err.message })),
        },
      );
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!event) return;
    deleteMutation.mutate(event.id, {
      onSuccess: () => {
        toast.success(t("toasts.eventDeleted", "Evento eliminato"));
        onSaved();
        onClose();
      },
      onError: (err) => toast.error(t("toasts.deleteError", "Errore nell'eliminazione: {{message}}", { message: err.message })),
    });
  }

  // ── Clear linked ticket ───────────────────────────────────────────────────
  function clearTicket() {
    setTicketId(null);
    setTicketCode("");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("modal.editTitle", "Modifica evento") : t("modal.newTitle", "Nuovo evento")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          {/* ── Titolo ─────────────────────────────────────────── */}
          <div className="grid gap-1.5">
            <Label htmlFor="em-title">{t("modal.titleLabel", "Titolo *")}</Label>
            <Input
              id="em-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("modal.titlePlaceholder", "Titolo dell'evento")}
              disabled={!canEdit || isPending}
            />
            {errors.title && (
              <p className="text-xs" style={{ color: pcReadyColors.danger }}>
                {errors.title}
              </p>
            )}
          </div>

          {/* ── Tipo evento ────────────────────────────────────── */}
          <div className="grid gap-1.5">
            <Label>{t("modal.typeLabel", "Tipo evento")}</Label>
            <Select
              value={eventType}
              onValueChange={(v) => setEventType(v as CalendarEventType)}
              disabled={!canEdit || isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: EVENT_TYPE_COLORS[value].fg }}
                      />
                      {EVENT_TYPE_COLORS[value].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Todo il giorno ─────────────────────────────────── */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="em-allday"
              checked={allDay}
              onCheckedChange={(checked) => setAllDay(!!checked)}
              disabled={!canEdit || isPending}
            />
            <Label htmlFor="em-allday" className="cursor-pointer font-normal">
              {t("modal.allDayLabel", "Tutto il giorno")}
            </Label>
          </div>

          {/* ── Date / time ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="em-start-date">{t("modal.startDateLabel", "Data inizio *")}</Label>
              <Input
                id="em-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEdit || isPending}
              />
            </div>
            {!allDay && (
              <div className="grid gap-1.5">
                <Label htmlFor="em-start-time">{t("modal.startTimeLabel", "Ora inizio")}</Label>
                <Input
                  id="em-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={!canEdit || isPending}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="em-end-date">{t("modal.endDateLabel", "Data fine *")}</Label>
              <Input
                id="em-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!canEdit || isPending}
              />
            </div>
            {!allDay && (
              <div className="grid gap-1.5">
                <Label htmlFor="em-end-time">{t("modal.endTimeLabel", "Ora fine")}</Label>
                <Input
                  id="em-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={!canEdit || isPending}
                />
              </div>
            )}
          </div>

          {errors.end && (
            <p className="text-xs -mt-2" style={{ color: pcReadyColors.danger }}>
              {errors.end}
            </p>
          )}

          {/* ── Tecnico assegnato ──────────────────────────────── */}
          <div className="grid gap-1.5">
            <Label>{t("modal.assigneeLabel", "Tecnico assegnato")}</Label>
            <Select
              value={assigneeId ?? "__none__"}
              onValueChange={(v) => setAssigneeId(v === "__none__" ? null : v)}
              disabled={!canEdit || isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("modal.assigneeNone", "Nessuno")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("modal.assigneeNone", "Nessuno")}</SelectItem>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: pcReadyColors.primary }}
                      >
                        {tech.initials}
                      </span>
                      {tech.full_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Ticket collegato ───────────────────────────────── */}
          <div className="grid gap-1.5">
            <Label htmlFor="em-ticket">{t("modal.ticketLabel", "Ticket collegato")}</Label>
            <div className="flex gap-2">
              <Input
                id="em-ticket"
                value={ticketCode}
                readOnly
                placeholder={t("modal.ticketPlaceholder", "Nessun ticket collegato")}
                className="flex-1 bg-muted/30 cursor-default"
              />
              {ticketId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={clearTicket}
                  disabled={!canEdit || isPending}
                  title={t("modal.ticketRemoveTitle", "Rimuovi collegamento ticket")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!ticketId && (
              <p className="text-xs" style={{ color: pcReadyColors.textMuted }}>
                {t("modal.ticketHelp", "Il collegamento ticket non può essere modificato da qui.")}
              </p>
            )}
          </div>

          {/* ── Durata stimata ─────────────────────────────────── */}
          <div className="grid gap-1.5">
            <Label htmlFor="em-duration">{t("modal.durationLabel", "Durata (min)")}</Label>
            <Input
              id="em-duration"
              type="number"
              min="0"
              step="15"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder={t("modal.durationPlaceholder", "es. 60")}
              disabled={!canEdit || isPending}
            />
          </div>

          {/* ── Colore personalizzato ──────────────────────────── */}
          <div className="grid gap-1.5">
            <Label htmlFor="em-color">{t("modal.colorLabel", "Colore personalizzato")}</Label>
            <div className="flex items-center gap-3">
              <input
                id="em-color"
                type="color"
                value={color || "#2563EB"}
                onChange={(e) => setColor(e.target.value)}
                disabled={!canEdit || isPending}
                className="h-9 w-14 rounded border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: pcReadyColors.border }}
              />
              <span className="text-sm" style={{ color: pcReadyColors.textSecondary }}>
                {color || t("modal.colorAuto", "Colore automatico dal tipo evento")}
              </span>
              {color && canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setColor("")}
                  disabled={isPending}
                  className="ml-auto"
                >
                  {t("modal.colorReset", "Ripristina")}
                </Button>
              )}
            </div>
          </div>

          {/* ── Note ──────────────────────────────────────────── */}
          <div className="grid gap-1.5">
            <Label htmlFor="em-notes">{t("modal.notesLabel", "Note")}</Label>
            <Textarea
              id="em-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("modal.notesPlaceholder", "Note aggiuntive sull'evento...")}
              rows={3}
              disabled={!canEdit || isPending}
            />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        <DialogFooter className="flex-wrap gap-2 pt-2">
          {/* Delete area — only in edit mode for editors */}
          {isEdit && canEdit && (
            <div className="mr-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-sm font-medium" style={{ color: pcReadyColors.danger }}>
                    {t("modal.confirmDelete", "Confermare l'eliminazione?")}
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isPending}
                  >
                    {t("modal.deleteButton", "Elimina")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isPending}
                  >
                    {t("modal.noButton", "No")}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  style={{ color: pcReadyColors.danger, borderColor: pcReadyColors.danger }}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {t("modal.deleteButton", "Elimina")}
                </Button>
              )}
            </div>
          )}

          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t("modal.cancelButton", "Annulla")}
          </Button>

          {canEdit && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              style={{ background: pcReadyColors.primary, color: "#fff" }}
            >
              {isPending ? t("modal.savingButton", "Salvataggio…") : t("modal.saveButton", "Salva")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
