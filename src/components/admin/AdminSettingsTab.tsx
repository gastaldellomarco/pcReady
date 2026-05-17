import { DatabaseBackup, Download, Settings, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailTemplateSection } from "@/components/admin/EmailTemplateSection";
import { TagListEditor } from "@/components/admin/TagListEditor";
import { BackupMetric } from "@/components/admin/BackupMetric";
import { ADMIN_WIP_LIMIT_FIELDS, ADMIN_SLA_CONFIG_FIELDS } from "@/lib/admin/admin-constants";
import { useAuth } from "@/lib/auth-context";
import { useAdminAppSettings } from "@/hooks/useAdminAppSettings";

export function AdminSettingsTab() {
  const { session, user, isAdmin } = useAuth();
  const accessToken = session?.access_token;
  const {
    settings,
    loadingSettings,
    settingsForm,
    submitSettings,
    saveSettingsBusy,
    exportAllBusy,
    handleExportAllData,
  } = useAdminAppSettings({ accessToken, isAdmin });

  return (
    <TabsContent value="settings" className="space-y-5">
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">Generale</TabsTrigger>
          <TabsTrigger value="email-templates">Template Email</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="mb-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DatabaseBackup className="h-5 w-5" />
                Backup &amp; Disaster Recovery
              </CardTitle>
              <CardDescription>
                Policy di protezione dati, continuità operativa ed export manuale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <BackupMetric
                  label="Frequenza"
                  value="Giornaliero automatico"
                  detail="Backup gestiti da Supabase"
                />
                <BackupMetric
                  label="Retention"
                  value="30 giorni Pro / 7 giorni Free"
                  detail="In base al piano Supabase"
                />
                <BackupMetric
                  label="Ultimo backup"
                  value="Gestito dal provider"
                  detail="Verificabile dalla dashboard Supabase"
                />
                <BackupMetric
                  label="RPO"
                  value="< 24 ore"
                  detail="Per backup automatici giornalieri"
                />
                <BackupMetric
                  label="RTO"
                  value="< 4 ore"
                  detail="Ripristino coordinato con il supporto"
                />
                <BackupMetric
                  label="Emergenze"
                  value={settings?.support_email || "Email supporto non configurata"}
                  detail="Contatto operativo per restore e incidenti"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Export manuale dati</p>
                  <p className="text-xs text-muted-foreground">
                    Scarica un archivio ZIP con CSV di ticket, dispositivi e clienti.
                  </p>
                </div>
                <Button onClick={handleExportAllData} disabled={exportAllBusy} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  {exportAllBusy ? "Esportazione..." : "Esporta tutti i dati"}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>Dati protetti con backup giornalieri automatici</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Impostazioni Applicazione
              </CardTitle>
              <CardDescription>
                Configura le impostazioni globali dell'applicazione PCReady
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSettings ? (
                <p className="text-center py-4 text-muted-foreground">
                  Caricamento impostazioni...
                </p>
              ) : settings ? (
                <form onSubmit={settingsForm.handleSubmit(submitSettings)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="organization_name">Nome Organizzazione</Label>
                      <Input
                        id="organization_name"
                        {...settingsForm.register("organization_name")}
                        placeholder="PCReady"
                      />
                      {settingsForm.formState.errors.organization_name && (
                        <p className="text-sm text-destructive mt-1">
                          {String(settingsForm.formState.errors.organization_name?.message)}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="default_timezone">Timezone Predefinito</Label>
                      <Input
                        id="default_timezone"
                        {...settingsForm.register("default_timezone")}
                        placeholder="Europe/Rome"
                      />
                      {settingsForm.formState.errors.default_timezone && (
                        <p className="text-sm text-destructive mt-1">
                          {String(settingsForm.formState.errors.default_timezone?.message)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max_devices_per_technician">
                        Max Dispositivi per Tecnico
                      </Label>
                      <Input
                        id="max_devices_per_technician"
                        type="number"
                        min={1}
                        max={100}
                        {...settingsForm.register("max_devices_per_technician")}
                      />
                      {settingsForm.formState.errors.max_devices_per_technician && (
                        <p className="text-sm text-destructive mt-1">
                          {String(
                            settingsForm.formState.errors.max_devices_per_technician?.message,
                          )}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="support_email">Email Supporto</Label>
                      <Input
                        id="support_email"
                        type="email"
                        {...settingsForm.register("support_email")}
                        placeholder="support@pcready.it"
                      />
                      {settingsForm.formState.errors.support_email && (
                        <p className="text-sm text-destructive mt-1">
                          {String(settingsForm.formState.errors.support_email?.message)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-3 rounded-lg border p-4">
                      <div>
                        <h3 className="font-medium">Variabili di sistema</h3>
                        <p className="text-sm text-muted-foreground">
                          Gestisci le liste usate nei form operativi dell'applicazione.
                        </p>
                      </div>
                      <TagListEditor
                        label="Sistemi Operativi disponibili"
                        values={settingsForm.watch("os_options") ?? []}
                        onChange={(values) =>
                          settingsForm.setValue("os_options", values, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        placeholder="Aggiungi sistema operativo..."
                      />
                      <TagListEditor
                        label="Brand dispositivi"
                        values={settingsForm.watch("device_brands") ?? []}
                        onChange={(values) =>
                          settingsForm.setValue("device_brands", values, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        placeholder="Aggiungi brand..."
                      />
                      <TagListEditor
                        label="Categorie ticket"
                        values={settingsForm.watch("ticket_categories") ?? []}
                        onChange={(values) =>
                          settingsForm.setValue("ticket_categories", values, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        placeholder="Aggiungi categoria..."
                      />
                    </div>

                    <div>
                      <Label>Limiti WIP Kanban</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        {ADMIN_WIP_LIMIT_FIELDS.map(([status, label]) => (
                          <div key={status}>
                            <Label
                              htmlFor={`wip_${status}`}
                              className="text-xs text-muted-foreground"
                            >
                              {label}
                            </Label>
                            <Input
                              id={`wip_${status}`}
                              type="number"
                              min={0}
                              max={999}
                              {...settingsForm.register(`wip_limits.${status}`)}
                            />
                            {settingsForm.formState.errors.wip_limits?.[status] && (
                              <p className="text-sm text-destructive mt-1">
                                {String(
                                  settingsForm.formState.errors.wip_limits?.[status]?.message,
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <Label htmlFor="archive_after_days">
                          Archiviazione automatica (giorni)
                        </Label>
                        <Input
                          id="archive_after_days"
                          type="number"
                          min={0}
                          max={365}
                          {...settingsForm.register("archive_after_days")}
                        />
                        {settingsForm.formState.errors.archive_after_days && (
                          <p className="text-sm text-destructive mt-1">
                            {String(settingsForm.formState.errors.archive_after_days?.message)}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                          Numero di giorni dopo il completamento per spostare il ticket in archivio.
                          0 = mai.
                        </p>
                      </div>

                      <div className="space-y-3 rounded-lg border p-4 mt-4">
                        <div>
                          <h3 className="font-medium">Configurazione SLA per priorita</h3>
                          <p className="text-sm text-muted-foreground">
                            Configura i tempi massimi di prima risposta e risoluzione. La scadenza
                            SLA del ticket viene calcolata sul tempo di risoluzione.
                          </p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="py-2 pr-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                                  Priorita
                                </th>
                                <th className="py-2 px-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                                  Tempo risposta (ore)
                                </th>
                                <th className="py-2 pl-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                                  Tempo risoluzione (ore)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {ADMIN_SLA_CONFIG_FIELDS.map(([priority, label]) => (
                                <tr key={priority} className="border-b last:border-0">
                                  <td className="py-3 pr-3 font-medium">{label}</td>
                                  <td className="py-3 px-3">
                                    <Input
                                      id={`sla_${priority}_response`}
                                      type="number"
                                      min={1}
                                      max={999}
                                      {...(settingsForm.register as any)(
                                        `sla_config.${priority}.responseHours`,
                                      )}
                                    />
                                  </td>
                                  <td className="py-3 pl-3">
                                    <Input
                                      id={`sla_${priority}_resolution`}
                                      type="number"
                                      min={1}
                                      max={999}
                                      {...(settingsForm.register as any)(
                                        `sla_config.${priority}.resolutionHours`,
                                      )}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="self_registration_enabled"
                        {...settingsForm.register("self_registration_enabled")}
                      />
                      <Label htmlFor="self_registration_enabled">
                        Abilita registrazione autonoma nuovi utenti
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="admin_approval_required"
                        {...settingsForm.register("admin_approval_required")}
                      />
                      <Label htmlFor="admin_approval_required">
                        Richiedi approvazione admin per nuovi account
                      </Label>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4 mt-4">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" /> Autenticazione a due fattori
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Imposta policy 2FA obbligatorie e periodo di grazia per gli utenti.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mfa_require_admin_users"
                          checked={!!settingsForm.watch("mfa_require_admin_users" as any)}
                          onCheckedChange={(checked) =>
                            settingsForm.setValue(
                              "mfa_require_admin_users" as any,
                              checked === true,
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            )
                          }
                        />
                        <Label htmlFor="mfa_require_admin_users">
                          Richiedi 2FA per tutti gli utenti admin
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="mfa_require_all_users"
                          checked={!!settingsForm.watch("mfa_require_all_users" as any)}
                          onCheckedChange={(checked) =>
                            settingsForm.setValue(
                              "mfa_require_all_users" as any,
                              checked === true,
                              {
                                shouldDirty: true,
                                shouldValidate: true,
                              },
                            )
                          }
                        />
                        <Label htmlFor="mfa_require_all_users">
                          Richiedi 2FA per tutti gli utenti
                        </Label>
                      </div>
                      <div className="max-w-xs">
                        <Label htmlFor="mfa_grace_period_days">Periodo di grazia (giorni)</Label>
                        <Input
                          id="mfa_grace_period_days"
                          type="number"
                          min={0}
                          max={365}
                          {...settingsForm.register("mfa_grace_period_days" as any)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Dopo N giorni senza configurazione 2FA, l&apos;accesso operativo viene
                          bloccato.
                        </p>
                      </div>
                    </div>

                    {/* Log Retention */}
                    <div className="space-y-3 rounded-lg border p-4 mt-4">
                      <div>
                        <h3 className="font-medium">Retention Log di Audit</h3>
                        <p className="text-sm text-muted-foreground">
                          Configura per quanti giorni mantenere i log di attivita prima
                          dell&apos;archiviazione automatica.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          className="pc-input max-w-[200px]"
                          value={String((settingsForm.watch as any)("log_retention_days") ?? 365)}
                          onChange={(e) =>
                            (settingsForm.setValue as any)(
                              "log_retention_days",
                              Number(e.target.value),
                            )
                          }
                        >
                          <option value="90">90 giorni (3 mesi)</option>
                          <option value="180">180 giorni (6 mesi)</option>
                          <option value="365">365 giorni (1 anno)</option>
                          <option value="730">730 giorni (2 anni)</option>
                        </select>
                        <span className="text-xs text-muted-foreground">
                          I log piu vecchi verranno spostati nell&apos;archivio
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <DatabaseBackup className="h-3 w-3" />
                        <span>Log archiviati disponibili in sola lettura nella sezione Log</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={!settingsForm.formState.isValid || saveSettingsBusy}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {saveSettingsBusy ? "Salvataggio..." : "Salva Impostazioni"}
                  </Button>
                </form>
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  Errore nel caricamento delle impostazioni
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-templates">
          {accessToken ? (
            <EmailTemplateSection
              accessToken={accessToken}
              adminEmail={user?.email ?? ""}
              organizationName={settings?.organization_name ?? "PCReady"}
              supportEmail={settings?.support_email ?? ""}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </TabsContent>
  );
}
