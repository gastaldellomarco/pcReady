import i18n from "@/i18n";
import { pcReadyColors } from '@/lib/design-system';
import type { CalendarEventType } from '@/lib/queries/calendar';

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
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0D9488',
  '#EA580C',
  '#0891B2',
  '#65A30D',
  '#E11D48',
];

export function getTechColor(index: number): string {
  return TECHNICIAN_PALETTE[index % TECHNICIAN_PALETTE.length];
}
