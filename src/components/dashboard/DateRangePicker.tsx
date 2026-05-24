import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

type QuickPreset = "today" | "7days" | "30days" | "custom";

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const { t } = useTranslation("dashboard");
  const activePreset = useMemo<QuickPreset>(() => {
    if (from === today() && to === today()) return "today";
    if (from === subtractDays(6) && to === today()) return "7days";
    if (from === subtractDays(29) && to === today()) return "30days";
    return "custom";
  }, [from, to]);

  const [preset, setPreset] = useState<QuickPreset>(activePreset);

  function applyPreset(p: QuickPreset) {
    setPreset(p);
    switch (p) {
      case "today":
        onChange(today(), today());
        break;
      case "7days":
        onChange(subtractDays(6), today());
        break;
      case "30days":
        onChange(subtractDays(29), today());
        break;
      case "custom":
        // keep current values when switching to custom
        break;
    }
  }

  function handleFromChange(value: string) {
    if (!value || value > to) return;
    setPreset("custom");
    onChange(value, to);
  }

  function handleToChange(value: string) {
    if (!value || value < from) return;
    setPreset("custom");
    onChange(from, value);
  }

  const presets: { key: QuickPreset; label: string }[] = [
    { key: "today", label: t("dateRange.today", "Oggi") },
    { key: "7days", label: t("dateRange.last7", "7 giorni") },
    { key: "30days", label: t("dateRange.last30", "30 giorni") },
    { key: "custom", label: t("dateRange.custom", "Personalizzato") },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-[8px] border px-2 py-1.5"
      style={{ background: "var(--surface)", borderColor: "var(--border2)" }}
      aria-label={t("dateRange.ariaLabel", "Selettore periodo dashboard")}
    >
      <CalendarDays className="h-4 w-4 text-text3" aria-hidden="true" />
      <div className="flex items-center gap-1">
        {presets.map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              className={`pc-btn pc-btn-xs ${active ? "pc-btn-primary" : "pc-btn-ghost"}`}
              onClick={() => applyPreset(p.key)}
              aria-pressed={active}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            className="pc-input pc-input-sm w-[136px]"
            type="date"
            value={from}
            max={to}
            aria-label={t("dateRange.startDate", "Data inizio")}
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
            aria-label={t("dateRange.endDate", "Data fine")}
            onChange={(event) => handleToChange(event.target.value)}
          />
        </div>
      )}
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
