import DOMPurify from "dompurify";
import { Eye, MailPlus, Search, Trash2, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AdminUserRoleEditor } from "@/components/admin/AdminUserRoleEditor";
import { AdminUserStatusBadge } from "@/components/admin/AdminUserStatusBadge";
import { TableSkeletonRows } from "@/components/page-states";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MobileCardView, type MobileCardColumn } from "@/components/ui/mobile-card-view";
import OverflowTable from "@/components/ui/overflow-table";
import { TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminAppSettings } from "@/hooks/useAdminAppSettings";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { ADMIN_ROLES, adminRoleLabel } from "@/lib/admin/admin-constants";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { buildDownloadFileName, downloadCsv } from "@/lib/downloads";
import { fmtDateTime } from "@/lib/pcready";

function MfaStatusBadge({
  enabled,
  required,
  role,
}: {
  enabled: boolean;
  required: boolean;
  role?: string;
}) {
  const { t } = useTranslation("admin");
  if (enabled) return <Badge className="bg-emerald-600">{t("users.mfa.active", "Attivo")}</Badge>;
  if (required)
    return (
      <Badge className="bg-amber-500 text-white">{t("users.mfa.required", "Richiesto")}</Badge>
    );
  // emphasize admins without 2FA
  if (role === "admin")
    return (
      <Badge className="bg-red-600 flex items-center gap-1">
        <AlertTriangle className="size-3.5" />
        {t("users.mfa.notActive", "Non attivo")}
      </Badge>
    );
  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <AlertTriangle className="size-3.5" />
      {t("users.mfa.notActive", "Non attivo")}
    </Badge>
  );
}

/**
 *
 */
