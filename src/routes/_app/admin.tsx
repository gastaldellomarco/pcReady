import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminAuditTab } from "@/components/admin/AdminAuditTab";
import { AdminBackupDrTab } from "@/components/admin/AdminBackupDrTab";
import { AdminOAuthTab } from "@/components/admin/AdminOAuthTab";
import { AdminPermissionsTab } from "@/components/admin/AdminPermissionsTab";
import { AdminScriptShareTab } from "@/components/admin/AdminScriptShareTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAppSettings } from "@/hooks/useAdminAppSettings";
import i18n from "@/i18n";
import { useAuth } from "@/lib/auth-context";
import { checkAdmin } from "@/lib/check-admin";

export const Route = createFileRoute("/_app/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    // Audit filters
    auditActionType:
      typeof search.auditActionType === "string" ? search.auditActionType : undefined,
    auditUser: typeof search.auditUser === "string" ? search.auditUser : undefined,
    auditEntityType:
      typeof search.auditEntityType === "string" ? search.auditEntityType : undefined,
    auditOutcome: typeof search.auditOutcome === "string" ? search.auditOutcome : undefined,
    auditDateFrom: typeof search.auditDateFrom === "string" ? search.auditDateFrom : undefined,
    auditDateTo: typeof search.auditDateTo === "string" ? search.auditDateTo : undefined,
    auditSearch: typeof search.auditSearch === "string" ? search.auditSearch : undefined,
    auditPage: typeof search.auditPage === "string" ? Number(search.auditPage) : undefined,
    auditPreset: typeof search.auditPreset === "string" ? search.auditPreset : undefined,
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: i18n.t("admin:meta.title", "Admin Utenti - PCReady") },
      {
        name: "description",
        content: i18n.t("admin:meta.description", "Gestione utenti, ruoli e stato account."),
      },
    ],
  }),
  component: AdminUsersPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

function AdminUsersPage() {
  const { t } = useTranslation("admin");
  const { loading, session, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const check = useServerFn(checkAdmin);
  const [serverVerified, setServerVerified] = useState<{
    loading: boolean;
    isAdmin: boolean;
  }>({ loading: true, isAdmin: false });

  const accessToken = session?.access_token;

  // Compute permission booleans from granular permissions
  const canViewAuditLog = hasPermission("can_view_audit_log");
  const canManageOAuth = hasPermission("can_manage_oauth");
  const canManageSettings = hasPermission("can_manage_settings");
  const canExportData = hasPermission("can_export_data");

  // Single hook call shared by both settings and backup-DR tabs
  const {
    settings,
    loadingSettings,
    settingsForm,
    submitSettings,
    saveSettingsBusy,
    exportAllBusy,
    handleExportAllData,
  } = useAdminAppSettings({ accessToken, canManageSettings });

  // Warn on browser refresh/close when settings have unsaved changes
  const isDirty = settingsForm.formState.isDirty;
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    let mounted = true;
    // First, fast client-side redirect for unauthenticated users
    if (!loading && !session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    // Verify admin status server-side to prevent client-only bypass
    (async () => {
      try {
        const resp = await check({ data: { accessToken: session?.access_token ?? "" } });
        if (!mounted) return;
        const isAdminServer = (resp as any)?.isAdmin === true;
        setServerVerified({ loading: false, isAdmin: isAdminServer });
        if (!isAdminServer) navigate({ to: "/dashboard", replace: true });
      } catch (_err) {
        if (!mounted) return;
        setServerVerified({ loading: false, isAdmin: false });
        navigate({ to: "/dashboard", replace: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loading, session, check, navigate]);

  if (loading || serverVerified.loading || !serverVerified.isAdmin) {
    return <div className="text-text3 text-sm">{t("loading", "Verifica permessi...")}</div>;
  }

  return (
    <Tabs defaultValue="users" className="w-full">
      {/* 7 tabs last cell-squashed on phones. The base <TabsList /> primitive
          (src/components/ui/tabs.tsx) already provides `inline-flex overflow-x-auto
          p-1 sm:h-9 sm:justify-center`; this override only adds the mobile-first
          flex-wrap on >=sm + a thin scrollbar at <sm so the strip is usable from
          ~320px upward. */}
      <TabsList className="w-full h-auto flex-nowrap scrollbar-thin sm:flex-wrap">
        <TabsTrigger value="users">{t("tabs.users", "Utenti")}</TabsTrigger>
        <TabsTrigger value="permissions">{t("tabs.permissions", "Permessi")}</TabsTrigger>
        {canManageSettings && (
          <TabsTrigger value="settings">{t("tabs.settings", "Impostazioni")}</TabsTrigger>
        )}
        {canExportData && (
          <TabsTrigger value="backup-dr">{t("tabs.backupDr", "Backup & DR")}</TabsTrigger>
        )}
        {canManageOAuth && (
          <TabsTrigger value="oauth">{t("tabs.oauth", "OAuth / Applicazioni")}</TabsTrigger>
        )}
        {canViewAuditLog && (
          <TabsTrigger value="audit">{t("tabs.audit", "Audit Log")}</TabsTrigger>
        )}
        <TabsTrigger value="script-shares">{t("tabs.scriptShares", "Link script")}</TabsTrigger>
      </TabsList>
      <AdminUsersTab searchParams={search} />
      <AdminPermissionsTab accessToken={accessToken} />
      {canManageSettings && (
        <AdminSettingsTab
          accessToken={accessToken}
          userEmail={user?.email ?? ""}
          settings={settings}
          loadingSettings={loadingSettings}
          settingsForm={settingsForm}
          submitSettings={submitSettings}
          saveSettingsBusy={saveSettingsBusy}
        />
      )}
      {canExportData && (
        <AdminBackupDrTab
          settings={settings}
          exportAllBusy={exportAllBusy}
          handleExportAllData={handleExportAllData}
        />
      )}
      {canManageOAuth && <AdminOAuthTab />}
      {canViewAuditLog && <AdminAuditTab searchParams={search} />}
      <AdminScriptShareTab accessToken={accessToken} />
    </Tabs>
  );
}
