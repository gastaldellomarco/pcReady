import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminOAuthTab } from "@/components/admin/AdminOAuthTab";
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab";
import { AdminAuditTab } from "@/components/admin/AdminAuditTab";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Admin Utenti - PCReady" },
      { name: "description", content: "Gestione utenti, ruoli e stato account." },
    ],
  }),
  component: AdminUsersPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, loading, navigate]);

  if (loading || !isAdmin) {
    return <div className="text-text3 text-sm">Verifica permessi...</div>;
  }

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="users">Utenti</TabsTrigger>
        <TabsTrigger value="settings">Impostazioni App</TabsTrigger>
        <TabsTrigger value="oauth">OAuth / Applicazioni</TabsTrigger>
        <TabsTrigger value="audit">Audit Log</TabsTrigger>
      </TabsList>
      <AdminUsersTab />
      <AdminSettingsTab />
      <AdminOAuthTab />
      <AdminAuditTab />
    </Tabs>
  );
}
