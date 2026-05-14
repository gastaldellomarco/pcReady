import { CalendarDays } from "lucide-react";

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

const PRESETS = [
  { label: "7g", days: 7 },
  { label: "30g", days: 30 },
  { label: "3m", days: 90 },
  { label: "6m", days: 180 },
] as const;

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  function applyPreset(days: number) {
    onChange(subtractDays(days), today());
  }

  function handleFromChange(value: string) {
    if (!value || value > to) return;
    onChange(value, to);
  }

  function handleToChange(value: string) {
    if (!value || value < from) return;
    onChange(from, value);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-[8px] border px-2 py-1.5"
      style={{ background: "var(--surface)", borderColor: "var(--border2)" }}
      aria-label="Selettore periodo dashboard"
    >
      <CalendarDays className="h-4 w-4 text-text3" aria-hidden="true" />
      <div className="flex items-center gap-1">
        {PRESETS.map((preset) => {
          const active = isPresetActive(from, to, preset.days);
          return (
            <button
              key={preset.days}
              type="button"
              className={`pc-btn pc-btn-xs ${active ? "pc-btn-primary" : "pc-btn-ghost"}`}
              onClick={() => applyPreset(preset.days)}
              aria-pressed={active}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          className="pc-input pc-input-sm w-[136px]"
          type="date"
          value={from}
          max={to}
          aria-label="Data inizio"
          onChange={(event) => handleFromChange(event.target.value)}
        />
        <span className="text-[12px] text-text3" aria-hidden="true">
          -
        </span>
        <input
          className="pc-input pc-input-sm w-[136px]"
          type="date"
          value={to}
          min={from}
          aria-label="Data fine"
          onChange={(event) => handleToChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function today() {
  return toDateInputValue(new Date());
}

function subtractDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInputValue(date);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isPresetActive(from: string, to: string, days: number) {
  return from === subtractDays(days) && to === today();
}
