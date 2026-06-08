import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import DOMPurify from "dompurify";
import {
  Plus,
  FileDown,
  QrCode,
  Upload,
  ScanLine,
  Printer,
  TicketPlus,
  ClipboardList,
  CheckCircle2,
  Columns3,
  X,
  CalendarDays,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ExportPdf } from "@/components/ExportPdf";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { ImportCsvDialog } from "@/components/inventory/ImportCsvDialog";
import { QrCodeDialog, type QrDevice } from "@/components/inventory/QrCodeDialog";
import { TableSkeletonRows, PageFetchError } from "@/components/page-states";
import { Modal } from "@/components/pcready/Modal";
import { downloadPdf, InventoryPdf } from "@/components/pcready/pdf/dynamic";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTickets } from "@/hooks/use-tickets";
import { useVirtualList } from "@/hooks/useVirtualList";
import { supabase } from "@/integrations/supabase/client";
import { getPublicAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { pcReadyColors } from "@/lib/design-system";
import { openDeviceDetail } from "@/lib/detail-navigation";
import {
  DEVICE_CATEGORIES,
  DEVICE_CATEGORY_LABELS,
  getDeviceCategoryLabel,
  getDeviceTypes,
  type DeviceCategory,
} from "@/lib/device-taxonomy";
import { buildDownloadFileName } from "@/lib/downloads";
import { errorMessage } from "@/lib/errors";
import { buildLabelItems, printLabelBatch } from "@/lib/inventory-labels";
import {
  MAINTENANCE_RECURRENCE_LABEL,
  fetchMaintenanceCalendar,
  fetchTechnicianOptions,
  getMaintenanceStatus,
  MAINTENANCE_STATUS_META,
  todayIsoDate,
  type MaintenanceSchedule,
  type MaintenanceStatus,
  type TechnicianOption,
} from "@/lib/maintenance";
import { OS_OPTIONS, fmtDate } from "@/lib/pcready";
import queries, {
  useInventoryInfiniteList,
  fetchAllDevicesList,
  fetchAllAssignedDeviceIds,
} from "@/lib/queries/inventory";
import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";
import {
  daysUntil,
  getWarrantyStatus,
  WARRANTY_STATUS_META,
  type WarrantyFilter,
} from "@/lib/warranty";

import type { DevicePdfRow } from "@/components/pcready/pdf/InventoryPdf";

export const Route = createLazyFileRoute("/_app/inventory")({
  component: InventoryPage,
});

interface Row {
  id: string;
  asset_tag: string;
  serial: string | null;
  model: string;
  os: string | null;
  category: string | null;
  device_type: string | null;
  status: DeviceStatus;
  client_id: string;
  client?: { name: string } | null;
  updated_at: string;
  assigned_to: string | null;
  purchase_date: string | null;
  warranty_expiry_date: string | null;
  warranty_type: string | null;
  warranty_provider: string | null;
  warranty_notes: string | null;
  has_active_assignment?: boolean;
  has_maintenance_due_soon?: boolean;
  next_maintenance_due_date?: string | null;
}

type CompareDevice = Row & {
  brand: string | null;
  device_type: string | null;
  cpu_name: string | null;
  cpu_frequency_ghz: number | null;
  cpu_cores: number | null;
  ram_gb: number | null;
  ram_type: string | null;
  ram_frequency_mhz: number | null;
  storage_type: string | null;
  storage_capacity_gb: number | null;
  storage_drive_count: number | null;
  os_version: string | null;
  os_architecture: string | null;
  screen_resolution: string | null;
  screen_size_inches: number | null;
  screen_type: string | null;
  wifi: string | null;
  ethernet: string | null;
  bluetooth: string | null;
};

type DeviceStatus = "available" | "assigned" | "maintenance" | "retired";

const DEVICE_STATUS_META: Record<DeviceStatus, { label: string; color: string }> = {
  available: { label: "Disponibile", color: pcReadyColors.success },
  assigned: { label: "Assegnato", color: pcReadyColors.primary },
  maintenance: { label: "Manutenzione", color: pcReadyColors.warning },
  retired: { label: "Dismesso", color: pcReadyColors.textSecondary },
};

const PAGE_SIZE = LIST_PAGE_SIZE;

function toPdfRow(r: Row): DevicePdfRow {
  return {
    id: r.id,
    asset_tag: r.asset_tag,
    serial: r.serial,
    model: r.model,
    category: r.category,
    device_type: r.device_type,
    os: r.os,
    status: r.status,
    client: r.client?.name || "-",
    assigned_to: r.assigned_to,
    updated_at: r.updated_at,
    purchase_date: r.purchase_date,
    warranty_expiry_date: r.warranty_expiry_date,
    warranty_type: r.warranty_type,
    warranty_provider: r.warranty_provider,
    warranty_notes: r.warranty_notes,
  };
}

function InventoryPage() {
  const { t } = useTranslation("inventory");
  const { openAddDevice, openCreate } = useTickets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const loadSettings = useServerFn(getPublicAppSettings);
  const [rows, setRows] = useState<Row[]>([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [fs, setFs] = useState("");
  const [fos, setFos] = useState("");
  const [fcategory, setFcategory] = useState("");
  const [ftype, setFtype] = useState("");
  const [q, setQ] = useState("");
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [qrDevice, setQrDevice] = useState<QrDevice | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [labelsBusy, setLabelsBusy] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [osOptions, setOsOptions] = useState<string[]>(OS_OPTIONS);
  const [withoutTicketFilter] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("filter") === "without_ticket";
  });
  const [updatedBeforeDays, setUpdatedBeforeDays] = useState<number | null>(null);
  const [maintenanceDueFilter, setMaintenanceDueFilter] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [warrantyFilter, setWarrantyFilter] = useState<WarrantyFilter>(() => {
    if (typeof window === "undefined") return "all";
    const value = new URLSearchParams(window.location.search).get(
      "warranty",
    ) as WarrantyFilter | null;
    return value && ["valid", "expiring", "urgent", "expired", "missing"].includes(value)
      ? value
      : "all";
  });
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkClientOpen, setBulkClientOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<DeviceStatus>("available");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTargetClientName, setBulkTargetClientName] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareRows, setCompareRows] = useState<CompareDevice[]>([]);
  const listQuery = useInventoryInfiniteList({
    status: fs || undefined,
    os: fos || undefined,
    category: fcategory || undefined,
    deviceType: ftype || undefined,
    q,
    pageSize: PAGE_SIZE,
    withoutTicket: withoutTicketFilter,
    warrantyStatus: warrantyFilter,
    maintenanceDueSoon: maintenanceDueFilter,
    updatedBefore: updatedBeforeDays
      ? new Date(Date.now() - updatedBeforeDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  });

  const total = useMemo(() => listQuery.data?.pages?.[0]?.count ?? 0, [listQuery.data]);
  const {
    containerRef: tableContainerRef,
    virtualizer: rowVirtualizer,
    virtualItems,
    totalSize: virtualTotalSize,
  } = useVirtualList({
    count: rows.length,
    estimateSize: 40,
    overscan: 15,
    threshold: 50,
  });
  const {
    containerRef: mobileContainerRef,
    virtualizer: mobileVirtualizer,
    virtualItems: mobileVirtualItems,
    totalSize: mobileVirtualTotalSize,
  } = useVirtualList({
    count: rows.length,
    estimateSize: 212,
    overscan: 5,
    threshold: 20,
  });

  useEffect(() => {
    if (!session?.access_token) return;
    loadSettings({ data: { accessToken: session.access_token } })
      .then((settings) =>
        setOsOptions(settings.os_options.length ? settings.os_options : OS_OPTIONS),
      )
      .catch(() => setOsOptions(OS_OPTIONS));
  }, [loadSettings, session?.access_token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const detailDeviceId = params.get("device");
    if (detailDeviceId) openDeviceDetail(detailDeviceId);
  }, []);

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.pages.flatMap((p) => p.data) as Row[]);
    }
  }, [listQuery.data]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !listQuery.hasNextPage || listQuery.isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void listQuery.fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [listQuery.hasNextPage, listQuery.isFetchingNextPage, listQuery.fetchNextPage, view]);

  useEffect(() => {
    setFtype("");
  }, [fcategory]);

  const data = rows;
  const listLoading = listQuery.isLoading;
  const isFetchingMore = listQuery.isFetchingNextPage;
  const loadedCount = data.length;
  const selectedRows = data.filter((row) => selectedIds.has(row.id));
  const allPageSelected = data.length > 0 && data.every((row) => selectedIds.has(row.id));

  // virtualItems, virtualTotalSize, mobileVirtualItems, mobileVirtualTotalSize are from useVirtualList hooks

  const activeFilterRecord: Record<string, any> = {
    status: fs || undefined,
    os: fos || undefined,
    category: fcategory || undefined,
    deviceType: ftype || undefined,
    q: q || undefined,
    warrantyStatus: warrantyFilter,
    maintenanceDueSoon: maintenanceDueFilter,
    withoutTicket: withoutTicketFilter || undefined,
    updatedBefore: updatedBeforeDays
      ? new Date(Date.now() - updatedBeforeDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  };

  const filterSummary = useMemo(() => {
    const lines: string[] = [];
    if (fs)
      lines.push(
        `Stato: ${t("status." + fs, DEVICE_STATUS_META[fs as DeviceStatus]?.label || fs)}`,
      );
    if (fos) lines.push(`OS: ${fos}`);
    if (fcategory) lines.push(`Categoria: ${getDeviceCategoryLabel(fcategory)}`);
    if (ftype) lines.push(`Tipo: ${ftype}`);
    if (warrantyFilter !== "all")
      lines.push(
        `Garanzia: ${t("filters.warranty" + warrantyFilter.charAt(0).toUpperCase() + warrantyFilter.slice(1), warrantyFilter)}`,
      );
    if (maintenanceDueFilter) lines.push(t("filters.maintenanceDue30d"));
    if (withoutTicketFilter) lines.push(t("filters.withoutTicket", "Senza ticket"));
    if (updatedBeforeDays) lines.push(t("filters.notUpdatedX", { days: updatedBeforeDays }));
    if (q) lines.push(`Ricerca: "${q}"`);
    return lines.length ? lines : [`Nessun filtro attivo per dispositivo`];
  }, [
    fs,
    fos,
    fcategory,
    ftype,
    warrantyFilter,
    maintenanceDueFilter,
    withoutTicketFilter,
    updatedBeforeDays,
    q,
    t,
  ]);

  function pdfRows(): DevicePdfRow[] {
    return data.map((r) => ({
      id: r.id,
      asset_tag: r.asset_tag,
      serial: r.serial,
      model: r.model,
      category: r.category,
      device_type: r.device_type,
      os: r.os,
      status: r.status,
      client: r.client?.name || "-",
      assigned_to: r.assigned_to,
      updated_at: r.updated_at,
      purchase_date: r.purchase_date,
      warranty_expiry_date: r.warranty_expiry_date,
      warranty_type: r.warranty_type,
      warranty_provider: r.warranty_provider,
      warranty_notes: r.warranty_notes,
    }));
  }

  async function exportPdfSuccess() {
    toast.success(t("toast.pdfExported"));
  }

  function exportPdfError(err: Error) {
    toast.error(errorMessage(err, t("toast.pdfExportError")));
  }

  async function printSelectedLabels() {
    if (!selectedRows.length) return toast.error(t("toast.selectAtLeastOneDevice"));
    setLabelsBusy(true);
    try {
      const items = await buildLabelItems(selectedRows.map(toQrDevice));
      printLabelBatch(items);
    } catch (error) {
      toast.error(errorMessage(error, t("toast.labelPrintError")));
    } finally {
      setLabelsBusy(false);
    }
  }

  async function handleDetected(rawCode: string) {
    setScannerOpen(false);
    const code = extractDeviceCode(rawCode);
    const idFromUrl = extractDeviceId(rawCode);

    if (idFromUrl) {
      openDeviceDetail(idFromUrl);
      return;
    }
    try {
      const { fetchDeviceBySerial } = queries as any;
      const found = await fetchDeviceBySerial(code);
      if (found?.id) {
        openDeviceDetail(found.id);
        return;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("toast.deviceSearchError"));
      return;
    }

    setQ(code);
    toast(t("toast.deviceNotFound"), {
      description: t("toast.serialDetected", { code }),
      action: {
        label: t("toast.create"),
        onClick: () => openAddDevice(code),
      },
    });
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePageSelected(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of data) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleStatusChange(deviceId: string, newStatus: DeviceStatus) {
    const row = data.find((r) => r.id === deviceId);
    if (!row || row.status === newStatus) return;
    if (row.has_active_assignment && row.status === "assigned") return;

    setStatusSavingId(deviceId);
    try {
      const { data: updated, error } = await supabase
        .from("devices")
        .update({ status: newStatus })
        .eq("id", deviceId)
        .select("status, updated_at")
        .single();
      if (error) throw error;
      const nextStatus = (updated?.status ?? newStatus) as DeviceStatus;
      setRows((prev) =>
        prev.map((r) =>
          r.id === deviceId
            ? {
                ...r,
                status: nextStatus,
                updated_at: updated?.updated_at ?? r.updated_at,
              }
            : r,
        ),
      );
      toast.success(
        t("toast.statusUpdated", {
          status: t("status." + nextStatus, DEVICE_STATUS_META[nextStatus].label),
        }),
      );
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    } catch (error) {
      toast.error(errorMessage(error, t("toast.statusUpdateError")));
    } finally {
      setStatusSavingId(null);
    }
  }

  async function handleBulkStatusChange() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    let success = 0;
    let fail = 0;
    for (const deviceId of ids) {
      try {
        const { error } = await supabase
          .from("devices")
          .update({ status: bulkTargetStatus })
          .eq("id", deviceId);
        if (error) throw error;
        success++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    setBulkStatusOpen(false);
    setSelectedIds(new Set());
    void qc.invalidateQueries({ queryKey: ["inventory"] });
    toast.success(
      t("toast.bulkStatusUpdated", {
        success,
        failMsg: fail ? t("toast.bulkStatusUpdatedFail", { fail }) : "",
      }),
    );
  }

  async function openCompareDevices() {
    const ids = [...selectedIds];
    if (ids.length < 2 || ids.length > 3) return toast.error(t("toast.selectTwoOrThree"));
    setCompareBusy(true);
    try {
      const { data: rows, error } = await supabase
        .from("devices")
        .select(
          "id, asset_tag, serial, brand, model, category, device_type, os, status, client_id, updated_at, assigned_to, purchase_date, warranty_expiry_date, warranty_type, warranty_provider, warranty_notes, cpu_name, cpu_frequency_ghz, cpu_cores, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count, os_version, os_architecture, screen_resolution, screen_size_inches, screen_type, wifi, ethernet, bluetooth, client:clients(name)",
        )
        .in("id", ids);
      if (error) throw error;
      setCompareRows((rows ?? []) as CompareDevice[]);
      setCompareOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, t("toast.compareError")));
    } finally {
      setCompareBusy(false);
    }
  }

  async function handleBulkAssignClient() {
    const ids = [...selectedIds];
    if (!ids.length || !bulkTargetClientName) return;
    setBulkBusy(true);
    let success = 0;
    let fail = 0;
    for (const deviceId of ids) {
      try {
        const { error } = await supabase
          .from("devices")
          .update({ assigned_to: bulkTargetClientName })
          .eq("id", deviceId);
        if (error) throw error;
        success++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    setBulkClientOpen(false);
    setBulkTargetClientName("");
    setSelectedIds(new Set());
    void qc.invalidateQueries({ queryKey: ["inventory"] });
    toast.success(
      t("toast.bulkStatusUpdated", {
        success,
        failMsg: fail ? t("toast.bulkStatusUpdatedFail", { fail }) : "",
      }),
    );
  }

  async function exportSelectedPdf() {
    if (!selectedRows.length) return toast.error(t("toast.noDeviceSelected"));
    setPdfBusy("download");
    try {
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      const org = settings?.organization_name;
      await downloadPdf(
        <InventoryPdf rows={selectedRows.map(toPdfRow)} organizationName={org} />,
        buildDownloadFileName("pcready-inventario-selezionati", "pdf", { dated: true }),
      );
      toast.success(t("toast.pdfSimpleExported"));
    } catch (error) {
      toast.error(errorMessage(error, t("toast.pdfExportError")));
    } finally {
      setPdfBusy(null);
    }
  }

  async function exportWarrantyPdf() {
    if (!data.length) return toast.error(t("toast.noDevicesToExport"));
    setPdfBusy("download");
    try {
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      await downloadPdf(
        <InventoryPdf
          rows={pdfRows()}
          organizationName={settings?.organization_name}
          variant="warranty"
        />,
        buildDownloadFileName("pcready-report-garanzie", "pdf", { dated: true }),
      );
      toast.success(t("toast.warrantyReportExported"));
    } catch (error) {
      toast.error(errorMessage(error, t("toast.warrantyReportError")));
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <select
          aria-label={t("filters.statusLabel", "Filtra per stato")}
          className="pc-input lg:max-w-[160px]"
          value={fs}
          onChange={(e) => setFs(e.target.value)}
        >
          <option value="">{t("filters.allStates")}</option>
          {Object.entries(DEVICE_STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {t("status." + k, v.label)}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filters.osLabel", "Filtra per sistema operativo")}
          className="pc-input lg:max-w-[200px]"
          value={fos}
          onChange={(e) => setFos(e.target.value)}
        >
          <option value="">{t("filters.allOs")}</option>
          {osOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select
          aria-label={t("filters.categoryLabel", "Filtra per categoria")}
          className="pc-input lg:max-w-[190px]"
          value={fcategory}
          onChange={(e) => setFcategory(e.target.value)}
        >
          <option value="">{t("filters.allCategories")}</option>
          {DEVICE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DEVICE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
        <select
          aria-label={t("filters.typeLabel", "Filtra per tipo dispositivo")}
          className="pc-input lg:max-w-[190px]"
          value={ftype}
          onChange={(e) => setFtype(e.target.value)}
        >
          <option value="">{t("filters.allTypes")}</option>
          {(fcategory
            ? getDeviceTypes(fcategory as DeviceCategory)
            : DEVICE_CATEGORIES.flatMap((category) => getDeviceTypes(category))
          ).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          aria-label={t("filters.searchLabel", "Cerca dispositivo")}
          className="pc-input lg:max-w-[260px]"
          placeholder={t("filters.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label={t("filters.updatedLabel", "Filtra per data aggiornamento")}
          className="pc-input lg:max-w-[210px]"
          value={updatedBeforeDays ?? ""}
          onChange={(e) => setUpdatedBeforeDays(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{t("filters.allDates")}</option>
          <option value="7">{t("filters.notUpdated7")}</option>
          <option value="14">{t("filters.notUpdated14")}</option>
          <option value="30">{t("filters.notUpdated30")}</option>
          <option value="60">{t("filters.notUpdated60")}</option>
        </select>
        <select
          aria-label={t("filters.warrantyLabel", "Filtra per stato garanzia")}
          className="pc-input lg:max-w-[190px]"
          value={warrantyFilter}
          onChange={(e) => setWarrantyFilter(e.target.value as WarrantyFilter)}
        >
          <option value="all">{t("filters.allWarranties")}</option>
          <option value="valid">{t("filters.warrantyValid")}</option>
          <option value="expiring">{t("filters.warrantyExpiring")}</option>
          <option value="urgent">{t("filters.warrantyUrgent")}</option>
          <option value="expired">{t("filters.warrantyExpired")}</option>
          <option value="missing">{t("filters.warrantyMissing")}</option>
        </select>
        <button
          type="button"
          className={`pc-btn pc-btn-sm ${maintenanceDueFilter ? "pc-btn-primary" : "pc-btn-ghost"}`}
          onClick={() => setMaintenanceDueFilter((value) => !value)}
          title={t("filters.maintenanceDueTooltip")}
        >
          <Wrench className="size-3" /> {t("filters.maintenanceDue30d")}
        </button>
        <div
          className="grid grid-cols-2 rounded-lg border sm:col-span-2 lg:flex"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            className={`pc-btn pc-btn-sm ${view === "list" ? "pc-btn-primary" : "pc-btn-ghost"}`}
            onClick={() => setView("list")}
          >
            {t("viewToggle.list")}
          </button>
          <button
            type="button"
            className={`pc-btn pc-btn-sm ${view === "calendar" ? "pc-btn-primary" : "pc-btn-ghost"}`}
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="size-3" /> {t("viewToggle.calendar")}
          </button>
        </div>
        <span className="self-center text-xs text-text3 font-mono lg:ml-auto">
          {total ? t("counts.range", { from: 1, to: loadedCount, total }) : t("counts.zeroDevices")}
        </span>
        <button
          onClick={() => setExportModalOpen(true)}
          disabled={!data.length}
          className="pc-btn pc-btn-ghost pc-btn-sm"
        >
          <FileDown className="size-3" />
          {t("actions.exportPdf")}
        </button>
        <button
          onClick={exportWarrantyPdf}
          disabled={!!pdfBusy}
          className="pc-btn pc-btn-ghost pc-btn-sm"
        >
          <FileDown className="size-3" /> {t("actions.warrantyReport")}
        </button>
        <button
          onClick={printSelectedLabels}
          disabled={labelsBusy || !selectedRows.length}
          className="pc-btn pc-btn-ghost pc-btn-sm"
        >
          <Printer className="size-3" />
          {labelsBusy
            ? t("actions.preparing")
            : `${t("actions.printLabels")}${selectedRows.length ? ` (${selectedRows.length})` : ""}`}
        </button>
        <button onClick={() => setScannerOpen(true)} className="pc-btn pc-btn-ghost pc-btn-sm">
          <ScanLine className="size-3" /> {t("actions.scan")}
        </button>
        <button onClick={() => setImportOpen(true)} className="pc-btn pc-btn-ghost pc-btn-sm">
          <Upload className="size-3" /> {t("actions.importCsv")}
        </button>
        <button onClick={() => openAddDevice()} className="pc-btn pc-btn-primary pc-btn-sm">
          <Plus className="size-3" /> {t("actions.addDevice")}
        </button>
      </div>
      {selectedIds.size > 0 && (
        <div
          className="grid grid-cols-2 items-center gap-2 rounded-lg px-3 py-2 sm:flex sm:flex-wrap"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <span className="text-[12px] font-semibold text-text3 font-mono mr-1">
            {t("counts.selected", { count: selectedIds.size })}
            {data.length > selectedIds.size ? (
              <button
                className="text-accent hover:underline text-[11px] ml-1"
                onClick={() => setSelectedIds(new Set(data.map((r) => r.id)))}
              >
                {t("counts.selectPage")}
              </button>
            ) : null}
          </span>
          <div className="hidden flex-1 sm:block" />
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={bulkBusy}
            onClick={() => setBulkStatusOpen(true)}
          >
            <CheckCircle2 className="size-3" />
            {t("actions.changeStatus")}
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={!!pdfBusy}
            onClick={exportSelectedPdf}
          >
            <FileDown className="size-3" />
            {t("actions.exportSelected")}
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={compareBusy || selectedIds.size < 2 || selectedIds.size > 3}
            onClick={openCompareDevices}
          >
            <Columns3 className="size-3" />
            {t("actions.compare")}
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={bulkBusy}
            onClick={() => setBulkClientOpen(true)}
          >
            <ClipboardList className="size-3" />
            {t("actions.assignUser")}
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm text-destructive"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="size-3" />
            {t("actions.deselect")}
          </button>
        </div>
      )}
      {view === "calendar" ? (
        <MaintenanceCalendarView onOpenDevice={openDeviceDetail} />
      ) : listQuery.isError ? (
        <PageFetchError message={t("error.pageFetch")} onRetry={() => listQuery.refetch()} />
      ) : (
        <>
          <div
            ref={mobileContainerRef}
            className="md:hidden"
            style={{
              maxHeight: data.length > 20 ? "calc(100vh - 200px)" : undefined,
              overflow: data.length > 20 ? "auto" : undefined,
            }}
          >
            {listLoading ? (
              <div className="pc-card pc-card-body text-sm text-text3">
                {t("loading.inventory")}
              </div>
            ) : !data.length ? (
              <div className="pc-card pc-card-body text-center text-sm text-text3">
                { }
                <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t("empty.mobile")) }} />
              </div>
            ) : data.length > 20 ? (
              <div style={{ position: "relative", height: mobileVirtualTotalSize }}>
                {mobileVirtualItems.map((virtualItem) => {
                  const r = data[virtualItem.index];
                  return (
                    <div
                      key={r.id}
                      ref={mobileVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        transform: `translateY(${virtualItem.start}px)`,
                        left: 0,
                        right: 0,
                        marginBottom: "12px",
                      }}
                    >
                      <DeviceMobileCard
                        row={r}
                        selected={selectedIds.has(r.id)}
                        saving={statusSavingId === r.id}
                        onOpen={() => openDeviceDetail(r.id)}
                        onSelect={(checked) => toggleSelected(r.id, checked)}
                        onStatusChange={handleStatusChange}
                        onCreateTicket={() => {
                          openDeviceDetail(r.id);
                          setTimeout(() => openCreate(), 200);
                        }}
                        onQr={() => setQrDevice(toQrDevice(r))}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.map((r) => (
                  <DeviceMobileCard
                    key={r.id}
                    row={r}
                    selected={selectedIds.has(r.id)}
                    saving={statusSavingId === r.id}
                    onOpen={() => openDeviceDetail(r.id)}
                    onSelect={(checked) => toggleSelected(r.id, checked)}
                    onStatusChange={handleStatusChange}
                    onCreateTicket={() => {
                      openDeviceDetail(r.id);
                      setTimeout(() => openCreate(), 200);
                    }}
                    onQr={() => setQrDevice(toQrDevice(r))}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="pc-card hidden overflow-hidden md:block">
            <div
              ref={tableContainerRef}
              className="overflow-x-auto"
              style={{
                maxHeight: "calc(100vh - 180px)",
                overflow: "auto",
              }}
            >
              <table className="w-full min-w-[1180px]">
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    <th
                      className="w-10 px-[14px] py-[9px] text-left border-b"
                      style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    >
                      <input
                        type="checkbox"
                        aria-label={t("ariaLabels.selectPage")}
                        checked={allPageSelected}
                        onChange={(event) => togglePageSelected(event.target.checked)}
                      />
                    </th>
                    {[
                      t("columns.assetTag", "Asset tag"),
                      t("columns.serial", "Seriale produttore"),
                      t("columns.model", "Modello"),
                      t("columns.category", "Categoria"),
                      t("columns.deviceType", "Tipo"),
                      t("columns.os", "OS"),
                      t("columns.status", "Stato"),
                      t("columns.warranty", "Garanzia"),
                      t("columns.client", "Cliente"),
                      t("columns.user", "Utente"),
                      t("columns.updated", "Aggiornato"),
                      t("columns.actions", "Azioni"),
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <TableSkeletonRows rows={12} columns={13} cellClassName="px-[14px] py-[10px]" />
                  ) : !data.length ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-text3 text-sm">
                        { }
                        <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t("empty.desktop")) }} />
                      </td>
                    </tr>
                  ) : data.length > 50 ? (
                    <>
                      {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                        <tr style={{ height: virtualItems[0].start, visibility: "hidden" }}>
                          <td colSpan={13} />
                        </tr>
                      )}
                      {virtualItems.map((virtualItem) => {
                        const r = data[virtualItem.index];
                        return (
                          <tr
                            key={r.id}
                            ref={rowVirtualizer.measureElement}
                            className="border-b hover:bg-surface2 transition-colors cursor-pointer"
                            style={{ borderColor: "var(--border)" }}
                            onClick={() => openDeviceDetail(r.id)}
                          >
                            <td
                              className="px-[14px] py-[10px]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                aria-label={t("ariaLabels.selectDevice", {
                                  name: r.serial || r.id,
                                })}
                                checked={selectedIds.has(r.id)}
                                onChange={(event) => toggleSelected(r.id, event.target.checked)}
                              />
                            </td>
                            <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">
                              {r.asset_tag || r.id.slice(0, 8)}
                            </td>
                            <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                              {r.serial || "-"}
                            </td>
                            <td className="px-[14px] py-[10px] text-[12.5px]">
                              <div>{r.model}</div>
                              {r.has_maintenance_due_soon ? (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  <Wrench className="size-3" /> {t("maintenance.dueSoon")}{" "}
                                  {r.next_maintenance_due_date
                                    ? fmtDate(r.next_maintenance_due_date)
                                    : t("maintenance.expiring")}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-[14px] py-[10px] text-[12px] text-text2">
                              {getDeviceCategoryLabel(r.category)}
                            </td>
                            <td className="px-[14px] py-[10px] text-[12px] text-text2">
                              {r.device_type || "-"}
                            </td>
                            <td className="px-[14px] py-[10px] text-[12px] text-text2">
                              {r.os || "-"}
                            </td>
                            <td
                              className="px-[14px] py-[10px]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <DeviceStatusBadge
                                deviceId={r.id}
                                status={r.status}
                                hasActiveAssignment={!!r.has_active_assignment}
                                saving={statusSavingId === r.id}
                                onStatusChange={handleStatusChange}
                              />
                            </td>
                            <td className="px-[14px] py-[10px]">
                              <WarrantyBadge expiryDate={r.warranty_expiry_date} />
                            </td>
                            <td className="px-[14px] py-[10px] text-[12px]">
                              {r.client?.name || "-"}
                            </td>
                            <td className="px-[14px] py-[10px] text-[12px]">
                              {r.assigned_to || "-"}
                            </td>
                            <td
                              className="px-[14px] py-[10px] text-[11px] text-text3"
                              title={r.updated_at}
                            >
                              {fmtDate(r.updated_at)}
                            </td>
                            <td
                              className="px-[14px] py-[10px]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex items-center gap-1">
                                <button
                                  className="pc-btn-icon touch-target"
                                  title={t("actions.createTicket")}
                                  aria-label={t("ariaLabels.createTicketFor", {
                                    name: r.serial || r.id,
                                  })}
                                  onClick={() => {
                                    openDeviceDetail(r.id);
                                    setTimeout(() => openCreate(), 200);
                                  }}
                                >
                                  <TicketPlus className="size-3.5" />
                                </button>
                                <button
                                  className="pc-btn-icon touch-target"
                                  title={t("actions.qr")}
                                  aria-label={t("ariaLabels.qrDevice", { name: r.serial || r.id })}
                                  onClick={() => setQrDevice(toQrDevice(r))}
                                >
                                  <QrCode className="size-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {virtualItems.length > 0 &&
                        (() => {
                          const lastItem = virtualItems[virtualItems.length - 1];
                          const bottomHeight = virtualTotalSize - lastItem.start - lastItem.size;
                          return bottomHeight > 0 ? (
                            <tr style={{ height: bottomHeight, visibility: "hidden" }}>
                              <td colSpan={13} />
                            </tr>
                          ) : null;
                        })()}
                    </>
                  ) : (
                    data.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b hover:bg-surface2 transition-colors cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => openDeviceDetail(r.id)}
                      >
                        <td
                          className="px-[14px] py-[10px]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={t("ariaLabels.selectDevice", { name: r.serial || r.id })}
                            checked={selectedIds.has(r.id)}
                            onChange={(event) => toggleSelected(r.id, event.target.checked)}
                          />
                        </td>
                        <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">
                          {r.asset_tag || r.id.slice(0, 8)}
                        </td>
                        <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                          {r.serial || "-"}
                        </td>
                        <td className="px-[14px] py-[10px] text-[12.5px]">
                          <div>{r.model}</div>
                          {r.has_maintenance_due_soon ? (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Wrench className="size-3" /> {t("maintenance.dueSoon")}{" "}
                              {r.next_maintenance_due_date
                                ? fmtDate(r.next_maintenance_due_date)
                                : t("maintenance.expiring")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-[14px] py-[10px] text-[12px] text-text2">
                          {getDeviceCategoryLabel(r.category)}
                        </td>
                        <td className="px-[14px] py-[10px] text-[12px] text-text2">
                          {r.device_type || "-"}
                        </td>
                        <td className="px-[14px] py-[10px] text-[12px] text-text2">
                          {r.os || "-"}
                        </td>
                        <td
                          className="px-[14px] py-[10px]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DeviceStatusBadge
                            deviceId={r.id}
                            status={r.status}
                            hasActiveAssignment={!!r.has_active_assignment}
                            saving={statusSavingId === r.id}
                            onStatusChange={handleStatusChange}
                          />
                        </td>
                        <td className="px-[14px] py-[10px]">
                          <WarrantyBadge expiryDate={r.warranty_expiry_date} />
                        </td>
                        <td className="px-[14px] py-[10px] text-[12px]">{r.client?.name || "-"}</td>
                        <td className="px-[14px] py-[10px] text-[12px]">{r.assigned_to || "-"}</td>
                        <td
                          className="px-[14px] py-[10px] text-[11px] text-text3"
                          title={r.updated_at}
                        >
                          {fmtDate(r.updated_at)}
                        </td>
                        <td
                          className="px-[14px] py-[10px]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              className="pc-btn-icon touch-target"
                              title={t("actions.createTicket")}
                              aria-label={t("ariaLabels.createTicketFor", {
                                name: r.serial || r.id,
                              })}
                              onClick={() => {
                                openDeviceDetail(r.id);
                                setTimeout(() => openCreate(), 200);
                              }}
                            >
                              <TicketPlus className="size-3.5" />
                            </button>
                            <button
                              className="pc-btn-icon touch-target"
                              title={t("actions.qr")}
                              aria-label={t("ariaLabels.qrDevice", { name: r.serial || r.id })}
                              onClick={() => setQrDevice(toQrDevice(r))}
                            >
                              <QrCode className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {view === "list" && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-3">
          {isFetchingMore && (
            <span className="text-sm text-text3">{t("loading.more", "Caricamento altri...")}</span>
          )}
          {!listQuery.hasNextPage && loadedCount > 0 && (
            <span className="text-xs text-text3 font-mono">
              {t("counts.allLoaded", {
                count: loadedCount,
                total,
                defaultValue: "Tutti {{count}} di {{total}} caricati",
              })}
            </span>
          )}
        </div>
      )}
      <QrCodeDialog device={qrDevice} onClose={() => setQrDevice(null)} />
      <ImportCsvDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setSelectedIds(new Set());
          qc.invalidateQueries({ queryKey: ["inventory"] });
        }}
      />
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => void handleDetected(code)}
      />
      <CompareDevicesModal
        open={compareOpen}
        rows={compareRows}
        onClose={() => setCompareOpen(false)}
      />

      <AlertDialog
        open={bulkStatusOpen}
        onOpenChange={(open) => {
          setBulkStatusOpen(open);
          if (!open) setBulkTargetStatus("available");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkStatus.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulkStatus.description", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <select
            aria-label={t("bulkStatus.statusLabel", "Nuovo stato")}
            className="pc-input w-full"
            value={bulkTargetStatus}
            onChange={(e) => setBulkTargetStatus(e.target.value as DeviceStatus)}
          >
            {Object.entries(DEVICE_STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>
                {t("status." + k, v.label)}
              </option>
            ))}
          </select>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction type="button" disabled={bulkBusy} onClick={handleBulkStatusChange}>
              {bulkBusy ? t("actions.updating") : t("actions.applyTo", { count: selectedIds.size })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkClientOpen}
        onOpenChange={(open) => {
          setBulkClientOpen(open);
          if (!open) setBulkTargetClientName("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bulkClient.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bulkClient.description", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            aria-label={t("bulkClient.clientLabel", "Nome cliente")}
            className="pc-input w-full"
            placeholder={t("bulkClient.placeholder")}
            value={bulkTargetClientName}
            onChange={(e) => setBulkTargetClientName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={bulkBusy || !bulkTargetClientName.trim()}
              onClick={handleBulkAssignClient}
            >
              {bulkBusy ? t("actions.updating") : t("actions.applyTo", { count: selectedIds.size })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportPdf<Row, DevicePdfRow>
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        entityLabel="dispositivo"
        renderPdf={async (rows, orgName) => {
          const { InventoryPdf: Ip } = await import("@/components/pcready/pdf/InventoryPdf");
          return <Ip rows={rows} organizationName={orgName} />;
        }}
        mapRow={toPdfRow}
        fileName={buildDownloadFileName("pcready-inventario", "pdf", { dated: true })}
        fetchAll={async (filters) => {
          const params: any = { ...filters };
          if (filters.withoutTicket) {
            params.assignedIdsForFilter = await fetchAllAssignedDeviceIds();
          }
          const result = await fetchAllDevicesList(params);
          return result as unknown as { data: Row[]; count: number };
        }}
        currentPageRows={data as Row[]}
        activeFilters={activeFilterRecord}
        filterSummary={filterSummary}
        totalFilteredCount={total}
        onSuccess={exportPdfSuccess}
        onError={exportPdfError}
      />
    </div>
  );
}

function MaintenanceCalendarView({ onOpenDevice }: { onOpenDevice: (deviceId: string) => void }) {
  const { t, i18n } = useTranslation("inventory");
  const [monthStart, setMonthStart] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [items, setItems] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | "all">("all");

  const from = useMemo(() => monthStart.toISOString().slice(0, 10), [monthStart]);
  const to = useMemo(() => {
    const date = new Date(monthStart);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    return date.toISOString().slice(0, 10);
  }, [monthStart]);

  useEffect(() => {
    fetchTechnicianOptions()
      .then(setTechnicians)
      .catch(() => setTechnicians([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMaintenanceCalendar({
      from,
      to,
      assignedTo: assignedTo || undefined,
      type: typeFilter.trim() || undefined,
      status: statusFilter,
    })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : t("toast.calendarError")),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
     
  }, [from, to, assignedTo, typeFilter, statusFilter, t]);

  const byDay = useMemo(() => {
    const map = new Map<string, MaintenanceSchedule[]>();
    items.forEach((item) => {
      const key = item.next_due_date;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    });
    return map;
  }, [items]);

  const days = useMemo(() => {
    const count = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(monthStart);
      date.setDate(index + 1);
      return date.toISOString().slice(0, 10);
    });
  }, [monthStart]);

  function moveMonth(delta: number) {
    setMonthStart((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  return (
    <div className="pc-card overflow-hidden">
      <div className="pc-card-hd flex-wrap gap-2">
        <div>
          <span className="pc-card-title">{t("maintenance.calendarTitle")}</span>
          <div className="text-xs text-text3">
            {monthStart.toLocaleDateString(i18n.language, { month: "long", year: "numeric" })} ·{" "}
            {t("counts.interventions", { count: items.length })}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => moveMonth(-1)}>
            {t("maintenance.prevMonth")}
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() =>
              setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
            }
          >
            {t("maintenance.today")}
          </button>
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => moveMonth(1)}>
            {t("maintenance.nextMonth")}
          </button>
          <select
            className="pc-input max-w-[190px]"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
            <option value="">{t("filters.allTechnicians")}</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
          <input
            className="pc-input max-w-[180px]"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            placeholder={t("filters.maintenanceTypePlaceholder")}
          />
          <select
            className="pc-input max-w-[170px]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as MaintenanceStatus | "all")}
          >
            <option value="all">{t("filters.allStatuses")}</option>
            <option value="scheduled">{t("filters.maintenanceScheduled")}</option>
            <option value="due_soon">{t("filters.maintenanceDueSoon")}</option>
            <option value="overdue">{t("filters.maintenanceOverdue")}</option>
            <option value="completed">{t("filters.maintenanceCompleted")}</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-7">
        {days.map((day) => {
          const dayItems = byDay.get(day) ?? [];
          const isToday = day === todayIsoDate();
          return (
            <div key={day} className="min-h-[132px] bg-background p-2">
              <div
                className={`mb-2 text-xs font-semibold ${isToday ? "text-accent" : "text-text3"}`}
              >
                {new Date(day).toLocaleDateString(i18n.language, {
                  weekday: "short",
                  day: "2-digit",
                })}
              </div>
              <div className="flex flex-col gap-1.5">
                {dayItems.map((item) => {
                  const status = getMaintenanceStatus(item);
                  const meta = MAINTENANCE_STATUS_META[status];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="rounded-md border p-2 text-left text-[11px] hover:bg-surface2"
                      style={{ borderColor: meta.color, background: meta.background }}
                      onClick={() => onOpenDevice(item.device_id)}
                    >
                      <div className="font-semibold" style={{ color: meta.color }}>
                        {item.title}
                      </div>
                      <div className="text-text2">
                        {item.device?.model || t("maintenance.device")}
                      </div>
                      <div className="font-mono text-text3">
                        {item.device?.serial || item.device_id.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-[10px] text-text3">
                        {MAINTENANCE_RECURRENCE_LABEL[item.recurrence]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {loading ? (
        <div className="p-3 text-center text-sm text-text3">{t("loading.calendar")}</div>
      ) : null}
    </div>
  );
}

function CompareDevicesModal({
  open,
  rows,
  onClose,
}: {
  open: boolean;
  rows: CompareDevice[];
  onClose: () => void;
}) {
  const { t } = useTranslation("inventory");
  const specs: [string, (row: CompareDevice) => string][] = [
    [t("compare.specs.brandModel"), (row) => `${row.brand || "—"} ${row.model}`.trim()],
    [t("compare.specs.assetTag"), (row) => row.asset_tag || "—"],
    [t("compare.specs.category"), (row) => getDeviceCategoryLabel(row.category)],
    [t("compare.specs.type"), (row) => row.device_type || "—"],
    [t("compare.specs.serial"), (row) => row.serial || "—"],
    [t("compare.specs.status"), (row) => DEVICE_STATUS_META[row.status]?.label || row.status],
    [t("compare.specs.client"), (row) => row.client?.name || "—"],
    [t("compare.specs.cpu"), (row) => row.cpu_name || "—"],
    [
      t("compare.specs.cpuFrequency"),
      (row) => (row.cpu_frequency_ghz ? `${row.cpu_frequency_ghz} GHz` : "—"),
    ],
    [t("compare.specs.cores"), (row) => (row.cpu_cores ? String(row.cpu_cores) : "—")],
    [
      t("compare.specs.ram"),
      (row) => (row.ram_gb ? `${row.ram_gb} GB ${row.ram_type || ""}`.trim() : "—"),
    ],
    [
      t("compare.specs.storage"),
      (row) =>
        row.storage_capacity_gb
          ? `${row.storage_capacity_gb} GB ${row.storage_type || ""}`.trim()
          : "—",
    ],
    [
      t("compare.specs.drive"),
      (row) => (row.storage_drive_count ? String(row.storage_drive_count) : "—"),
    ],
    [
      t("compare.specs.os"),
      (row) => [row.os, row.os_version, row.os_architecture].filter(Boolean).join(" · ") || "—",
    ],
    [
      t("compare.specs.screen"),
      (row) =>
        [
          row.screen_size_inches ? `${row.screen_size_inches}"` : null,
          row.screen_resolution,
          row.screen_type,
        ]
          .filter(Boolean)
          .join(" · ") || "—",
    ],
    [
      t("compare.specs.connectivity"),
      (row) => [row.wifi, row.ethernet, row.bluetooth].filter(Boolean).join(" · ") || "—",
    ],
    [
      t("compare.specs.warranty"),
      (row) => WARRANTY_STATUS_META[getWarrantyStatus(row.warranty_expiry_date)].label,
    ],
  ];

  return (
    <Modal open={open} onClose={onClose} title={t("compare.title")} size="xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                className="border-b px-3 py-2 text-left text-xs uppercase text-text3"
                style={{ borderColor: "var(--border)" }}
              >
                {t("compare.spec")}
              </th>
              {rows.map((row) => (
                <th
                  key={row.id}
                  className="border-b px-3 py-2 text-left"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    className="font-semibold text-accent hover:underline"
                    onClick={() => openDeviceDetail(row.id)}
                  >
                    {row.model}
                  </button>
                  <div className="font-mono text-[11px] text-text3">
                    {row.serial || row.id.slice(0, 8)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specs.map(([label, value]) => (
              <tr key={label} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2 font-semibold text-text3">{label}</td>
                {rows.map((row) => (
                  <td key={`${row.id}-${label}`} className="px-3 py-2">
                    {value(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <button className="pc-btn pc-btn-ghost" onClick={onClose}>
          {t("actions.close")}
        </button>
      </div>
    </Modal>
  );
}

function WarrantyBadge({ expiryDate }: { expiryDate: string | null }) {
  const { t } = useTranslation("inventory");
  const status = getWarrantyStatus(expiryDate);
  const meta = WARRANTY_STATUS_META[status];
  const days = daysUntil(expiryDate);
  const title =
    days === null
      ? t("warrantyBadge.noExpiry")
      : t("warrantyBadge.expiresOn", { date: fmtDate(expiryDate!) });
  const subtitle =
    days === null
      ? null
      : days < 0
        ? t("warrantyBadge.daysAgo", { count: Math.abs(days) })
        : days === 0
          ? t("warrantyBadge.today")
          : t("warrantyBadge.daysLeft", { count: days });
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      title={title}
      style={{ color: meta.color, background: meta.background, borderColor: meta.color }}
    >
      {meta.label}
      {subtitle ? <span className="font-mono opacity-80">· {subtitle}</span> : null}
    </span>
  );
}

function DeviceMobileCard({
  row,
  selected,
  saving,
  onOpen,
  onSelect,
  onStatusChange,
  onCreateTicket,
  onQr,
}: {
  row: Row;
  selected: boolean;
  saving: boolean;
  onOpen: () => void;
  onSelect: (checked: boolean) => void;
  onStatusChange: (id: string, next: DeviceStatus) => void | Promise<void>;
  onCreateTicket: () => void;
  onQr: () => void;
}) {
  const { t } = useTranslation("inventory");
  return (
    <article
      className="pc-card pc-card-body flex flex-col transition-all duration-200"
      style={{
        border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: selected ? "var(--surface)" : "var(--surface)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          aria-label={t("columns.selectDevice", "Seleziona dispositivo")}
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="break-anywhere text-sm font-semibold">{row.model}</div>
          <div className="mt-1 font-mono text-[11px] text-text3">
            {row.asset_tag || row.id.slice(0, 8)}
            {row.serial ? ` · ${t("columns.serial")} ${row.serial}` : ""}
          </div>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <div className="pc-label">{t("columns.category", "Categoria")}</div>
          <div>{getDeviceCategoryLabel(row.category)}</div>
        </div>
        <div>
          <div className="pc-label">{t("columns.deviceType", "Tipo")}</div>
          <div>{row.device_type || "-"}</div>
        </div>
        <div>
          <div className="pc-label">{t("columns.client", "Cliente")}</div>
          <div className="break-anywhere">{row.client?.name || "-"}</div>
        </div>
        <div>
          <div className="pc-label">{t("columns.warranty", "Garanzia")}</div>
          <WarrantyBadge expiryDate={row.warranty_expiry_date} />
        </div>
      </div>
      {row.has_maintenance_due_soon ? (
        <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-500 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
          <Wrench className="size-3" />
          {t("maintenance.dueSoon", "Manutenzione")}{" "}
          {row.next_maintenance_due_date
            ? fmtDate(row.next_maintenance_due_date)
            : t("maintenance.expiring", "in scadenza")}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DeviceStatusBadge
          deviceId={row.id}
          status={row.status}
          hasActiveAssignment={!!row.has_active_assignment}
          saving={saving}
          onStatusChange={onStatusChange}
        />
        <button type="button" className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onCreateTicket}>
          <TicketPlus className="size-3.5" />
          {t("actions.ticket")}
        </button>
        <button type="button" className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onQr}>
          <QrCode className="size-3.5" />
          {t("actions.qr")}
        </button>
      </div>
    </article>
  );
}

function DeviceStatusBadge({
  deviceId,
  status,
  hasActiveAssignment,
  saving,
  onStatusChange,
}: {
  deviceId: string;
  status: DeviceStatus;
  hasActiveAssignment: boolean;
  saving: boolean;
  onStatusChange: (id: string, next: DeviceStatus) => void | Promise<void>;
}) {
  const { t } = useTranslation("inventory");
  const meta = DEVICE_STATUS_META[status];
  const readOnlyAssigned = hasActiveAssignment && status === "assigned";

  if (readOnlyAssigned) {
    return (
      <span
        className="pc-badge"
        title={t(
          "details.readOnlyAssigned",
          "Assegnazione ticket attiva: per coerenza modifica lo stato dal flusso ticket.",
        )}
        style={{ color: meta.color, background: `${meta.color}26` }}
      >
        {t("status." + status, meta.label)}
      </span>
    );
  }

  return (
    <select
      aria-label={t("columns.status", "Stato dispositivo")}
      className="pc-badge cursor-pointer max-w-[155px] disabled:opacity-60 disabled:cursor-wait"
      style={{
        color: meta.color,
        background: `${meta.color}26`,
        borderColor: `color-mix(in oklab, ${meta.color} 24%, transparent)`,
      }}
      value={status}
      disabled={saving}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.target.value as DeviceStatus;
        void onStatusChange(deviceId, next);
      }}
    >
      {(Object.entries(DEVICE_STATUS_META) as [DeviceStatus, { label: string }][]).map(
        ([key, v]) => (
          <option key={key} value={key}>
            {t("status." + key, v.label)}
          </option>
        ),
      )}
    </select>
  );
}

function toQrDevice(row: Row): QrDevice {
  return { id: row.id, serial: row.asset_tag || row.serial, model: row.model };
}

function extractDeviceCode(rawCode: string) {
  const trimmed = rawCode.trim();
  const id = extractDeviceId(trimmed);
  if (id) return id;
  return trimmed;
}

function extractDeviceId(rawCode: string) {
  const trimmed = rawCode.trim();
  const appMatch = trimmed.match(/^pcready:\/\/device\/([0-9a-f-]{36})$/i);
  if (appMatch) return appMatch[1];

  try {
    const url = new URL(trimmed);
    const queryDevice = url.searchParams.get("device");
    if (queryDevice) return queryDevice;
    const pathMatch = url.pathname.match(/\/inventory\/([0-9a-f-]{36})$/i);
    return pathMatch?.[1] ?? null;
  } catch {
    return null;
  }
}
