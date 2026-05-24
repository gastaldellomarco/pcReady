import { useRef, useState } from "react";
import type { AutomationVariable } from "@/domain/automation-variables";
import { VariablePicker } from "./VariablePicker";

interface VariableTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  variables: AutomationVariable[];
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  label?: string;
}

export function VariableTextField({
  value,
  onChange,
  variables,
  placeholder,
  multiline = false,
  rows = 3,
  label,
}: VariableTextFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleVariableSelect = (variableName: string) => {
    const before = value.slice(0, cursorPosition);
    const after = value.slice(cursorPosition);
    const placeholder = `{{${variableName}}}`;
    const newValue = `${before}${placeholder}${after}`;
    onChange(newValue);

    // Restore focus and set cursor after inserted variable
    setTimeout(() => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        const newPosition = cursorPosition + placeholder.length;
        if (input.setSelectionRange) {
          input.setSelectionRange(newPosition, newPosition);
        }
      }
    }, 0);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-text2">{label}</label>
      )}
      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleSelect}
            onKeyUp={handleKeyUp}
            onClick={handleClick}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-y min-h-[80px]"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleSelect}
            onKeyUp={handleKeyUp}
            onClick={handleClick}
            placeholder={placeholder}
            className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        )}
        <div className="absolute right-2 top-2">
          <VariablePicker
            variables={variables}
            onSelect={handleVariableSelect}
          />
        </div>
      </div>
    </div>
  );
}
