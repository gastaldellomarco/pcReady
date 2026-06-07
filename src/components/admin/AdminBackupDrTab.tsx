import { DatabaseBackup, Download, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackupMetric } from "@/components/admin/BackupMetric";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import type { AppSettings } from "@/lib/app-settings";

interface AdminBackupDrTabProps {
  settings: AppSettings | null;
  exportAllBusy: boolean;
  handleExportAllData: () => Promise<void>;
}

/**
 * Top-level admin tab: Backup & Disaster Recovery.
 * Shows backup policy metrics and manual data export.
 * Receives data from the parent admin page to avoid duplicate fetching.
 */
export function AdminBackupDrTab({ settings, exportAllBusy, handleExportAllData }: AdminBackupDrTabProps) {
  const { t } = useTranslation("admin");

  return (
    <TabsContent value="backup-dr" className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup className="size-5" />
            {t("settings.backup.title", "Backup & Disaster Recovery")}
          </CardTitle>
          <CardDescription>
            {t(
              "settings.backup.description",
              "Policy di protezione dati, continuità operativa ed export manuale.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <BackupMetric
              label={t("settings.backup.frequencyLabel", "Frequenza")}
              value={t("settings.backup.frequencyValue", "Giornaliero automatico")}
              detail={t("settings.backup.frequencyDetail", "Backup gestiti da Supabase")}
              readOnly
            />
            <BackupMetric
              label={t("settings.backup.retentionLabel", "Retention")}
              value={t("settings.backup.retentionValue", "30 giorni Pro / 7 giorni Free")}
              detail={t("settings.backup.retentionDetail", "In base al piano Supabase")}
              readOnly
            />
            <BackupMetric
              label={t("settings.backup.lastBackupLabel", "Ultimo backup")}
              value={t("settings.backup.lastBackupValue", "Gestito dal provider")}
              detail={t("settings.backup.lastBackupDetail", "Verificabile dalla dashboard Supabase")}
            />
            <BackupMetric
              label={t("settings.backup.rpoLabel", "RPO")}
              value={t("settings.backup.rpoValue", "< 24 ore")}
              detail={t("settings.backup.rpoDetail", "Per backup automatici giornalieri")}
              readOnly
            />
            <BackupMetric
              label={t("settings.backup.rtoLabel", "RTO")}
              value={t("settings.backup.rtoValue", "< 4 ore")}
              detail={t("settings.backup.rtoDetail", "Ripristino coordinato con il supporto")}
              readOnly
            />
            <BackupMetric
              label={t("settings.backup.emergencyLabel", "Emergenze")}
              value={settings?.support_email || t("settings.backup.emergencyNotConfigured", "Email supporto non configurata")}
              detail={t("settings.backup.emergencyDetail", "Contatto operativo per restore e incidenti")}
              readOnly
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">
                {t("settings.backup.exportTitle", "Export manuale dati")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(
                  "settings.backup.exportDescription",
                  "Scarica un archivio ZIP con CSV di ticket, dispositivi e clienti.",
                )}
              </p>
            </div>
            <Button onClick={handleExportAllData} disabled={exportAllBusy} variant="outline">
              <Download className="size-4 mr-2" />
              {exportAllBusy
                ? t("settings.backup.exportingButton", "Esportazione...")
                : t("settings.backup.exportButton", "Esporta tutti i dati")}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="size-3" />
            <span>
              {t("settings.backup.protectedText", "Dati protetti con backup giornalieri automatici")}
            </span>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
