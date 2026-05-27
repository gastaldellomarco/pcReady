import { useState } from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DatePickerInputProps = {
  /** ISO date string (YYYY-MM-DD) */
  value: string;
  /** Called with ISO date string (YYYY-MM-DD) when user selects a date */
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
  /** Earliest selectable date (ISO string YYYY-MM-DD) */
  minDate?: string;
  /** Latest selectable date (ISO string YYYY-MM-DD) */
  maxDate?: string;
  /** Marks the field as required (adds aria-required and visual indicator) */
  required?: boolean;
  /** Called when the button loses focus */
  onBlur?: () => void;
  /** Native HTML title attribute for tooltip */
  title?: string;
};

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: it });
  } catch {
    return iso;
  }
}

export function DatePickerInput({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "dd/mm/yyyy",
  id,
  minDate,
  maxDate,
  required = false,
  onBlur,
  title,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(date.toISOString().slice(0, 10));
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-required={required || undefined}
          onBlur={onBlur}
          title={title}
          className={cn(
            "pc-input flex items-center gap-1.5 text-left font-mono text-[13px]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-text3" aria-hidden="true" />
          <span className="flex-1 truncate">{value ? fmtDate(value) : placeholder}</span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Cancella data"
              className="ml-auto shrink-0 rounded p-0.5 text-text3 hover:bg-muted hover:text-text1"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === " ") e.preventDefault();
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected ?? new Date()}
          disabled={(date: Date) => {
            if (minDate && date < parseISO(minDate)) return true;
            if (maxDate && date > parseISO(maxDate)) return true;
            return false;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
