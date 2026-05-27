import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

type QuickPreset = "today" | "7days" | "30days" | "custom";

/** Format an ISO date string (YYYY-MM-DD) to Italian dd/mm/yyyy */
function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: it });
  } catch {
    return iso;
  }
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const { t } = useTranslation("dashboard");
  const activePreset = useMemo<QuickPreset>(() => {
    if (from === today() && to === today()) return "today";
    if (from === subtractDays(6) && to === today()) return "7days";
    if (from === subtractDays(29) && to === today()) return "30days";
    return "custom";
  }, [from, to]);

  const [preset, setPreset] = useState<QuickPreset>(activePreset);
  const [openPicker, setOpenPicker] = useState<"from" | "to" | null>(null);

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
    setOpenPicker(null);
  }

  function handleFromSelect(date: Date | undefined) {
    if (!date) return;
    const value = toDateInputValue(date);
    if (value > to) return;
    setPreset("custom");
    onChange(value, to);
    setOpenPicker(null);
  }

  function handleToSelect(date: Date | undefined) {
    if (!date) return;
    const value = toDateInputValue(date);
    if (value < from) return;
    setPreset("custom");
    onChange(from, value);
    setOpenPicker(null);
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
          <Popover
            open={openPicker === "from"}
            onOpenChange={(open) => setOpenPicker(open ? "from" : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pc-input pc-input-sm w-[120px] text-left font-mono text-[13px]"
                aria-label={t("dateRange.startDate", "Data inizio")}
              >
                {fmtDate(from)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(from)}
                onSelect={handleFromSelect}
                disabled={{ after: parseISO(to) }}
                defaultMonth={parseISO(from)}
              />
            </PopoverContent>
          </Popover>
          <span className="text-[12px] text-text3" aria-hidden="true">
            -
          </span>
          <Popover
            open={openPicker === "to"}
            onOpenChange={(open) => setOpenPicker(open ? "to" : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="pc-input pc-input-sm w-[120px] text-left font-mono text-[13px]"
                aria-label={t("dateRange.endDate", "Data fine")}
              >
                {fmtDate(to)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={parseISO(to)}
                onSelect={handleToSelect}
                disabled={{ before: parseISO(from) }}
                defaultMonth={parseISO(to)}
              />
            </PopoverContent>
          </Popover>
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
