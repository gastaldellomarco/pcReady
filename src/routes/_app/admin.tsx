import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminAuditTab } from "@/components/admin/AdminAuditTab";
import { AdminOAuthTab } from "@/components/admin/AdminOAuthTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const check = useServerFn(checkAdmin);
  const [serverVerified, setServerVerified] = useState<{
    loading: boolean;
    isAdmin: boolean;
  }>({ loading: true, isAdmin: false });

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
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="users">{t("tabs.users", "Utenti")}</TabsTrigger>
        <TabsTrigger value="settings">{t("tabs.settings", "Impostazioni App")}</TabsTrigger>
        <TabsTrigger value="oauth">{t("tabs.oauth", "OAuth / Applicazioni")}</TabsTrigger>
        <TabsTrigger value="audit">{t("tabs.audit", "Audit Log")}</TabsTrigger>
      </TabsList>
      <AdminUsersTab />
      <AdminSettingsTab />
      <AdminOAuthTab />
      <AdminAuditTab searchParams={search} />
    </Tabs>
  );
}
