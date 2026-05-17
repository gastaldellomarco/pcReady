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
    label: 'Intervento',
  },
  deadline: {
    bg: pcReadyColors.dangerLight,
    fg: pcReadyColors.danger,
    border: pcReadyColors.danger,
    label: 'Scadenza',
  },
  appointment: {
    bg: pcReadyColors.infoLight,
    fg: pcReadyColors.info,
    border: pcReadyColors.info,
    label: 'Appuntamento',
  },
  availability: {
    bg: pcReadyColors.successLight,
    fg: pcReadyColors.success,
    border: pcReadyColors.success,
    label: 'Disponibilità',
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
