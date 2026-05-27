import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AutomationRule } from "@/types/automation";

/**
 * Hook specializzato: gestisce lo stato del builder dialog,
 * lazy-loading di AutomationBuilder, editingRule, guidedMode.
 */
export function useAutomationBuilder() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [AutomationBuilderComp, setAutomationBuilderComp] = useState<React.ComponentType<{
    initialFlow?: { id: string } | undefined;
    onSave?: () => void;
    onCancel?: () => void;
  }> | null>(null);
  const [guidedMode, setGuidedMode] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (builderOpen && !AutomationBuilderComp) {
      void import("@/components/pcready/automation/AutomationBuilder")
        .then((mod) => {
          if (!mounted) return;
          setAutomationBuilderComp(() => mod.default);
        })
        .catch((err) => {
          console.error("Failed to load AutomationBuilder", err);
          toast.error("Errore caricamento editor");
        });
    }
    return () => {
      mounted = false;
    };
  }, [builderOpen, AutomationBuilderComp]);

  function openCreateDialog() {
    setEditingRule(null);
    setBuilderOpen(true);
  }

  function openEditDialog(rule: AutomationRule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

  return {
    builderOpen,
    setBuilderOpen,
    editingRule,
    setEditingRule,
    AutomationBuilderComp,
    guidedMode,
    setGuidedMode,
    openCreateDialog,
    openEditDialog,
  };
}
