import i18n from "@/i18n";
import { pcReadyColors } from "@/lib/design-system";
import type { CalendarColorMode, CalendarEvent, CalendarEventType } from "@/lib/queries/calendar";

export const EVENT_TYPE_COLORS: Record<
  CalendarEventType,
  { bg: string; fg: string; border: string; label: string }
> = {
  intervention: {
    bg: pcReadyColors.primaryLight,
    fg: pcReadyColors.primary,
    border: pcReadyColors.primary,
    label: i18n.t("calendar:eventTypes.intervention", "Intervento"),
  },
  deadline: {
    bg: pcReadyColors.dangerLight,
    fg: pcReadyColors.danger,
    border: pcReadyColors.danger,
    label: i18n.t("calendar:eventTypes.deadline", "Scadenza"),
  },
  appointment: {
    bg: pcReadyColors.infoLight,
    fg: pcReadyColors.info,
    border: pcReadyColors.info,
    label: i18n.t("calendar:eventTypes.appointment", "Appuntamento"),
  },
  availability: {
    bg: pcReadyColors.successLight,
    fg: pcReadyColors.success,
    border: pcReadyColors.success,
    label: i18n.t("calendar:eventTypes.availability", "Disponibilità"),
  },
};

export const TECHNICIAN_PALETTE = [
  "#2563EB",
  "#16A34A",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#0D9488",
  "#EA580C",
  "#0891B2",
  "#65A30D",
  "#E11D48",
];

/**
 *
 */
export function getTechColor(index: number): string {
  return TECHNICIAN_PALETTE[index % TECHNICIAN_PALETTE.length];
}

/**
 *
 */
export function getClientColor(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  return TECHNICIAN_PALETTE[hash % TECHNICIAN_PALETTE.length];
}

/**
 *
 */
export function resolveEventColors(
  event: CalendarEvent,
  techColorMap: Record<string, string>,
  colorMode: CalendarColorMode,
) {
  const typeColors = EVENT_TYPE_COLORS[event.event_type];
  let bg = typeColors.bg;
  let fg = typeColors.fg;
  let border = typeColors.border;

  if (colorMode === "technician" && event.assignee_id && techColorMap[event.assignee_id]) {
    const c = techColorMap[event.assignee_id];
    bg = `${c}22`;
    fg = c;
    border = c;
  }

  if (colorMode === "client" && event.client_id) {
    const c = getClientColor(event.client_id);
    bg = `${c}22`;
    fg = c;
    border = c;
  }

  if (event.color) {
    bg = `${event.color}22`;
    fg = event.color;
    border = event.color;
  }

  return { bg, fg, border };
}
