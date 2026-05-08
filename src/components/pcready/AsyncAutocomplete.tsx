import { useEffect, useMemo, useRef, useState } from "react";

export interface AsyncAutocompleteOption {
  value: string;
  label: string;
  description?: string | null;
}

interface AsyncAutocompleteProps<T extends AsyncAutocompleteOption> {
  value: string;
  selectedOption?: T | null;
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  className?: string;
  minSearchLength?: number;
  loadOptions: (query: string) => Promise<T[]>;
  onChange: (value: string, option: T | null) => void;
}

export function AsyncAutocomplete<T extends AsyncAutocompleteOption>({
  value,
  selectedOption,
  placeholder,
  emptyLabel,
  disabled = false,
  className,
  minSearchLength = 0,
  loadOptions,
  onChange,
}: AsyncAutocompleteProps<T>) {
  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [options, setOptions] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedOption?.value === value) setQuery(selectedOption.label);
    if (!value && !open) setQuery("");
  }, [open, selectedOption, value]);

  useEffect(() => {
    if (!open || disabled) return;
    const trimmed = query.trim();
    if (trimmed.length < minSearchLength) {
      setOptions([]);
      return;
    }
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      loadOptions(trimmed)
        .then((items) => {
          if (active) setOptions(items);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [disabled, loadOptions, minSearchLength, open, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const mergedOptions = useMemo(() => {
    if (!selectedOption || options.some((option) => option.value === selectedOption.value)) return options;
    return [selectedOption, ...options];
  }, [options, selectedOption]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <input
        className="pc-input w-full"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange("", null);
        }}
      />
      {value && !disabled && (
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text3 hover:text-text"
          onClick={() => {
            setQuery("");
            onChange("", null);
            setOpen(false);
          }}
        >
          ×
        </button>
      )}
      {open && !disabled && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-lg"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {loading && <div className="px-3 py-2 text-xs text-text3">Caricamento...</div>}
          {!loading && mergedOptions.length === 0 && (
            <div className="px-3 py-2 text-xs text-text3">{emptyLabel}</div>
          )}
          {mergedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface2"
              onClick={() => {
                setQuery(option.label);
                onChange(option.value, option);
                setOpen(false);
              }}
            >
              <span className="block truncate font-medium">{option.label}</span>
              {option.description && (
                <span className="block truncate text-xs text-text3">{option.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
