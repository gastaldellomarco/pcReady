import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAdminExport } from "@/hooks/useAdminExport";
import { useAdminSettingsForm } from "@/hooks/useAdminSettingsForm";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { getAppSettings, updateAppSettings, type AppSettings } from "@/lib/app-settings";
import { exportAllData } from "@/lib/export-data";

/**
 *
 */
export function useAdminAppSettings(args: { accessToken: string | undefined; canManageSettings: boolean }) {
  const { accessToken, canManageSettings } = args;
  const loadSettings = useServerFn(getAppSettings);
  const saveSettings = useServerFn(updateAppSettings);
  const exportData = useServerFn(exportAllData);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const { settingsForm, submitSettings, saveSettingsBusy } = useAdminSettingsForm({
    accessToken,
    settings,
    saveSettings,
    onSettingsSaved: setSettings,
  });

  const { exportAllBusy, handleExportAllData } = useAdminExport({
    accessToken,
    exportData,
  });

  const loadAppSettings = useCallback(async () => {
    if (!accessToken || !canManageSettings) return;
    setLoadingSettings(true);
    try {
      const data = await loadSettings({ data: { accessToken } });
      setSettings(data);
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Impossibile caricare le impostazioni"));
    } finally {
      setLoadingSettings(false);
    }
  }, [accessToken, canManageSettings, loadSettings]);

  useEffect(() => {
    void loadAppSettings();
  }, [loadAppSettings]);

  return {
    settings,
    loadingSettings,
    settingsForm,
    submitSettings,
    saveSettingsBusy,
    exportAllBusy,
    handleExportAllData,
    loadAppSettings,
  };
}
