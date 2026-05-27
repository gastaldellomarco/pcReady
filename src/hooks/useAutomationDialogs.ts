import { useState } from "react";
import type { AutomationRule } from "@/types/automation";

/**
 * Hook specializzato: gestisce gli stati dei dialog di conferma
 * (delete, archive, run, dryRun) e le relative funzioni cancel.
 */
export function useAutomationDialogs() {
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<AutomationRule | null>(null);
  const [confirmArchiveRule, setConfirmArchiveRule] = useState<AutomationRule | null>(null);
  const [confirmRunRule, setConfirmRunRule] = useState<AutomationRule | null>(null);
  const [confirmRunLoading, setConfirmRunLoading] = useState(false);
  const [dryRunRule, setDryRunRule] = useState<AutomationRule | null>(null);
  const [dryRunDialogOpen, setDryRunDialogOpen] = useState(false);

  function cancelDeleteRule() {
    setConfirmDeleteRule(null);
  }

  function cancelArchiveRule() {
    setConfirmArchiveRule(null);
  }

  function cancelRunRule() {
    setConfirmRunRule(null);
  }

  return {
    confirmDeleteRule,
    setConfirmDeleteRule,
    confirmArchiveRule,
    setConfirmArchiveRule,
    confirmRunRule,
    setConfirmRunRule,
    confirmRunLoading,
    setConfirmRunLoading,
    dryRunRule,
    setDryRunRule,
    dryRunDialogOpen,
    setDryRunDialogOpen,
    cancelDeleteRule,
    cancelArchiveRule,
    cancelRunRule,
  };
}
