import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import type { AssistanceBundle } from "@/lib/bundles";
import type { UseMutationResult } from "@tanstack/react-query";

interface BundleMutations {
  create: UseMutationResult<unknown, Error, Partial<AssistanceBundle>>;
  update: UseMutationResult<unknown, Error, { id: string; data: Partial<AssistanceBundle> }>;
}

interface UseBundleManagerOptions {
  canManageBundles: boolean;
  userId: string | null;
  mutations: BundleMutations;
}

/**
 *
 */
export function useBundleManager(options: UseBundleManagerOptions) {
  const { t } = useTranslation("bundles");
  const { canManageBundles, userId, mutations } = options;

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AssistanceBundle | null>(null);

  function resetForms() {
    setCreating(false);
    setEditing(null);
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
  }

  function startEdit(bundle: AssistanceBundle) {
    setEditing(bundle);
    setCreating(false);
  }

  async function save(data: Partial<AssistanceBundle>) {
    if (!canManageBundles) {
      toast.error(t("errors.adminOnly", "Solo gli admin possono gestire i bundle"));
      return;
    }
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, data });
      } else {
        await mutations.create.mutateAsync({
          ...data,
          created_by: userId,
        });
      }
      resetForms();
      toast.success(t("success.bundleSaved", "Bundle salvato"));
    } catch (error) {
      toast.error(errorMessage(error, t("errors.saveBundle", "Errore salvataggio bundle")));
    }
  }

  async function toggle(bundle: AssistanceBundle) {
    if (!canManageBundles) {
      toast.error(t("errors.adminOnlyEdit", "Solo gli admin possono modificare i bundle"));
      return;
    }
    try {
      await mutations.update.mutateAsync({
        id: bundle.id,
        data: { active: !bundle.active },
      });
      toast.success(
        bundle.active
          ? t("success.bundleDeactivated", "Bundle disattivato")
          : t("success.bundleReactivated", "Bundle riattivato"),
      );
    } catch (error) {
      toast.error(errorMessage(error, t("errors.updateBundle", "Errore aggiornamento bundle")));
    }
  }

  const busy = mutations.create.isPending || mutations.update.isPending;

  return {
    creating,
    editing,
    busy,
    resetForms,
    startCreate,
    startEdit,
    save,
    toggle,
  };
}