export function AdminUsersTab() {
  const { t } = useTranslation("admin");
  const { session, user, hasPermission, startImpersonation, isImpersonating } = useAuth();
  const canManageUsers = hasPermission("can_manage_users");
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
    canManageUsers,
    currentUserId: user?.id,
  });

  const emailRegister = inviteForm.register("email");
  const watchedEmail = inviteForm.watch("email");
  const watchedFullName = inviteForm.watch("fullName");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const clientEmailInvalid = watchedEmail && !EMAIL_RE.test(watchedEmail);
  const isInviteButtonEnabled =
    !inviteBusy &&
    !!watchedFullName &&
    !!watchedEmail &&
    EMAIL_RE.test(watchedEmail) &&
    inviteForm.formState.isValid;

  const { settings } = useAdminAppSettings({ accessToken, canManageSettings: hasPermission("can_manage_settings") });
  const isMobile = useIsMobile();

  const userCardColumns: MobileCardColumn<any>[] = [
    {
      label: "Nome",
      accessor: (row: any) => (
        <div className="flex items-center gap-2.5">
          <span
            className="size-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
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
      ),
      primary: true,
    },
    { label: "Email", accessor: "email" },
    {
      label: "Ruolo",
      render: (row: any) => (
        <AdminUserRoleEditor
          role={row.role}
          disabled={busyId === row.id}
          onChange={(nextRole: AppRole) => saveRole(row, nextRole)}
        />
      ),
    },
    { label: "Creato il", accessor: (row: any) => fmtDateTime(row.created_at) },
    {
      label: "Ultimo accesso",
      accessor: (row: any) =>
        row.last_sign_in_at ? fmtDateTime(row.last_sign_in_at) : "Mai acceduto",
    },
    {
      label: "2FA",
      render: (row: any) => (
        <MfaStatusBadge enabled={row.mfa_enabled} required={row.mfa_required} role={row.role} />
      ),
    },
    {
      label: "Stato",
      render: (row: any) => (
        <AdminUserStatusBadge
          status={row.status}
          invitedAt={row.invited_at}
          busy={busyId === row.id}
          onResend={() => resendInviteFor(row)}
        />
      ),
    },
    {
      label: "Azioni",
      render: (row: any) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canManageUsers && row.id !== user?.id && row.status !== "invited" && (
            <button
              className="pc-btn-icon touch-target"
              title={t("users.tooltip.impersonate", "Impersona utente")}
              disabled={isImpersonating || busyId === row.id}
              onClick={() => startImpersonation(row.id)}
              style={{ color: "var(--warning, #D97706)" }}
            >
              <Eye className="size-3.5" />
            </button>
          )}
          <button
            className="pc-btn-icon touch-target"
            title={row.status === "disabled" ? "Riabilita utente" : "Disabilita utente"}
            disabled={busyId === row.id || row.id === user?.id}
            onClick={() => toggleDisabled(row)}
          >
            {row.status === "disabled" ? (
              <UserCheck className="size-3.5" />
            ) : (
              <UserX className="size-3.5" />
            )}
          </button>
          <button
            className="pc-btn-icon touch-target"
            title="Rimuovi utente"
            disabled={busyId === row.id || row.id === user?.id}
            onClick={() => remove(row)}
            style={{ color: "var(--danger, #DC2626)" }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

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
            {...emailRegister}
            onBlur={(e) => {
              // preserve react-hook-form's onBlur and also trigger validation explicitly
              try {
                (emailRegister.onBlur as any)?.(e);
              } catch (_) {
                // ignore
              }
              void inviteForm.trigger("email");
            }}
            placeholder={t("users.invite.emailPlaceholder", "utente@azienda.it")}
          />
          {inviteForm.formState.errors.email ? (
            <p className="text-sm text-destructive mt-1">
              {String(inviteForm.formState.errors.email?.message)}
            </p>
          ) : clientEmailInvalid ? (
            <p className="text-sm text-destructive mt-1">
              {t("users.invite.invalidEmail", "Inserisci un'email valida")}
            </p>
          ) : null}
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
          <select
            className="pc-input"
            {...inviteForm.register("role")}
            aria-label={t("users.invite.roleLabel", "Ruolo")}
          >
            {ADMIN_ROLES.map((item) => (
              <option key={item} value={item}>
                {adminRoleLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <button className="pc-btn pc-btn-primary" disabled={!isInviteButtonEnabled} type="submit">
          <MailPlus className="size-3.5" />{" "}
          {inviteBusy
            ? t("users.invite.submitting", "Invio...")
            : t("users.invite.submit", "Invita")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] flex-1 min-w-[220px] max-w-[360px]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          <Search className="size-3 text-text3" />
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
          aria-label={t("users.search.allRoles", "Tutti i ruoli")}
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
        {/* MFA policy banner: show when policy requires MFA and there are users missing it */}
        {settings &&
          (() => {
            const totalWithout = (rows ?? []).filter((r) => !r.mfa_enabled).length;
            const adminsWithout = (rows ?? []).filter(
              (r) => r.role === "admin" && !r.mfa_enabled,
            ).length;
            if (settings.mfa_require_all_users && totalWithout > 0) {
              return (
                <div className="px-4 py-3 border-b bg-amber-50 border-amber-200 text-amber-900">
                  {t(
                    "users.mfaBanner.allUsers",
                    "La policy obbliga il 2FA per tutti gli utenti: {{count}} utenti non hanno ancora configurato 2FA",
                    { count: totalWithout },
                  )}{" "}
                  <a href="/admin" className="underline">
                    {t("users.mfaBanner.goToSettings", "Vai alle impostazioni")}
                  </a>
                </div>
              );
            }
            if (settings.mfa_require_admin_users && adminsWithout > 0) {
              return (
                <div className="px-4 py-3 border-b bg-red-50 border-red-200 text-red-900">
                  {t(
                    "users.mfaBanner.admins",
                    "La policy obbliga il 2FA per gli amministratori: {{count}} amministratori non hanno ancora configurato 2FA",
                    { count: adminsWithout },
                  )}{" "}
                  <a href="/admin" className="underline">
                    {t("users.mfaBanner.goToSettings", "Vai alle impostazioni")}
                  </a>
                </div>
              );
            }
            return null;
          })()}
        {selectedIds.size > 0 && (
          <div className="px-4 py-3 border-b bg-surface2 border-border flex items-center gap-3">
            <div className="text-sm text-text3">
              {t("users.bulk.selected", "{{count}} selezionati", { count: selectedIds.size })}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="pc-input max-w-[160px]"
                value={bulkRole}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setBulkRole(e.target.value as any)
                }
                aria-label={t("users.bulk.roleLabel", "Ruolo in blocco")}
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
                    toast.success(
                      t("users.bulk.usersUpdated", "{{count}} utenti aggiornati", { count: ok }),
                    );
                    await load();
                    setSelectedIds(new Set());
                  } catch (err) {
                    toast.error(
                      getAdminErrorMessage(
                        err,
                        t("users.bulk.bulkFailed", "Operazione bulk fallita"),
                      ),
                    );
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
                    toast.success(
                      t("users.bulk.invitesResent", "{{count}} inviti reinviati", { count: ok }),
                    );
                    await load();
                    setSelectedIds(new Set());
                  } catch (err) {
                    toast.error(
                      getAdminErrorMessage(
                        err,
                        t("users.bulk.resendBulkFailed", "Re-invio bulk fallito"),
                      ),
                    );
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
                  if (selectedRows.length === 0)
                    return toast.error(
                      t("users.bulk.noUsersSelected", "Nessun utente selezionato"),
                    );
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
          {!isMobile ? (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th
                    className="px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    aria-label={t("users.table.selectAll", "Seleziona tutti")}
                  >
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={(val) => {
                        if (val) setSelectedIds(new Set(filtered.map((r) => r.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  {[
                    t("users.table.colName", "Nome"),
                    t("users.table.colEmail", "Email"),
                    t("users.table.colRole", "Ruolo"),
                    t("users.table.colCreated", "Creato il"),
                    t("users.table.colAccess", "Accesso"),
                    t("users.table.col2fa", "2FA"),
                    t("users.table.colStatus", "Stato"),
                    t("users.table.colActions", "Azioni"),
                  ].map((header) => (
                    <th
                      key={header}
                      className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                      style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    >
                      {header}
                    </th>
                  ))}
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
                            className="size-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
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
                          <span className="italic">
                            {t("users.row.neverAccessed", "Mai acceduto")}
                          </span>
                        )}
                      </td>
                      <td className="px-[14px] py-[10px]">
                        <MfaStatusBadge
                          enabled={row.mfa_enabled}
                          required={row.mfa_required}
                          role={row.role}
                        />
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
                          {canManageUsers && row.id !== user?.id && row.status !== "invited" && (
                            <button
                              className="pc-btn-icon touch-target"
                              title={t("users.tooltip.impersonate", "Impersona utente")}
                              disabled={isImpersonating || busyId === row.id}
                              onClick={() => startImpersonation(row.id)}
                              style={{ color: "var(--warning, #D97706)" }}
                            >
                              <Eye className="size-3.5" />
                            </button>
                          )}
                          <button
                            className="pc-btn-icon touch-target"
                            title={
                              row.status === "disabled"
                                ? t("users.tooltip.enableUser", "Riabilita utente")
                                : t("users.tooltip.disableUser", "Disabilita utente")
                            }
                            disabled={busyId === row.id || row.id === user?.id}
                            onClick={() => toggleDisabled(row)}
                          >
                            {row.status === "disabled" ? (
                              <UserCheck className="size-3.5" />
                            ) : (
                              <UserX className="size-3.5" />
                            )}
                          </button>
                          <button
                            className="pc-btn-icon touch-target"
                            title={t("users.tooltip.removeUser", "Rimuovi utente")}
                            disabled={busyId === row.id || row.id === user?.id}
                            onClick={() => remove(row)}
                            style={{ color: "var(--danger, #DC2626)" }}
                          >
                            <Trash2 className="size-3.5" />
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
          ) : (
            <MobileCardView
              data={filtered ?? []}
              columns={userCardColumns}
              keyField="id"
              emptyMessage={t("users.empty.noUsers", "Nessun utente trovato")}
            />
          )}
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
              {/* eslint-disable-next-line react/no-danger -- translation HTML sanitized with DOMPurify */}
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    t("users.delete.description", {
                      email: deleteTarget?.email ?? "",
                      interpolation: { escapeValue: false },
                    }),
                  ),
                }}
              />
              <div className="mt-2">
                <div className="font-semibold">
                  {deleteTarget?.full_name || deleteTarget?.email}
                </div>
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
                  toast.error(
                    t(
                      "users.delete.cannotSelf",
                      "Non è possibile eliminare l'utente amministratore attualmente loggato",
                    ),
                  );
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
              {bulkAction === "disable"
                ? t("users.bulkDialog.disableTitle", "Disabilita utenti")
                : t("users.bulkDialog.enableTitle", "Riabilita utenti")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "users.bulkDialog.description",
                "Sei sicuro di voler {{action}} {{count}} utenti selezionati? Questa azione può essere annullata riabilitando gli utenti individualmente.",
                {
                  action: bulkAction === "disable" ? "disabilitare" : "riabilitare",
                  count: selectedIds.size,
                },
              )}
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
                  toast.error(
                    getAdminErrorMessage(
                      err,
                      t("users.bulk.bulkFailed", "Operazione bulk fallita"),
                    ),
                  );
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
