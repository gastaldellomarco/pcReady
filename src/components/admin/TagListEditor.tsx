import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 *
 */
export function TagListEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const next = draft.trim();
    if (!next || values.some((value) => value.toLowerCase() === next.toLowerCase())) return;
    onChange([...values, next]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2">
        {values.map((value) => (
          <Badge key={value} variant="secondary" className="gap-2">
            {value}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground touch-target"
              onClick={() => onChange(values.filter((item) => item !== value))}
            >
              ×
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          onBlur={addValue}
          placeholder={placeholder}
          className="h-7 min-w-48 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
