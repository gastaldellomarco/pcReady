import { format, parseISO } from "date-fns";
import { Bell, Link as LinkIcon, Repeat, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { pcReadyColors } from "@/lib/design-system";
import {
  fetchCalendarClientOptions,
  fetchCalendarTicketOptions,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  useUpdateCalendarEvent,
  useUpdateRecurringOccurrence,
  type AvailabilityStatus,
  type CalendarEvent,
  type CalendarEventType,
  type CreateCalendarEventData,
  type RecurrenceFrequency,
  type ReminderChannel,
} from "@/lib/queries/calendar";
import { EVENT_TYPE_COLORS } from "./eventColors";
import type { TechnicianOption } from "./types";

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  defaultHour?: number | null;
  defaultEndDate?: Date | null;
  technicians: TechnicianOption[];
  currentUserId: string;
  canEdit: boolean;
  onSaved: () => void;
}

const EVENT_TYPE_VALUES: CalendarEventType[] = ["intervention", "deadline", "appointment", "availability"];
const RECURRENCE_VALUES: Array<"none" | RecurrenceFrequency> = ["none", "daily", "weekly", "monthly", "custom"];
const AVAILABILITY_VALUES: AvailabilityStatus[] = ["available", "vacation", "sick_leave", "unavailable"];
const REMINDER_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 h", value: 60 },
  { label: "2 h", value: 120 },
  { label: "1 giorno", value: 1440 },
];

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

/**
 *
 */
