import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Globe2,
  Save,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { EmailTemplateSection } from "@/components/admin/EmailTemplateSection";
import { TagListEditor } from "@/components/admin/TagListEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import OverflowTable from "@/components/ui/overflow-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_WIP_LIMIT_FIELDS, ADMIN_SLA_CONFIG_FIELDS } from "@/lib/admin/admin-constants";
import type { AppSettings } from "@/lib/app-settings";
import { AppSettingsSchema } from "@/lib/schemas";

function SettingSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SaveButton({
  saveSettingsBusy,
  isValid,
  isDirty,
}: {
  saveSettingsBusy: boolean;
  isValid: boolean;
  isDirty: boolean;
}) {
  const disabled = !isValid || saveSettingsBusy || !isDirty;

  return (
    <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-2 py-3 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {isDirty ? (
          <>
            <AlertTriangle className="size-3.5 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">Modifiche non salvate</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>Tutte le modifiche salvate</span>
          </>
        )}
      </div>
      <Button type="submit" disabled={disabled}>
        <Save className="size-4 mr-2" />
        {saveSettingsBusy ? (
          <>
            <svg
              className="-ml-1 mr-2 h-4 w-4 animate-spin text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            Salvataggio...
          </>
        ) : (
          "Salva Impostazioni"
        )}
      </Button>
    </div>
  );
}

type SettingsFormValues = z.input<typeof AppSettingsSchema>;

interface AdminSettingsTabProps {
  accessToken: string | undefined;
  userEmail: string;
  settings: AppSettings | null;
  loadingSettings: boolean;
  settingsForm: UseFormReturn<SettingsFormValues>;
  submitSettings: (values: SettingsFormValues) => Promise<void>;
  saveSettingsBusy: boolean;
}

/**
 * Admin settings tab: flattened to 2 levels.
 * Level 2 tabs: Generale | Operatività | Sicurezza | Retention | Template Email
 * Backup & DR is now a separate top-level tab.
 * Receives data from the parent admin page to avoid duplicate fetching.
 */
