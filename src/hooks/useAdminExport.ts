import { useState } from "react";
import { toast } from "sonner";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import { buildDownloadFileName, downloadZip } from "@/lib/downloads";
import type { ExportAllDataResult } from "@/lib/export-data";

type ExportServerFn = (opts: { data: { accessToken: string } }) => Promise<ExportAllDataResult>;

/**
 *
 */
export function useAdminExport(args: {
  accessToken: string | undefined;
  exportData: ExportServerFn;
}) {
  const { accessToken, exportData } = args;
  const [exportAllBusy, setExportAllBusy] = useState(false);

  async function handleExportAllData() {
    if (!accessToken) return;
    setExportAllBusy(true);
    try {
      const data = await exportData({ data: { accessToken } });
      const files = Object.values(data.files);
      downloadZip(
        files.map((file) => ({
          name: file.filename,
          content: file.csv,
        })),
        buildDownloadFileName("pcready-full-export", "zip", { dated: true }),
      );
      toast.success("Export completo generato");
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Export dati non riuscito"));
    } finally {
      setExportAllBusy(false);
    }
  }

  return { exportAllBusy, handleExportAllData };
}