export function EventModal({
  open,
  onClose,
  event,
  defaultDate,
  defaultHour,
  defaultEndDate,
  technicians,
  currentUserId,
  canEdit,
  onSaved,
}: EventModalProps) {
  const { t } = useTranslation("calendar");
  const isEdit = !!event;
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const updateOccurrenceMutation = useUpdateRecurringOccurrence();
  const deleteMutation = useDeleteCalendarEvent();

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("intervention");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [ticketIds, setTicketIds] = useState<string[]>([]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("available");
  const [recurrence, setRecurrence] = useState<"none" | RecurrenceFrequency>("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [reminderOffset, setReminderOffset] = useState("");
  const [reminderChannel, setReminderChannel] = useState<ReminderChannel>("in_app");
  const [editScope, setEditScope] = useState<"single" | "series">("single");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [clientOptions, setClientOptions] = useState<Array<{ id: string; name: string; company_name: string | null }>>([]);
  const [ticketOptions, setTicketOptions] = useState<Array<{ id: string; ticket_code: string; client: string | null; client_id: string | null }>>([]);

  const isPending = createMutation.isPending || updateMutation.isPending || updateOccurrenceMutation.isPending || deleteMutation.isPending;

  useEffect(() => {
    if (!open) return;
    const baseDate = defaultDate ?? new Date();
    const start = event ? parseISO(event.start_at) : baseDate;
    const end = event ? parseISO(event.end_at) : defaultEndDate ?? new Date(baseDate.getTime() + 60 * 60 * 1000);
    const startHourDefault = defaultHour ?? (start.getHours() || 9);

    setTitle(event?.title ?? "");
    setEventType(event?.event_type ?? "intervention");
    setAllDay(event?.all_day ?? false);
    setStartDate(dateToInput(event ? start : baseDate));
    setStartTime(event ? timeToInput(start) : `${pad(startHourDefault)}:00`);
    setEndDate(dateToInput(end));
    setEndTime(timeToInput(end));
    setAssigneeId(event?.assignee_id ?? null);
    setClientId(event?.client_id ?? null);
    setTicketIds(event?.tickets?.length ? event.tickets.map((ticket) => ticket.id) : event?.ticket_id ? [event.ticket_id] : []);
    setEstimatedMinutes(event?.estimated_duration_minutes != null ? String(event.estimated_duration_minutes) : "");
    setColor(event?.color ?? "");
    setNotes(event?.notes ?? "");
    setAvailabilityStatus(event?.availability_status ?? "available");
    setRecurrence(event?.recurrence_frequency ?? "none");
    setRecurrenceInterval(String(event?.recurrence_interval ?? 1));
    setRecurrenceUntil(event?.recurrence_until ?? "");
    setReminderOffset(event?.reminders?.[0]?.offset_minutes ? String(event.reminders[0].offset_minutes) : "");
    setReminderChannel(event?.reminders?.[0]?.channel ?? "in_app");
    setEditScope("single");
    setConfirmDelete(false);
    setErrors({});
  }, [defaultDate, defaultEndDate, defaultHour, event, open]);

  useEffect(() => {
    if (!open) return;
    fetchCalendarClientOptions("").then(setClientOptions).catch(() => setClientOptions([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchCalendarTicketOptions(ticketSearch).then(setTicketOptions).catch(() => setTicketOptions([]));
  }, [open, ticketSearch]);

  const selectedTickets = useMemo(
    () =>
      ticketIds.map((id) => ticketOptions.find((option) => option.id === id) ?? event?.tickets?.find((ticket) => ticket.id === id)),
    [event?.tickets, ticketIds, ticketOptions],
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("validation.titleRequired", "Il titolo e obbligatorio");
    const startMs = allDay ? new Date(`${startDate}T00:00:00`).getTime() : new Date(`${startDate}T${startTime}:00`).getTime();
    const endMs = allDay ? new Date(`${endDate}T23:59:59`).getTime() : new Date(`${endDate}T${endTime}:00`).getTime();
    if (startMs >= endMs) next.end = t("validation.endAfterStart", "La data di fine deve essere successiva alla data di inizio");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function toggleTicket(ticketId: string) {
    setTicketIds((ids) => (ids.includes(ticketId) ? ids.filter((id) => id !== ticketId) : [...ids, ticketId]));
  }

  function payload(): CreateCalendarEventData {
    return {
      title: title.trim(),
      event_type: eventType,
      start_at: allDay ? new Date(`${startDate}T00:00:00`).toISOString() : buildISO(startDate, startTime),
      end_at: allDay ? new Date(`${endDate}T23:59:59`).toISOString() : buildISO(endDate, endTime),
      all_day: allDay,
      assignee_id: assigneeId,
      client_id: clientId,
      ticket_id: ticketIds[0] ?? null,
      ticket_ids: ticketIds,
      estimated_duration_minutes: estimatedMinutes ? Number(estimatedMinutes) || null : null,
      color: color || null,
      notes: notes.trim() || null,
      availability_status: eventType === "availability" ? availabilityStatus : null,
      recurrence_frequency: recurrence === "none" ? null : recurrence,
      recurrence_interval: recurrence === "none" ? null : Number(recurrenceInterval) || 1,
      recurrence_until: recurrence === "none" || !recurrenceUntil ? null : recurrenceUntil,
      reminders: reminderOffset ? [{ offset_minutes: Number(reminderOffset), channel: reminderChannel }] : [],
    };
  }

  function handleSave() {
    if (!validate()) return;
    const data = payload();
    const callbacks = {
      onSuccess: () => {
        toast.success(isEdit ? t("toasts.eventUpdated", "Evento aggiornato") : t("toasts.eventCreated", "Evento creato"));
        onSaved();
        onClose();
      },
      onError: (err: Error) => toast.error(err.message),
    };

    if (!event) {
      createMutation.mutate({ data, createdBy: currentUserId }, callbacks);
      return;
    }

    if (event.is_recurring_instance && editScope === "single") {
      updateOccurrenceMutation.mutate({ event, data, createdBy: currentUserId }, callbacks);
      return;
    }

    updateMutation.mutate({ id: event.occurrence_id ?? event.id, data }, callbacks);
  }

  function handleDelete() {
    if (!event) return;
    deleteMutation.mutate(event.occurrence_id ?? event.id, {
      onSuccess: () => {
        toast.success(t("toasts.eventDeleted", "Evento eliminato"));
        onSaved();
        onClose();
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("modal.editTitle", "Modifica evento") : t("modal.newTitle", "Nuovo evento")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid gap-1.5">
            <Label htmlFor="em-title">{t("modal.titleLabel", "Titolo *")}</Label>
            <Input id="em-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit || isPending} />
            {errors.title && <p className="text-xs" style={{ color: pcReadyColors.danger }}>{errors.title}</p>}
          </div>

          <div className="grid gap-1.5">
            <Label>{t("modal.typeLabel", "Tipo evento")}</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as CalendarEventType)} disabled={!canEdit || isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: EVENT_TYPE_COLORS[value].fg }} />
                      {EVENT_TYPE_COLORS[value].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {event?.is_recurring_instance && (
            <div className="rounded-md border p-3" style={{ borderColor: pcReadyColors.border }}>
              <Label className="mb-2 flex items-center gap-2"><Repeat className="size-4" />{t("modal.recurringEditScope", "Modifica evento ricorrente")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={editScope === "single" ? "default" : "outline"} size="sm" onClick={() => setEditScope("single")}>{t("modal.editSingle", "Solo questa data")}</Button>
                <Button type="button" variant={editScope === "series" ? "default" : "outline"} size="sm" onClick={() => setEditScope("series")}>{t("modal.editSeries", "Tutta la serie")}</Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="em-allday" checked={allDay} onCheckedChange={(checked) => setAllDay(!!checked)} disabled={!canEdit || isPending} />
            <Label htmlFor="em-allday" className="cursor-pointer font-normal">{t("modal.allDayLabel", "Tutto il giorno")}</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("modal.startDateLabel", "Data inizio *")}</Label>
              <DatePickerInput value={startDate} onChange={setStartDate} disabled={!canEdit || isPending} />
            </div>
            {!allDay && <div className="grid gap-1.5"><Label>{t("modal.startTimeLabel", "Ora inizio")}</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canEdit || isPending} /></div>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>{t("modal.endDateLabel", "Data fine *")}</Label>
              <DatePickerInput value={endDate} onChange={setEndDate} disabled={!canEdit || isPending} />
            </div>
            {!allDay && <div className="grid gap-1.5"><Label>{t("modal.endTimeLabel", "Ora fine")}</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canEdit || isPending} /></div>}
          </div>
          {errors.end && <p className="text-xs" style={{ color: pcReadyColors.danger }}>{errors.end}</p>}

          <div className="grid gap-1.5">
            <Label>{t("modal.assigneeLabel", "Tecnico assegnato")}</Label>
            <Select value={assigneeId ?? "__none__"} onValueChange={(v) => setAssigneeId(v === "__none__" ? null : v)} disabled={!canEdit || isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("modal.assigneeNone", "Nessuno")}</SelectItem>
                {technicians.map((tech) => <SelectItem key={tech.id} value={tech.id}>{tech.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("modal.clientLabel", "Cliente")}</Label>
            <Select value={clientId ?? "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? null : v)} disabled={!canEdit || isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("modal.clientNone", "Nessun cliente")}</SelectItem>
                {clientOptions.map((client) => <SelectItem key={client.id} value={client.id}>{client.company_name || client.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("modal.ticketLabel", "Ticket collegati")}</Label>
            <div className="flex gap-2">
              <Input value={ticketSearch} onChange={(e) => setTicketSearch(e.target.value)} placeholder={t("modal.ticketSearchPlaceholder", "Cerca ticket...")} disabled={!canEdit || isPending} />
              {ticketIds.length > 0 && <Button type="button" variant="outline" size="icon" onClick={() => setTicketIds([])}><X className="size-4" /></Button>}
            </div>
            <div className="max-h-28 overflow-y-auto rounded-md border" style={{ borderColor: pcReadyColors.border }}>
              {ticketOptions.map((ticket) => (
                <button key={ticket.id} type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => toggleTicket(ticket.id)} disabled={!canEdit || isPending}>
                  <span className="h-2 w-2 rounded-full" style={{ background: ticketIds.includes(ticket.id) ? pcReadyColors.primary : pcReadyColors.border }} />
                  <span className="font-mono text-xs">{ticket.ticket_code}</span>
                  <span className="truncate text-xs" style={{ color: pcReadyColors.textSecondary }}>{ticket.client}</span>
                </button>
              ))}
            </div>
            {selectedTickets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTickets.map((ticket, index) => ticket && (
                  <span key={`${ticket.id}-${index}`} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs" style={{ borderColor: pcReadyColors.border }}>
                    <LinkIcon className="size-3" />{ticket.ticket_code}
                  </span>
                ))}
              </div>
            )}
          </div>

          {eventType === "availability" && (
            <div className="grid gap-1.5">
              <Label>{t("modal.availabilityLabel", "Disponibilita / assenza")}</Label>
              <Select value={availabilityStatus} onValueChange={(v) => setAvailabilityStatus(v as AvailabilityStatus)} disabled={!canEdit || isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AVAILABILITY_VALUES.map((value) => <SelectItem key={value} value={value}>{t(`availability.${value}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-3 rounded-md border p-3" style={{ borderColor: pcReadyColors.border }}>
            <Label className="flex items-center gap-2"><Repeat className="size-4" />{t("modal.recurrenceLabel", "Ricorrenza")}</Label>
            <div className="grid grid-cols-3 gap-3">
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as "none" | RecurrenceFrequency)} disabled={!canEdit || isPending || !!event?.is_recurring_instance}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECURRENCE_VALUES.map((value) => <SelectItem key={value} value={value}>{t(`recurrence.${value}`)}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min="1" value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(e.target.value)} disabled={!canEdit || isPending || recurrence === "none" || !!event?.is_recurring_instance} />
              <Input type="date" value={recurrenceUntil} onChange={(e) => setRecurrenceUntil(e.target.value)} disabled={!canEdit || isPending || recurrence === "none" || !!event?.is_recurring_instance} />
            </div>
          </div>

          <div className="grid gap-3 rounded-md border p-3" style={{ borderColor: pcReadyColors.border }}>
            <Label className="flex items-center gap-2"><Bell className="size-4" />{t("modal.reminderLabel", "Promemoria")}</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={reminderOffset || "__none__"} onValueChange={(v) => setReminderOffset(v === "__none__" ? "" : v)} disabled={!canEdit || isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("modal.noReminder", "Nessun promemoria")}</SelectItem>
                  {REMINDER_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={reminderChannel} onValueChange={(v) => setReminderChannel(v as ReminderChannel)} disabled={!canEdit || isPending || !reminderOffset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_app">{t("reminders.in_app", "In-app")}</SelectItem>
                  <SelectItem value="email">{t("reminders.email", "Email")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("modal.durationLabel", "Durata (min)")}</Label>
            <Input type="number" min="0" step="15" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} disabled={!canEdit || isPending} />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("modal.colorLabel", "Colore personalizzato")}</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={color || "#2563EB"} onChange={(e) => setColor(e.target.value)} disabled={!canEdit || isPending} className="h-9 w-14 rounded border" style={{ borderColor: pcReadyColors.border }} />
              {color && <Button type="button" variant="ghost" size="sm" onClick={() => setColor("")}>{t("modal.colorReset", "Ripristina")}</Button>}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>{t("modal.notesLabel", "Note")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={!canEdit || isPending} />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 pt-2">
          {isEdit && canEdit && (
            <div className="mr-auto flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-sm font-medium" style={{ color: pcReadyColors.danger }}>{t("modal.confirmDelete", "Confermare l'eliminazione?")}</span>
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>{t("modal.deleteButton", "Elimina")}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={isPending}>{t("modal.noButton", "No")}</Button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={isPending} style={{ color: pcReadyColors.danger, borderColor: pcReadyColors.danger }}>
                  <Trash2 className="mr-1.5 size-4" />{t("modal.deleteButton", "Elimina")}
                </Button>
              )}
            </div>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{t("modal.cancelButton", "Annulla")}</Button>
          {canEdit && <Button type="button" onClick={handleSave} disabled={isPending} style={{ background: pcReadyColors.primary, color: "#fff" }}>{isPending ? t("modal.savingButton", "Salvataggio...") : t("modal.saveButton", "Salva")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