export function AdminSettingsTab({
  accessToken,
  userEmail,
  settings,
  loadingSettings,
  settingsForm,
  submitSettings,
  saveSettingsBusy,
}: AdminSettingsTabProps) {
  const { t: tAdmin } = useTranslation("admin");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  async function handleSettingsSubmit(values: Parameters<typeof submitSettings>[0]) {
    await submitSettings(values);
    setLastSavedAt(new Date());
  }

  const successBanner = lastSavedAt ? (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      <CheckCircle2 className="size-4" />
      Ultimo salvataggio completato alle{" "}
      {lastSavedAt.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </div>
  ) : null;

  return (
    <TabsContent value="settings" className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="size-5" />
            Impostazioni Applicazione
          </CardTitle>
          <CardDescription>
            Configura le impostazioni globali dell&apos;applicazione PCReady
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <p className="text-center py-4 text-muted-foreground">
              Caricamento impostazioni...
            </p>
          ) : settings ? (
            <Tabs defaultValue="generale" className="space-y-4">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="generale">Generale</TabsTrigger>
                <TabsTrigger value="operativita">Operatività</TabsTrigger>
                <TabsTrigger value="sicurezza">Sicurezza</TabsTrigger>
                <TabsTrigger value="retention">Retention</TabsTrigger>
                <TabsTrigger value="email-templates">Template Email</TabsTrigger>
              </TabsList>

              {/* --- Generale --- */}
              <TabsContent value="generale" className="mt-0">
                <form
                  onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)}
                  className="space-y-6"
                >
                  {successBanner && <div className="mb-4">{successBanner}</div>}
                  <SettingSection
                    icon={<Globe2 className="size-4" />}
                    title="Generale"
                    description="Impostazioni visibili in tutta l'app: nome organizzazione, timezone e canali di supporto."
                  >
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
                  </SettingSection>

                  <SaveButton
                    saveSettingsBusy={saveSettingsBusy}
                    isValid={settingsForm.formState.isValid}
                    isDirty={settingsForm.formState.isDirty}
                  />
                </form>
              </TabsContent>

              {/* --- Operatività --- */}
              <TabsContent value="operativita" className="mt-0">
                <form
                  onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)}
                  className="space-y-6"
                >
                  {successBanner && <div className="mb-4">{successBanner}</div>}
                  <SettingSection
                    icon={<SlidersHorizontal className="size-4" />}
                    title="Operatività"
                    description="Valori usati da ticket, inventario, Kanban e automazioni SLA. Modificarli impatta i flussi operativi del team."
                  >
                    <div className="space-y-4">
                      <div className="space-y-3 rounded-lg border p-4">
                        <div>
                          <h3 className="font-medium">Variabili di sistema</h3>
                          <p className="text-sm text-muted-foreground">
                            Gestisci le liste usate nei form operativi dell&apos;applicazione.
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

                      {/* Deprecation thresholds */}
                      <div className="space-y-3 rounded-lg border p-4">
                        <div>
                          <h3 className="font-medium">Deprecazione automatica dispositivi</h3>
                          <p className="text-sm text-muted-foreground">
                            Soglie per marcare automaticamente i dispositivi come &quot;da
                            sostituire&quot;.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="device_deprecation_max_age_years">
                              Età massima (anni)
                            </Label>
                            <Input
                              id="device_deprecation_max_age_years"
                              type="number"
                              min={1}
                              max={20}
                              {...settingsForm.register("device_deprecation_max_age_years" as any)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="device_deprecation_max_tickets_12m">
                              Max ticket in 12 mesi
                            </Label>
                            <Input
                              id="device_deprecation_max_tickets_12m"
                              type="number"
                              min={1}
                              max={100}
                              {...settingsForm.register("device_deprecation_max_tickets_12m" as any)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border p-4">
                        <h3 className="font-medium">Limiti operativi</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Limite sul numero massimo di dispositivi assegnabili a un singolo
                          tecnico.
                        </p>
                        <div className="max-w-[200px]">
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
                      </div>

                      <div className="rounded-lg border p-4">
                        <h3 className="font-medium">Limiti WIP Kanban</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          Numero massimo di ticket per ogni colonna. 0 = nessun limite.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                      </div>

                      <div className="rounded-lg border p-4">
                        <h3 className="font-medium">Archiviazione automatica</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          I ticket completati vengono spostati automaticamente in archivio dopo il
                          numero di giorni specificato.
                        </p>
                        <div className="max-w-[200px]">
                          <Label htmlFor="archive_after_days">Giorni prima dell&apos;archiviazione</Label>
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
                          <p className="text-xs text-muted-foreground mt-1">
                            0 = mai. Max 365 giorni.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-lg border p-4">
                        <div>
                          <h3 className="font-medium">Configurazione SLA per priorità</h3>
                          <p className="text-sm text-muted-foreground">
                            Configura i tempi massimi di prima risposta e risoluzione. La
                            scadenza SLA del ticket viene calcolata sul tempo di risoluzione.
                          </p>
                        </div>
                        <OverflowTable>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="py-2 pr-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                                  Priorità
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
                        </OverflowTable>
                      </div>
                    </div>
                  </SettingSection>

                  <SaveButton
                    saveSettingsBusy={saveSettingsBusy}
                    isValid={settingsForm.formState.isValid}
                    isDirty={settingsForm.formState.isDirty}
                  />
                </form>
              </TabsContent>

              {/* --- Sicurezza --- */}
              <TabsContent value="sicurezza" className="mt-0">
                <form
                  onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)}
                  className="space-y-6"
                >
                  {successBanner && <div className="mb-4">{successBanner}</div>}
                  <SettingSection
                    icon={<Shield className="h-4 w-4" />}
                    title="Sicurezza e accessi"
                    description="Controlla registrazione utenti, approvazione account e obbligo MFA. Queste opzioni incidono direttamente sull'accesso al sistema."
                  >
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
                          <Shield className="size-4" /> Autenticazione a due fattori
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
                        <Label htmlFor="mfa_grace_period_days">
                          Periodo di grazia (giorni)
                        </Label>
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
                  </SettingSection>

                  <SaveButton
                    saveSettingsBusy={saveSettingsBusy}
                    isValid={settingsForm.formState.isValid}
                    isDirty={settingsForm.formState.isDirty}
                  />
                </form>
              </TabsContent>

              {/* --- Retention --- */}
              <TabsContent value="retention" className="mt-0">
                <form
                  onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)}
                  className="space-y-6"
                >
                  {successBanner && <div className="mb-4">{successBanner}</div>}
                  <SettingSection
                    icon={<DatabaseBackup className="size-4" />}
                    title="Audit e conservazione"
                    description="Definisce per quanto tempo conservare i log operativi prima dell'archiviazione."
                  >
                    <div className="space-y-3 rounded-lg border p-4 mt-4">
                      <div>
                        <h3 className="font-medium">Retention Log di Audit</h3>
                        <p className="text-sm text-muted-foreground">
                          Configura per quanti giorni mantenere i log di attività prima
                          dell&apos;archiviazione automatica.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          className="pc-input max-w-[200px]"
                          value={String(
                            (settingsForm.watch as any)("log_retention_days") ?? 365,
                          )}
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
                          I log più vecchi verranno spostati nell&apos;archivio
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <DatabaseBackup className="h-3 w-3" />
                        <span>
                          Log archiviati disponibili in sola lettura nella sezione Log
                        </span>
                      </div>
                    </div>
                  </SettingSection>

                  <SaveButton
                    saveSettingsBusy={saveSettingsBusy}
                    isValid={settingsForm.formState.isValid}
                    isDirty={settingsForm.formState.isDirty}
                  />
                </form>
              </TabsContent>

              {/* --- Template Email --- */}
              <TabsContent value="email-templates" className="mt-0">
                <div className="mb-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <p>
                    {tAdmin(
                      "settings.emailTemplates.description",
                      "Personalizza le email inviate automaticamente dal sistema: notifiche ticket, inviti utenti, alert SLA e report periodici. Se &egrave; la prima volta che accedi, usa &quot;Crea template di default&quot; per generare il template iniziale. Dopo la creazione, seleziona il template dal menu a tendina per modificarlo e usa &quot;Anteprima&quot; per visualizzarlo prima del salvataggio.",
                    )}
                  </p>
                </div>
                {accessToken ? (
                  <EmailTemplateSection
                    accessToken={accessToken}
                    adminEmail={userEmail}
                    organizationName={settings?.organization_name ?? "PCReady"}
                    supportEmail={settings?.support_email ?? ""}
                  />
                ) : null}
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-center py-4 text-muted-foreground">
              Errore nel caricamento delle impostazioni
            </p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
