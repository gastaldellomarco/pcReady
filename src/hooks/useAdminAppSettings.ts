import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { getAppSettings, updateAppSettings, type AppSettings } from "@/lib/app-settings";
import { exportAllData } from "@/lib/export-data";
import { useAdminSettingsForm } from "@/hooks/useAdminSettingsForm";
import { useAdminExport } from "@/hooks/useAdminExport";

export function useAdminAppSettings(args: { accessToken: string | undefined; isAdmin: boolean }) {
  const { accessToken, isAdmin } = args;
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
    if (!accessToken || !isAdmin) return;
    setLoadingSettings(true);
    try {
      const data = await loadSettings({ data: { accessToken } });
      setSettings(data);
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Impossibile caricare le impostazioni"));
    } finally {
      setLoadingSettings(false);
    }
  }, [accessToken, isAdmin, loadSettings]);

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
