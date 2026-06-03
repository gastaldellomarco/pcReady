import { useState, useCallback } from "react";
import {
  validateFlowInput,
  formatValidationErrors,
} from "@/domain/automation.schema";
import type { AutomationFlowInput } from "@/domain/automation";

interface UseAutomationFormResult {
  data: AutomationFlowInput;
  errors: Record<string, string>;
  isValid: boolean;
  validate: () => boolean;
  updateField: <K extends keyof AutomationFlowInput>(
    field: K,
    value: AutomationFlowInput[K]
  ) => void;
  updateNestedField: <K extends keyof AutomationFlowInput, NK extends string>(
    field: K,
    nestedField: NK,
    value: unknown
  ) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearErrors: () => void;
  getFieldError: (path: string) => string | undefined;
}

/**
 *
 */
export function useAutomationForm(
  initialData: Partial<AutomationFlowInput> = {}
): UseAutomationFormResult {
  const [data, setData] = useState<AutomationFlowInput>({
    name: initialData.name || "",
    description: initialData.description,
    category: initialData.category,
    trigger: initialData.trigger || { type: "ticket_created", config: {} },
    conditions: initialData.conditions || { conditions: [], logic: "AND" },
    actions: initialData.actions || [],
  });

  const [errors, setErrorsState] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const result = validateFlowInput(data);

    if (!result.valid) {
      setErrorsState(formatValidationErrors(result.errors));
    } else {
      setErrorsState({});
    }

    return result.valid;
  }, [data]);

  const updateField = useCallback(<K extends keyof AutomationFlowInput>(
    field: K,
    value: AutomationFlowInput[K]
  ) => {
    setData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user updates it
    setErrorsState((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      // Also clear nested errors
      Object.keys(newErrors).forEach((key) => {
        if (key.startsWith(`${field}.`) || key.startsWith(`${field}[`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  }, []);

  const updateNestedField = useCallback(<K extends keyof AutomationFlowInput, NK extends string>(
    field: K,
    nestedField: NK,
    value: unknown
  ) => {
    setData((prev) => {
      const currentField = prev[field];
      if (typeof currentField === "object" && currentField !== null) {
        return {
          ...prev,
          [field]: {
            ...currentField,
            [nestedField]: value,
          },
        };
      }
      return prev;
    });

    // Clear error for this nested path
    const fullPath = `${String(field)}.${nestedField}`;
    setErrorsState((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fullPath];
      return newErrors;
    });
  }, []);

  const setErrors = useCallback((newErrors: Record<string, string>) => {
    setErrorsState(newErrors);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  const getFieldError = useCallback((path: string): string | undefined => {
    return errors[path];
  }, [errors]);

  return {
    data,
    errors,
    isValid: Object.keys(errors).length === 0,
    validate,
    updateField,
    updateNestedField,
    setErrors,
    clearErrors,
    getFieldError,
  };
}
