import { format, getISOWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Palette, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { pcReadyColors } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { CalendarView, TechnicianOption } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CalendarToolbarProps {
  currentDate: Date;
  view: CalendarView;
  technicians: TechnicianOption[];
  filterTechId: string | null;
  colorMode: 'type' | 'technician';
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onViewChange: (v: CalendarView) => void;
  onFilterTechChange: (id: string | null) => void;
  onColorModeChange: (mode: 'type' | 'technician') => void;
  onExportIcal: () => void;
  onCreateEvent: () => void;
  canEdit: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateLabel(date: Date, view: CalendarView): string {
  switch (view) {
    case 'month':
      return format(date, 'MMMM yyyy', { locale: it });
    case 'week': {
      const weekNum = getISOWeek(date);
      return `Settimana ${weekNum} · ${format(date, 'MMMM yyyy', { locale: it })}`;
    }
    case 'day':
      return format(date, 'EEEE d MMMM yyyy', { locale: it });
  }
}

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'month', label: 'Mese' },
  { value: 'week', label: 'Settimana' },
  { value: 'day', label: 'Giorno' },
];

// ---------------------------------------------------------------------------
// CalendarToolbar
// ---------------------------------------------------------------------------

export function CalendarToolbar({
  currentDate,
  view,
  technicians,
  filterTechId,
  colorMode,
  onNavigatePrev,
  onNavigateNext,
  onNavigateToday,
  onViewChange,
  onFilterTechChange,
  onColorModeChange,
  onExportIcal,
  onCreateEvent,
  canEdit,
}: CalendarToolbarProps) {
  const dateLabel = getDateLabel(currentDate, view);

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
      style={{ borderColor: pcReadyColors.border, background: pcReadyColors.card }}
    >
      {/* ── Left: Navigation ─────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={onNavigatePrev} title="Mese/settimana/giorno precedente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNavigateNext} title="Mese/settimana/giorno successivo">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onNavigateToday} className="ml-1">
          Oggi
        </Button>
        <span
          className="ml-3 text-sm font-semibold capitalize hidden sm:block"
          style={{ color: pcReadyColors.textPrimary }}
        >
          {dateLabel}
        </span>
      </div>

      {/* ── Center: View switcher ─────────────────────────────── */}
      <div className="flex mx-auto">
        <div
          className="flex items-center rounded-md border overflow-hidden"
          style={{ borderColor: pcReadyColors.border }}
          role="group"
          aria-label="Cambia visualizzazione"
        >
          {VIEW_OPTIONS.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onViewChange(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none',
                i > 0 && 'border-l',
                view === opt.value ? 'text-white' : 'text-gray-600 hover:bg-gray-50',
              )}
              style={{
                borderColor: pcReadyColors.border,
                background: view === opt.value ? pcReadyColors.primary : undefined,
              }}
              aria-pressed={view === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Filters + actions ──────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Technician filter — only shown when there are technicians */}
        {technicians.length > 0 && (
          <Select
            value={filterTechId ?? '__all__'}
            onValueChange={(v) => onFilterTechChange(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue placeholder="Tutti i tecnici" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti i tecnici</SelectItem>
              {technicians.map((tech) => (
                <SelectItem key={tech.id} value={tech.id}>
                  {tech.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Color mode toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onColorModeChange(colorMode === 'type' ? 'technician' : 'type')}
          title={colorMode === 'type' ? 'Passa a colori per tecnico' : 'Passa a colori per tipo'}
          className="gap-1.5"
        >
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">
            {colorMode === 'type' ? 'Tipo' : 'Tecnico'}
          </span>
        </Button>

        {/* Export iCal */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportIcal}
          title="Esporta come file iCal (.ics)"
          className="gap-1.5"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">iCal</span>
        </Button>

        {/* Create new event — hidden for viewers */}
        {canEdit && (
          <Button
            size="sm"
            onClick={onCreateEvent}
            className="gap-1.5"
            style={{ background: pcReadyColors.primary, color: '#fff' }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuovo evento</span>
          </Button>
        )}
      </div>
    </div>
  );
}
