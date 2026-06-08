import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { ALL_PERMISSIONS } from "@/lib/auth-context";
import { type RolePermissions } from "@/lib/admin-permissions";

const PERMISSION_LABELS: Record<string, { it: string; en: string }> = {
  can_view_costs: { it: "Visualizzare i costi", en: "View costs" },
  can_manage_costs: { it: "Gestire i costi", en: "Manage costs" },
  can_archive_tickets: { it: "Archiviare ticket", en: "Archive tickets" },
  can_manage_users: { it: "Gestire utenti", en: "Manage users" },
  can_manage_automations: { it: "Gestire automazioni", en: "Manage automations" },
  can_manage_oauth: { it: "Gestire OAuth / Applicazioni", en: "Manage OAuth / Apps" },
  can_export_data: { it: "Esportare dati", en: "Export data" },
  can_manage_settings: { it: "Gestire impostazioni", en: "Manage settings" },
  can_view_audit_log: { it: "Visualizzare audit log", en: "View audit log" },
  can_manage_bundles: { it: "Gestire pacchetti assistenza", en: "Manage bundles" },
  can_delete_devices: { it: "Eliminare dispositivi", en: "Delete devices" },
  can_manage_checklist_templates: { it: "Gestire template checklist", en: "Manage checklist templates" },
};

interface Props {
  accessToken: string | undefined;
}

export function AdminPermissionsTab({ accessToken }: Props) {
  const { t, i18n } = useTranslation("admin");
  const lang = (i18n.language?.split("-")[0] ?? "it") as "it" | "en";

  const [rolePerms, setRolePerms] = useState<RolePermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());

  // Local editable state: role -> Set of permissions
  const [edits, setEdits] = useState<Map<string, Set<string>>>(new Map());

  const loadPermissions = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const { listRolePermissions: listFn } = await import("@/lib/admin-permissions");
      const result = await listFn({ data: { accessToken } });
      setRolePerms(result as any);
      const editsMap = new Map<string, Set<string>>();
      for (const rp of result as any) {
        editsMap.set(rp.role, new Set(rp.permissions));
      }
      setEdits(editsMap);
      setDirtyRoles(new Set());
    } catch (err: any) {
      setError(err?.message ?? "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  function togglePermission(role: string, permission: string) {
    setEdits((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(role) ?? []);
      if (current.has(permission)) {
        current.delete(permission);
      } else {
        current.add(permission);
      }
      next.set(role, current);
      return next;
    });
    setDirtyRoles((prev) => new Set(prev).add(role));
  }

  async function handleSave(role: string) {
    if (!accessToken) return;
    setSaving(role);
    setError(null);
    try {
      const permissions = Array.from(edits.get(role) ?? []);
      const { saveRolePermissions: saveFn } = await import("@/lib/admin-permissions");
      await saveFn({ data: { accessToken, role, permissions } });
      // Local state already reflects what was saved — just clear dirty flag
      setDirtyRoles((prev) => {
        const next = new Set(prev);
        next.delete(role);
        return next;
      });
    } catch (err: any) {
      setError(err?.message ?? "Errore nel salvataggio");
    } finally {
      setSaving(null);
    }
  }

  const roles = rolePerms.filter((r) => r.role !== "admin");

  const getPermissionLabel = (perm: string) => {
    return PERMISSION_LABELS[perm]?.[lang] ?? perm;
  };

  return (
    <TabsContent value="permissions" className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            {t("permissions.title", "Permessi Ruoli")}
          </CardTitle>
          <CardDescription>
            {t(
              "permissions.description",
              "Assegna permessi granulari ai ruoli Tech e Viewer. Il ruolo Admin ha sempre tutti i permessi.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("permissions.loading", "Caricamento permessi...")}
            </div>
          ) : error && roles.length === 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Admin row (immutable, informational) */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    ADMIN
                  </span>
                  <span className="text-sm font-medium">
                    {t("permissions.adminRole", "Amministratore")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    — {t("permissions.adminAll", "tutti i permessi (non modificabile)")}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <div key={perm} className="flex items-center gap-2">
                      <Checkbox checked disabled />
                      <Label className="text-xs text-muted-foreground cursor-default">
                        {getPermissionLabel(perm)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Editable roles: Tech, Viewer */}
              {roles.map((rp) => {
                const isDirty = dirtyRoles.has(rp.role);
                const isSaving = saving === rp.role;
                const currentPerms = edits.get(rp.role) ?? new Set();

                return (
                  <div key={rp.role} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground uppercase">
                          {rp.role}
                        </span>
                        <span className="text-sm font-medium">
                          {rp.role === "tech"
                            ? t("permissions.techRole", "Tecnico")
                            : t("permissions.viewerRole", "Visualizzatore")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        disabled={!isDirty || isSaving}
                        onClick={() => handleSave(rp.role)}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                            {t("permissions.saving", "Salvataggio...")}
                          </>
                        ) : (
                          <>
                            <Save className="size-3.5 mr-1.5" />
                            {t("permissions.save", "Salva permessi")}
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {ALL_PERMISSIONS.map((perm) => (
                        <div key={perm} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${rp.role}-${perm}`}
                            checked={currentPerms.has(perm)}
                            onCheckedChange={() => togglePermission(rp.role, perm)}
                          />
                          <Label
                            htmlFor={`perm-${rp.role}-${perm}`}
                            className="text-sm cursor-pointer"
                          >
                            {getPermissionLabel(perm)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
