import { MailPlus, Search, Trash2, UserX, UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { TableSkeletonRows } from "@/components/page-states";
import OverflowTable from "@/components/ui/overflow-table";
import { TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { ADMIN_ROLES, adminRoleLabel } from "@/lib/admin/admin-constants";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { AdminUserRoleEditor } from "@/components/admin/AdminUserRoleEditor";
import { AdminUserStatusBadge } from "@/components/admin/AdminUserStatusBadge";
import { Badge } from "@/components/ui/badge";

function MfaStatusBadge({ enabled, required }: { enabled: boolean; required: boolean }) {
  const { t } = useTranslation("admin");
  if (enabled) return <Badge className="bg-emerald-600">{t("users.mfa.active", "Attivo")}</Badge>;
  if (required) return <Badge className="bg-amber-500 text-white">{t("users.mfa.required", "Richiesto")}</Badge>;
  return <Badge variant="secondary">{t("users.mfa.notActive", "Non attivo")}</Badge>;
}

export function AdminUsersTab() {
  const { t } = useTranslation("admin");
  const { session, user, isAdmin } = useAuth();
  const accessToken = session?.access_token;
  const {
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
    updateUser,
    resendInvite,
    setDisabled,
  } = useAdminUsers({
    accessToken,
    isAdmin,
    currentUserId: user?.id,
  });

  return (
    <TabsContent value="users" className="space-y-5">
      <form
        className="pc-card p-4 flex flex-wrap items-end gap-3"
        onSubmit={inviteForm.handleSubmit(inviteSubmit)}
      >
        <div className="flex-1 min-w-[220px]">
          <label className="pc-label">{t("users.invite.emailLabel", "Email nuovo utente")}</label>
          <input
            className="pc-input"
            type="email"
            {...inviteForm.register("email")}
            placeholder={t("users.invite.emailPlaceholder", "utente@azienda.it")}
          />
          {inviteForm.formState.errors.email && (
            <p className="text-sm text-destructive mt-1">
              {String(inviteForm.formState.errors.email?.message)}
            </p>
          )}
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="pc-label">{t("users.invite.nameLabel", "Nome")}</label>
          <input
            className="pc-input"
            {...inviteForm.register("fullName")}
            placeholder={t("users.invite.namePlaceholder", "Mario Rossi")}
          />
          {inviteForm.formState.errors.fullName && (
            <p className="text-sm text-destructive mt-1">
              {String(inviteForm.formState.errors.fullName?.message)}
            </p>
          )}
        </div>
        <div className="min-w-[160px]">
          <label className="pc-label">{t("users.invite.roleLabel", "Ruolo")}</label>
          <select className="pc-input" {...inviteForm.register("role")}>
            {ADMIN_ROLES.map((item) => (
              <option key={item} value={item}>
                {adminRoleLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <button
          className="pc-btn pc-btn-primary"
          disabled={inviteBusy || !inviteForm.formState.isValid}
          type="submit"
        >
          <MailPlus className="w-3.5 h-3.5" /> {inviteBusy ? t("users.invite.submitting", "Invio...") : t("users.invite.submit", "Invita")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] flex-1 min-w-[220px] max-w-[360px]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          <Search className="w-3 h-3 text-text3" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("users.search.placeholder", "Cerca nome o email...")}
            className="bg-transparent outline-none text-[13px] flex-1"
          />
        </div>
        <select
          className="pc-input max-w-[180px]"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">{t("users.search.allRoles", "Tutti i ruoli")}</option>
          {ADMIN_ROLES.map((item) => (
            <option key={item} value={item}>
              {adminRoleLabel(item)}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-xs text-text3 font-mono">
          {t("users.search.count", "{{count}} utenti", { count: (filtered ?? []).length })}
        </span>
      </div>

      <div className="pc-card overflow-hidden">
        {selectedIds.size > 0 && (
          <div className="px-4 py-3 border-b bg-surface2 border-border flex items-center gap-3">
            <div className="text-sm text-text3">{t("users.bulk.selected", "{{count}} selezionati", { count: selectedIds.size })}</div>
            <div className="flex items-center gap-2">
              <select
                className="pc-input max-w-[160px]"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value as AppRole)}
              >
                {ADMIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {adminRoleLabel(r)}
                  </option>
                ))}
              </select>
              <Button
                onClick={async () => {
                  if (bulkBusy) return;
                  setBulkBusy(true);
                  try {
                    const ids = Array.from(selectedIds);
                    const results = await Promise.allSettled(
                      ids.map((id) =>
                        updateUser({
                          data: {
                            accessToken: accessToken || "",
                            userId: id,
                            role: bulkRole,
                            fullName: "",
                            initials: "",
                          },
                        }),
                      ),
                    );
                    const ok = results.filter((r) => r.status === "fulfilled").length;
                    toast.success(t("users.bulk.usersUpdated", "{{count}} utenti aggiornati", { count: ok }));
                    await load();
                    setSelectedIds(new Set());
                  } catch (err) {
                    toast.error(getAdminErrorMessage(err, t("users.bulk.bulkFailed", "Operazione bulk fallita")));
                  } finally {
                    setBulkBusy(false);
                  }
                }}
              >
                {t("users.bulk.applyRole", "Applica ruolo")}
              </Button>
              <Button
                onClick={() => {
                  // determine target: if any selected active -> disable, else enable
                  const ids = new Set(selectedIds);
                  const anyActive = rows.some((r) => ids.has(r.id) && r.status === "active");
                  setBulkAction(anyActive ? "disable" : "enable");
                  setBulkConfirmOpen(true);
                }}
              >
                {t("users.bulk.toggleDisable", "Disabilita / Riabilita")}
              </Button>
              <Button
                onClick={async () => {
                  if (bulkBusy) return;
                  setBulkBusy(true);
                  try {
                    const ids = Array.from(selectedIds);
                    const invitedIds = ids.filter((id) =>
                      rows.some((r) => r.id === id && r.status === "invited"),
                    );
                    const results = await Promise.allSettled(
                      invitedIds.map((id) =>
                        resendInvite({
                          data: {
                            accessToken: accessToken || "",
                            userId: id,
                            redirectTo: `${window.location.origin}/auth/set-password`,
                          },
                        }),
                      ),
                    );
                    const ok = results.filter((r) => r.status === "fulfilled").length;
                    toast.success(t("users.bulk.invitesResent", "{{count}} inviti reinviati", { count: ok }));
                    await load();
                    setSelectedIds(new Set());
                  } catch (err) {
                    toast.error(getAdminErrorMessage(err, t("users.bulk.resendBulkFailed", "Re-invio bulk fallito")));
                  } finally {
                    setBulkBusy(false);
                  }
                }}
              >
                {t("users.bulk.resendInvites", "Re-invia inviti")}
              </Button>
              <Button
                onClick={() => {
                  // export CSV for selected
                  const ids = new Set(selectedIds);
                  const selectedRows = rows.filter((r) => ids.has(r.id));
                  if (selectedRows.length === 0) return toast.error(t("users.bulk.noUsersSelected", "Nessun utente selezionato"));
                  const headers = [
                    "id",
                    "email",
                    "full_name",
                    "role",
                    "status",
                    "created_at",
                    "last_sign_in_at",
                  ];
                  downloadCsv(
                    [
                      headers,
                      ...selectedRows.map((r) => [
                        r.id,
                        r.email ?? "",
                        r.full_name,
                        r.role,
                        r.status,
                        r.created_at,
                        r.last_sign_in_at ?? "",
                      ]),
                    ],
                    buildDownloadFileName("pcready-users", "csv", { dated: true }),
                  );
                  toast.success(t("users.bulk.csvExported", "CSV esportato"));
                }}
              >
                {t("users.bulk.exportCsv", "Export CSV")}
              </Button>
            </div>
          </div>
        )}
        <OverflowTable>
          <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                className="px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
              >
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={(val) => {
                    if (val) setSelectedIds(new Set(filtered.map((r) => r.id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              {[t("users.table.colName", "Nome"), t("users.table.colEmail", "Email"), t("users.table.colRole", "Ruolo"), t("users.table.colCreated", "Creato il"), t("users.table.colAccess", "Accesso"), t("users.table.col2fa", "2FA"), t("users.table.colStatus", "Stato"), t("users.table.colActions", "Azioni")].map(
                (header) => (
                  <th
                    key={header}
                    className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loadingRows ? (
              <TableSkeletonRows rows={10} columns={9} cellClassName="px-[14px] py-[10px]" />
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-b hover:bg-surface2 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-[14px] py-[10px]">
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(val) => {
                        const next = new Set(selectedIds);
                        if (val) next.add(row.id);
                        else next.delete(row.id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          background: "var(--accent2)",
                          color: "var(--accent)",
                          fontFamily: "var(--font-head)",
                        }}
                      >
                        {row.initials}
                      </span>
                      <span className="font-semibold text-[13px]">{row.full_name}</span>
                    </div>
                  </td>
                  <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                    {row.email || "-"}
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <AdminUserRoleEditor
                      role={row.role}
                      disabled={busyId === row.id}
                      onChange={(nextRole) => saveRole(row, nextRole)}
                    />
                  </td>
                  <td className="px-[14px] py-[10px] text-[11.5px] text-text3 font-mono">
                    {fmtDateTime(row.created_at)}
                  </td>
                  <td className="px-[14px] py-[10px] text-[11.5px] text-text3 font-mono">
                    {row.last_sign_in_at ? (
                      fmtDateTime(row.last_sign_in_at)
                    ) : (
                      <span className="italic">{t("users.row.neverAccessed", "Mai acceduto")}</span>
                    )}
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <MfaStatusBadge enabled={row.mfa_enabled} required={row.mfa_required} />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <AdminUserStatusBadge
                      status={row.status}
                      invitedAt={row.invited_at}
                      busy={busyId === row.id}
                      onResend={() => resendInviteFor(row)}
                    />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <div className="flex items-center gap-1">
                      <button
                        className="pc-btn-icon touch-target"
                        title={row.status === "disabled" ? t("users.tooltip.enableUser", "Riabilita utente") : t("users.tooltip.disableUser", "Disabilita utente")}
                        disabled={busyId === row.id || row.id === user?.id}
                        onClick={() => toggleDisabled(row)}
                      >
                        {row.status === "disabled" ? (
                          <UserCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        className="pc-btn-icon touch-target"
                        title={t("users.tooltip.removeUser", "Rimuovi utente")}
                        disabled={busyId === row.id || row.id === user?.id}
                        onClick={() => remove(row)}
                        style={{ color: "var(--danger, #DC2626)" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!loadingRows && !(filtered ?? []).length && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-text3 text-sm">
                  {t("users.empty.noUsers", "Nessun utente trovato")}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </OverflowTable>
      </div>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("users.delete.title", "Rimuovi utente")}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* render translation which contains HTML (<strong>{{email}}</strong>) */}
              <div
                dangerouslySetInnerHTML={{
                  __html: t("users.delete.description", { email: deleteTarget?.email ?? "", interpolation: { escapeValue: false } }),
                }}
              />
              <div className="mt-2">
                <div className="font-semibold">{deleteTarget?.full_name || deleteTarget?.email}</div>
                <div className="font-mono text-sm text-text3">{deleteTarget?.email}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("users.delete.cancel", "Annulla")}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                // protect against accidental self-delete
                if (deleteTarget.id === user?.id) {
                  toast.error(t("users.delete.cannotSelf", "Non è possibile eliminare l'utente amministratore attualmente loggato"));
                  setDeleteTarget(null);
                  return;
                }
                await confirmRemove();
              }}
              disabled={busyId === deleteTarget?.id || deleteTarget?.id === user?.id}
            >
              {t("users.delete.confirm", "Elimina")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={bulkConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkConfirmOpen(false);
            setBulkAction(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "disable" ? t("users.bulkDialog.disableTitle", "Disabilita utenti") : t("users.bulkDialog.enableTitle", "Riabilita utenti")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("users.bulkDialog.description", "Sei sicuro di voler {{action}} {{count}} utenti selezionati? Questa azione può essere annullata riabilitando gli utenti individualmente.", {
                action: bulkAction === "disable" ? "disabilitare" : "riabilitare",
                count: selectedIds.size,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("users.bulkDialog.cancel", "Annulla")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!accessToken || !bulkAction) return;
                setBulkConfirmOpen(false);
                setBulkBusy(true);
                try {
                  const ids = Array.from(selectedIds);
                  const targetDisabled = bulkAction === "disable";
                  const results = await Promise.allSettled(
                    ids.map((id) =>
                      setDisabled({
                        data: {
                          accessToken: accessToken || "",
                          userId: id,
                          disabled: targetDisabled,
                        },
                      }),
                    ),
                  );
                  const ok = results.filter((r) => r.status === "fulfilled").length;
                  toast.success(`${ok} utenti aggiornati`);
                  await load();
                  setSelectedIds(new Set());
                } catch (err) {
                  toast.error(getAdminErrorMessage(err, t("users.bulk.bulkFailed", "Operazione bulk fallita")));
                } finally {
                  setBulkBusy(false);
                  setBulkAction(null);
                }
              }}
            >
              {t("users.bulkDialog.confirm", "Conferma")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
