import { X, Plus } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface ScriptTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}

export function ScriptTagInput({ value, onChange, suggestions = [], disabled }: ScriptTagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = input.trim()
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(input.toLowerCase()) &&
          !(value ?? []).includes(s)
      )
    : [];

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || (value ?? []).includes(trimmed)) return;
    onChange([...(value ?? []), trimmed]);
    setInput("");
    setShowSuggestions(false);
  }

  function removeTag(index: number) {
    onChange((value ?? []).filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && (value ?? []).length > 0) {
      removeTag((value ?? []).length - 1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 min-h-[36px]"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        {(value ?? []).map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface2)",
              color: "var(--text2)",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(idx)}
              disabled={disabled}
              className="hover:text-destructive"
              aria-label={`Rimuovi tag ${tag}`}
            >
              <X className="size-2.5" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[80px] bg-transparent outline-none text-[13px]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={(value ?? []).length === 0 ? "Aggiungi tag..." : ""}
          disabled={disabled}
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border shadow-lg py-1"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
          }}
        >
          {filteredSuggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-surface2 flex items-center gap-2"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
            >
              <Plus className="size-3 text-text3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
