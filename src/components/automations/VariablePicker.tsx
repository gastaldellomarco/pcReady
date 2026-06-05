import { Variable, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { groupVariablesByCategory, searchVariables } from "@/domain/automation-variables";
import type { AutomationVariable } from "@/domain/automation-variables";

interface VariablePickerProps {
  variables: AutomationVariable[];
  onSelect: (variableName: string) => void;
  children?: React.ReactNode;
}

/**
 *
 */
export function VariablePicker({ variables, onSelect, children }: VariablePickerProps) {
  const { t } = useTranslation("automations");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const groupedVariables = useMemo(() => {
    const filtered = searchQuery ? searchVariables(variables, searchQuery) : variables;
    return groupVariablesByCategory(filtered);
  }, [variables, searchQuery]);

  const handleSelect = (variableName: string) => {
    onSelect(variableName);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-text2 hover:text-text bg-muted hover:bg-muted/80 rounded-md transition-colors"
        title={t("actionsBuilder.variablePicker.title", "Inserisci variabile")}
      >
        {children || (
          <>
            <Variable className="size-3.5" />
            <span className="hidden sm:inline">{"{"}</span>
            {"}"}
          </>
        )}
      </button>

      {isOpen && (
        <>
          <div
            role="button"
            tabIndex={-1}
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter") setIsOpen(false);
            }}
          />
          <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-text3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("actionsBuilder.variablePicker.search", "Cerca variabili...")}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  autoFocus
                  aria-label={t("actionsBuilder.variablePicker.search", "Cerca variabili")}
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {Object.entries(groupedVariables).length === 0 ? (
                <div className="p-4 text-sm text-text3 text-center">
                  {t("actionsBuilder.variablePicker.noResults", "Nessuna variabile trovata")}
                </div>
              ) : (
                Object.entries(groupedVariables).map(([category, vars]) => (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-text3 bg-gray-50 border-y border-gray-100">
                      {category}
                    </div>
                    {vars.map((variable) => (
                      <button
                        key={variable.name}
                        type="button"
                        onClick={() => handleSelect(variable.name)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text">{variable.label}</span>
                          <code className="text-xs text-text3 bg-gray-100 px-1.5 py-0.5 rounded">
                            {`{{${variable.name}}}`}
                          </code>
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
