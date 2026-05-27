import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ClientBundleAssignment } from "@/lib/bundles";
import type { UseMutationResult } from "@tanstack/react-query";
import { errorMessage } from "@/lib/errors";

interface AssignmentMutations {
  create: UseMutationResult<unknown, Error, Partial<ClientBundleAssignment>>;
  update: UseMutationResult<
    unknown,
    Error,
    { id: string; data: Partial<ClientBundleAssignment> }
  >;
  cancel: UseMutationResult<unknown, Error, string>;
  remove: UseMutationResult<unknown, Error, string>;
}

interface UseAssignmentManagerOptions {
  canManage: boolean;
  userId: string | null;
  mutations: AssignmentMutations;
}

export function useAssignmentManager(options: UseAssignmentManagerOptions) {
  const { t } = useTranslation("bundles");
  const { canManage, userId, mutations } = options;

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientBundleAssignment | null>(null);

  function resetForms() {
    setCreating(false);
    setEditing(null);
  }

  function startCreate() {
    setCreating(true);
    setEditing(null);
  }

  function startEdit(assignment: ClientBundleAssignment) {
    setEditing(assignment);
    setCreating(false);
  }

  async function save(data: Partial<ClientBundleAssignment>) {
    if (!canManage) {
      toast.error(
        t("errors.insufficientPermissions", "Permessi insufficienti"),
      );
      return;
    }
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, data });
      } else {
        await mutations.create.mutateAsync({
          ...data,
          status: "active" as const,
          created_by: userId,
        });
      }
      resetForms();
      toast.success(t("success.assignmentSaved", "Assegnazione salvata"));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t("errors.saveAssignment", "Errore salvataggio assegnazione"),
        ),
      );
    }
  }

  async function cancel(id: string) {
    if (!canManage) {
      toast.error(
        t("errors.insufficientPermissions", "Permessi insufficienti"),
      );
      return;
    }
    try {
      await mutations.cancel.mutateAsync(id);
      toast.success(
        t("success.assignmentCancelled", "Assegnazione annullata"),
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t("errors.cancelAssignment", "Errore annullamento assegnazione"),
        ),
      );
    }
  }

  async function remove(id: string) {
    if (!canManage) {
      toast.error(
        t("errors.insufficientPermissions", "Permessi insufficienti"),
      );
      return;
    }
    if (
      !window.confirm(
        t("assignments.confirmDelete", "Eliminare questa assegnazione?"),
      )
    )
      return;
    try {
      await mutations.remove.mutateAsync(id);
      toast.success(t("assignments.deleted", "Assegnazione eliminata"));
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          t("assignments.deleteError", "Errore eliminazione assegnazione"),
        ),
      );
    }
  }

  const busy =
    mutations.create.isPending ||
    mutations.update.isPending ||
    mutations.cancel.isPending ||
    mutations.remove.isPending;

  return {
    creating,
    editing,
    busy,
    resetForms,
    startCreate,
    startEdit,
    save,
    cancel,
    remove,
  };
}
