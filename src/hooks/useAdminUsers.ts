import { zodResolver } from "@hookform/resolvers/zod";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useAdminUsersFilters } from "@/hooks/useAdminUsersFilters";
import {
  deleteAdminUser,
  inviteAdminUser,
  listAdminUsers,
  resendAdminUserInvite,
  setAdminUserDisabled,
  updateAdminUser,
  type AdminUserRow,
} from "@/lib/admin-users";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { AdminUserInviteSchema, type AdminUserInviteInput } from "@/lib/schemas";
import type { AppRole } from "@/lib/auth-context";

/**
 *
 */
export function useAdminUsers(args: {
  accessToken: string | undefined;
  isAdmin: boolean;
  currentUserId: string | undefined;
}) {
  const { accessToken, isAdmin, currentUserId } = args;
  const listUsers = useServerFn(listAdminUsers);
  const updateUser = useServerFn(updateAdminUser);
  const setDisabled = useServerFn(setAdminUserDisabled);
  const deleteUser = useServerFn(deleteAdminUser);
  const inviteUser = useServerFn(inviteAdminUser);
  const resendInvite = useServerFn(resendAdminUserInvite);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"disable" | "enable" | null>(null);
  const [bulkRole, setBulkRole] = useState<AppRole>("viewer");
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);

  const filters = useAdminUsersFilters(rows);
  const { q, setQ, role, setRole, filtered } = filters;

  const inviteForm = useForm<AdminUserInviteInput>({
    resolver: zodResolver(AdminUserInviteSchema),
    mode: "onChange",
    defaultValues: { email: "", fullName: "", role: "viewer" },
  });

  const load = useCallback(async () => {
    if (!accessToken || !isAdmin) return;
    setLoadingRows(true);
    try {
      const data = await listUsers({ data: { accessToken } });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Impossibile caricare gli utenti"));
    } finally {
      setLoadingRows(false);
    }
  }, [accessToken, isAdmin, listUsers]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveRole(row: AdminUserRow, nextRole: AppRole) {
    if (!accessToken || row.role === nextRole) return;
    setBusyId(row.id);
    try {
      await updateUser({
        data: {
          accessToken,
          userId: row.id,
          role: nextRole,
          fullName: row.full_name,
          initials: row.initials,
        },
      });
      toast.success("Ruolo aggiornato");
      await load();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Aggiornamento non riuscito"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleDisabled(row: AdminUserRow) {
    if (!accessToken) return;
    const disabled = row.status !== "disabled";
    setBusyId(row.id);
    try {
      await setDisabled({ data: { accessToken, userId: row.id, disabled } });
      toast.success(disabled ? "Utente disabilitato" : "Utente riabilitato");
      await load();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Operazione non riuscita"));
    } finally {
      setBusyId(null);
    }
  }

  async function resendInviteFor(row: AdminUserRow) {
    if (!accessToken || row.status !== "invited") return;
    setBusyId(row.id);
    try {
      await resendInvite({
        data: {
          accessToken,
          userId: row.id,
          redirectTo: `${window.location.origin}/auth/set-password`,
        },
      });
      toast.success("Invito re-inviato");
      await load();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Re-invio invito non riuscito"));
    } finally {
      setBusyId(null);
    }
  }

  function remove(row: AdminUserRow) {
    setDeleteTarget(row);
  }

  async function confirmRemove() {
    if (!accessToken || !deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteUser({ data: { accessToken, userId: deleteTarget.id } });
      toast.success("Utente rimosso");
      await load();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Rimozione non riuscita"));
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  async function inviteSubmit(vals: AdminUserInviteInput) {
    if (!accessToken) return;
    setInviteBusy(true);
    try {
      await inviteUser({
        data: {
          accessToken,
          email: vals.email,
          fullName: vals.fullName,
          role: vals.role,
          redirectTo: `${window.location.origin}/auth/set-password`,
        },
      });
      toast.success("Invito inviato");
      inviteForm.reset();
      await load();
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Invito non riuscito"));
    } finally {
      setInviteBusy(false);
    }
  }

  return {
    rows,
    loadingRows,
    busyId,
    inviteBusy,
    inviteForm,
    inviteSubmit,
    selectedIds,
    setSelectedIds,
    bulkBusy,
    setBulkBusy,
    bulkConfirmOpen,
    setBulkConfirmOpen,
    bulkAction,
    setBulkAction,
    bulkRole,
    setBulkRole,
    deleteTarget,
    setDeleteTarget,
    q,
    setQ,
    role,
    setRole,
    filtered,
    load,
    saveRole,
    toggleDisabled,
    resendInviteFor,
    remove,
    confirmRemove,
    accessToken,
    currentUserId,
    updateUser,
    setDisabled,
    resendInvite,
  };
}
