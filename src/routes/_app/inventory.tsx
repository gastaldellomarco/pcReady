import { createFileRoute } from "@tanstack/react-router";
import { TableSkeletonRows, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import queries from "@/lib/queries/inventory";
import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";
import { useTickets } from "@/lib/use-tickets";
import { openDeviceDetail } from "@/lib/use-detail";
import { OS_OPTIONS, fmtDate } from "@/lib/pcready";
import { getPublicAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  FileDown,
  Eye,
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
import { toast } from "sonner";
import { InventoryPdf, type DevicePdfRow } from "@/components/pcready/pdf/InventoryPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import { QrCodeDialog, type QrDevice } from "@/components/inventory/QrCodeDialog";
import { ImportCsvDialog } from "@/components/inventory/ImportCsvDialog";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { Modal } from "@/components/pcready/Modal";
import { buildLabelItems, printLabelBatch } from "@/lib/inventory-labels";
import { supabase } from "@/integrations/supabase/client";
import { buildDownloadFileName } from "@/lib/downloads";
import { pcReadyColors } from "@/lib/design-system";
import {
  daysUntil,
  getWarrantyStatus,
  WARRANTY_STATUS_META,
  type WarrantyFilter,
} from "@/lib/warranty";
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

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({
    meta: [
      { title: "Inventario - PCReady" },
      {
        name: "description",
        content: "Inventario completo dei dispositivi gestiti, con seriali e stato.",
      },
    ],
  }),
  component: InventoryPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

interface Row {
  id: string;
  serial: string | null;
  model: string;
  os: string | null;
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

function InventoryPage() {
  const { openAddDevice, openCreate } = useTickets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const loadSettings = useServerFn(getPublicAppSettings);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [fs, setFs] = useState("");
  const [fos, setFos] = useState("");
  const [q, setQ] = useState("");
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
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
  const { useInventoryList } = queries as any;
  const listQuery = useInventoryList({
    status: fs || undefined,
    os: fos || undefined,
    q,
    page,
    pageSize: PAGE_SIZE,
    withoutTicket: withoutTicketFilter,
    warrantyStatus: warrantyFilter,
    maintenanceDueSoon: maintenanceDueFilter,
    updatedBefore: updatedBeforeDays
      ? new Date(Date.now() - updatedBeforeDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
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
    // check for optional URL filter param (e.g. ?filter=without_ticket)
    const params = new URLSearchParams(window.location.search);
    const detailDeviceId = params.get("device");
    if (detailDeviceId) openDeviceDetail(detailDeviceId);
  }, []);

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.data as Row[]);
      setTotal(listQuery.data.count ?? 0);
    }
  }, [listQuery.data]);

  useEffect(() => {
    setPage(0);
  }, [fs, fos, q, warrantyFilter, maintenanceDueFilter]);

  const data = rows;
  const listLoading = listQuery.isLoading;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedRows = data.filter((row) => selectedIds.has(row.id));
  const allPageSelected = data.length > 0 && data.every((row) => selectedIds.has(row.id));

  function pdfRows(): DevicePdfRow[] {
    return data.map((r) => ({
      id: r.id,
      serial: r.serial,
      model: r.model,
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

  async function exportPdf() {
    if (!data.length) return toast.error("Nessun dispositivo da esportare");
    setPdfBusy("download");
    try {
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      const org = settings?.organization_name;
      await downloadPdf(
        <InventoryPdf rows={pdfRows()} organizationName={org} />,
        buildDownloadFileName("pcready-inventario", "pdf", { dated: true }),
      );
      toast.success("PDF inventario esportato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore esportazione PDF"));
    } finally {
      setPdfBusy(null);
    }
  }

  async function openPdfPreview() {
    if (!data.length) return toast.error("Nessun dispositivo da visualizzare");
    setPdfBusy("preview");
    try {
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      const org = settings?.organization_name;
      await previewPdf(<InventoryPdf rows={pdfRows()} organizationName={org} />);
    } catch (error) {
      toast.error(errorMessage(error, "Errore anteprima PDF"));
    } finally {
      setPdfBusy(null);
    }
  }

  async function printSelectedLabels() {
    if (!selectedRows.length) return toast.error("Seleziona almeno un dispositivo");
    setLabelsBusy(true);
    try {
      const items = await buildLabelItems(selectedRows.map(toQrDevice));
      printLabelBatch(items);
    } catch (error) {
      toast.error(errorMessage(error, "Errore stampa etichette"));
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
      toast.error(err instanceof Error ? err.message : "Errore ricerca dispositivo");
      return;
    }

    setQ(code);
    toast("Dispositivo non trovato", {
      description: `Seriale rilevato: ${code}`,
      action: {
        label: "Crea",
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
      toast.success(`Stato aggiornato a ${DEVICE_STATUS_META[nextStatus].label}`);
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    } catch (error) {
      toast.error(errorMessage(error, "Errore aggiornamento stato"));
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
    toast.success(`${success} dispositivi aggiornati${fail ? `, ${fail} errori` : ""}`);
  }

  async function openCompareDevices() {
    const ids = [...selectedIds];
    if (ids.length < 2 || ids.length > 3)
      return toast.error("Seleziona 2 o 3 dispositivi da confrontare");
    setCompareBusy(true);
    try {
      const { data: rows, error } = await supabase
        .from("devices")
        .select(
          "id, serial, brand, model, os, status, client_id, updated_at, assigned_to, purchase_date, warranty_expiry_date, warranty_type, warranty_provider, warranty_notes, device_type, cpu_name, cpu_frequency_ghz, cpu_cores, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count, os_version, os_architecture, screen_resolution, screen_size_inches, screen_type, wifi, ethernet, bluetooth, client:clients(name)",
        )
        .in("id", ids);
      if (error) throw error;
      setCompareRows((rows ?? []) as CompareDevice[]);
      setCompareOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, "Errore confronto dispositivi"));
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
    toast.success(`${success} dispositivi aggiornati${fail ? `, ${fail} errori` : ""}`);
  }

  async function exportSelectedPdf() {
    if (!selectedRows.length) return toast.error("Nessun dispositivo selezionato");
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
      toast.success("PDF esportato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore esportazione PDF"));
    } finally {
      setPdfBusy(null);
    }
  }

  function toPdfRow(r: Row): DevicePdfRow {
    return {
      id: r.id,
      serial: r.serial,
      model: r.model,
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

  async function exportWarrantyPdf() {
    if (!data.length) return toast.error("Nessun dispositivo da esportare");
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
      toast.success("Report garanzie esportato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore esportazione report garanzie"));
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="pc-input max-w-[160px]"
          value={fs}
          onChange={(e) => setFs(e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(DEVICE_STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          className="pc-input max-w-[200px]"
          value={fos}
          onChange={(e) => setFos(e.target.value)}
        >
          <option value="">Tutti gli OS</option>
          {osOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input
          className="pc-input max-w-[260px]"
          placeholder="Cerca seriale, modello, utente..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="pc-input max-w-[210px]"
          value={updatedBeforeDays ?? ""}
          onChange={(e) => setUpdatedBeforeDays(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Tutte le date</option>
          <option value="7">Non aggiornati da &gt; 7 giorni</option>
          <option value="14">Non aggiornati da &gt; 14 giorni</option>
          <option value="30">Non aggiornati da &gt; 30 giorni</option>
          <option value="60">Non aggiornati da &gt; 60 giorni</option>
        </select>
        <select
          className="pc-input max-w-[190px]"
          value={warrantyFilter}
          onChange={(e) => setWarrantyFilter(e.target.value as WarrantyFilter)}
        >
          <option value="all">Tutte le garanzie</option>
          <option value="valid">In garanzia</option>
          <option value="expiring">In scadenza</option>
          <option value="urgent">Urgente</option>
          <option value="expired">Scaduta</option>
          <option value="missing">Senza garanzia</option>
        </select>
        <button
          type="button"
          className={`pc-btn pc-btn-sm ${maintenanceDueFilter ? "pc-btn-primary" : "pc-btn-ghost"}`}
          onClick={() => setMaintenanceDueFilter((value) => !value)}
          title="Mostra solo dispositivi con manutenzione in scadenza entro 30 giorni"
        >
          <Wrench className="w-3 h-3" /> In scadenza 30g
        </button>
        <div className="flex rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            className={`pc-btn pc-btn-sm ${view === "list" ? "pc-btn-primary" : "pc-btn-ghost"}`}
            onClick={() => setView("list")}
          >
            Lista
          </button>
          <button
            type="button"
            className={`pc-btn pc-btn-sm ${view === "calendar" ? "pc-btn-primary" : "pc-btn-ghost"}`}
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="w-3 h-3" /> Calendario manutenzioni
          </button>
        </div>
        <span className="ml-auto self-center text-xs text-text3 font-mono">
          {total
            ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + data.length} di ${total}`
            : "0 dispositivi"}
        </span>
        <button
          onClick={openPdfPreview}
          disabled={!!pdfBusy}
          className="pc-btn pc-btn-ghost pc-btn-sm"
        >
          <Eye className="w-3 h-3" /> Anteprima PDF
        </button>
        <button onClick={exportPdf} disabled={!!pdfBusy} className="pc-btn pc-btn-ghost pc-btn-sm">
          <FileDown className="w-3 h-3" />
          {pdfBusy === "download" ? "Esportazione..." : "Esporta PDF"}
        </button>
        <button
          onClick={exportWarrantyPdf}
          disabled={!!pdfBusy}
          className="pc-btn pc-btn-ghost pc-btn-sm"
        >
          <FileDown className="w-3 h-3" /> Report garanzie
        </button>
        <button
          onClick={printSelectedLabels}
          disabled={labelsBusy || !selectedRows.length}
          className="pc-btn pc-btn-ghost pc-btn-sm"
        >
          <Printer className="w-3 h-3" />
          {labelsBusy
            ? "Preparazione..."
            : `Stampa etichette${selectedRows.length ? ` (${selectedRows.length})` : ""}`}
        </button>
        <button onClick={() => setScannerOpen(true)} className="pc-btn pc-btn-ghost pc-btn-sm">
          <ScanLine className="w-3 h-3" /> Scansiona
        </button>
        <button onClick={() => setImportOpen(true)} className="pc-btn pc-btn-ghost pc-btn-sm">
          <Upload className="w-3 h-3" /> Import CSV
        </button>
        <button onClick={() => openAddDevice()} className="pc-btn pc-btn-primary pc-btn-sm">
          <Plus className="w-3 h-3" /> Aggiungi dispositivo
        </button>
      </div>
      {selectedIds.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
        >
          <span className="text-[12px] font-semibold text-text3 font-mono mr-1">
            {selectedIds.size} selezionat{" "}
            {data.length > selectedIds.size ? (
              <button
                className="text-accent hover:underline text-[11px] ml-1"
                onClick={() => setSelectedIds(new Set(data.map((r) => r.id)))}
              >
                Seleziona pagina
              </button>
            ) : null}
          </span>
          <div className="flex-1" />
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={bulkBusy}
            onClick={() => setBulkStatusOpen(true)}
          >
            <CheckCircle2 className="h-3 w-3" />
            Cambia stato
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={!!pdfBusy}
            onClick={exportSelectedPdf}
          >
            <FileDown className="h-3 w-3" />
            Esporta PDF
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={compareBusy || selectedIds.size < 2 || selectedIds.size > 3}
            onClick={openCompareDevices}
          >
            <Columns3 className="h-3 w-3" />
            Confronta
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={bulkBusy}
            onClick={() => setBulkClientOpen(true)}
          >
            <ClipboardList className="h-3 w-3" />
            Assegna utente
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm text-destructive"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-3 w-3" />
            Deseleziona
          </button>
        </div>
      )}
      {view === "calendar" ? (
        <MaintenanceCalendarView onOpenDevice={openDeviceDetail} />
      ) : listQuery.isError ? (
        <PageFetchError
          message="Impossibile caricare l\'inventario. Controlla la connessione e riprova."
          onRetry={() => listQuery.refetch()}
        />
      ) : (
        <div className="pc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th
                    className="w-10 px-[14px] py-[9px] text-left border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      aria-label="Seleziona pagina"
                      checked={allPageSelected}
                      onChange={(event) => togglePageSelected(event.target.checked)}
                    />
                  </th>
                  {[
                    "ID",
                    "Seriale",
                    "Modello",
                    "OS",
                    "Stato",
                    "Garanzia",
                    "Cliente",
                    "Utente",
                    "Aggiornato",
                    "Azioni",
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
                  <TableSkeletonRows rows={12} columns={11} cellClassName="px-[14px] py-[10px]" />
                ) : (
                  <>
                    {data.map((r) => (
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
                            aria-label={`Seleziona ${r.serial || r.id}`}
                            checked={selectedIds.has(r.id)}
                            onChange={(event) => toggleSelected(r.id, event.target.checked)}
                          />
                        </td>
                        <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">
                          {r.id.slice(0, 8)}
                        </td>
                        <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                          {r.serial || "-"}
                        </td>
                        <td className="px-[14px] py-[10px] text-[12.5px]">
                          <div>{r.model}</div>
                          {r.has_maintenance_due_soon ? (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <Wrench className="h-3 w-3" /> Manutenzione{" "}
                              {r.next_maintenance_due_date
                                ? fmtDate(r.next_maintenance_due_date)
                                : "in scadenza"}
                            </div>
                          ) : null}
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
                              title="Crea ticket con questo dispositivo"
                              aria-label={`Crea ticket per ${r.serial || r.id}`}
                              onClick={() => {
                                openDeviceDetail(r.id);
                                setTimeout(() => openCreate(), 200);
                              }}
                            >
                              <TicketPlus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="pc-btn-icon touch-target"
                              title="QR dispositivo"
                              aria-label={`QR ${r.serial || r.id}`}
                              onClick={() => setQrDevice(toQrDevice(r))}
                            >
                              <QrCode className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!data.length && (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-text3 text-sm">
                          Nessun dispositivo. Clicca <b>Aggiungi dispositivo</b> per iniziare.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {view === "list" && (
        <div className="flex items-center justify-end gap-2">
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Precedente
          </button>
          <span className="text-xs text-text3 font-mono">
            Pagina {page + 1} di {pageCount}
          </span>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Successiva
          </button>
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
            <AlertDialogTitle>Cambia stato in blocco</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} dispositivi selezionati. Scegli il nuovo stato:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <select
            className="pc-input w-full"
            value={bulkTargetStatus}
            onChange={(e) => setBulkTargetStatus(e.target.value as DeviceStatus)}
          >
            {Object.entries(DEVICE_STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Annulla</AlertDialogCancel>
            <AlertDialogAction type="button" disabled={bulkBusy} onClick={handleBulkStatusChange}>
              {bulkBusy ? "Aggiornamento..." : `Applica a ${selectedIds.size} dispositivi`}
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
            <AlertDialogTitle>Assegna utente in blocco</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} dispositivi selezionati. Inserisci il nome utente da assegnare
              (anagrafica):
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            className="pc-input w-full"
            placeholder="Nome utente (es. Mario Rossi)"
            value={bulkTargetClientName}
            onChange={(e) => setBulkTargetClientName(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Annulla</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={bulkBusy || !bulkTargetClientName.trim()}
              onClick={handleBulkAssignClient}
            >
              {bulkBusy ? "Aggiornamento..." : `Applica a ${selectedIds.size} dispositivi`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MaintenanceCalendarView({ onOpenDevice }: { onOpenDevice: (deviceId: string) => void }) {
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
        toast.error(error instanceof Error ? error.message : "Errore calendario manutenzioni"),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, assignedTo, typeFilter, statusFilter]);

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
          <span className="pc-card-title">Calendario manutenzioni</span>
          <div className="text-xs text-text3">
            {monthStart.toLocaleDateString("it-IT", { month: "long", year: "numeric" })} ·{" "}
            {items.length} interventi
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => moveMonth(-1)}>
            Mese prec.
          </button>
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() =>
              setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
            }
          >
            Oggi
          </button>
          <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => moveMonth(1)}>
            Mese succ.
          </button>
          <select
            className="pc-input max-w-[190px]"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
            <option value="">Tutti i tecnici</option>
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
            placeholder="Tipo manutenzione"
          />
          <select
            className="pc-input max-w-[170px]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as MaintenanceStatus | "all")}
          >
            <option value="all">Tutti gli stati</option>
            <option value="scheduled">Programmata</option>
            <option value="due_soon">In scadenza</option>
            <option value="overdue">Scaduta</option>
            <option value="completed">Completata</option>
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
                {new Date(day).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit" })}
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
                      <div className="text-text2">{item.device?.model || "Dispositivo"}</div>
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
        <div className="p-3 text-center text-sm text-text3">Caricamento calendario...</div>
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
  const specs: [string, (row: CompareDevice) => string][] = [
    ["Brand / modello", (row) => `${row.brand || "—"} ${row.model}`.trim()],
    ["Tipo", (row) => row.device_type || "—"],
    ["Seriale", (row) => row.serial || "—"],
    ["Stato", (row) => DEVICE_STATUS_META[row.status]?.label || row.status],
    ["Cliente", (row) => row.client?.name || "—"],
    ["CPU", (row) => row.cpu_name || "—"],
    ["Frequenza CPU", (row) => (row.cpu_frequency_ghz ? `${row.cpu_frequency_ghz} GHz` : "—")],
    ["Core", (row) => (row.cpu_cores ? String(row.cpu_cores) : "—")],
    ["RAM", (row) => (row.ram_gb ? `${row.ram_gb} GB ${row.ram_type || ""}`.trim() : "—")],
    [
      "Storage",
      (row) =>
        row.storage_capacity_gb
          ? `${row.storage_capacity_gb} GB ${row.storage_type || ""}`.trim()
          : "—",
    ],
    ["Drive", (row) => (row.storage_drive_count ? String(row.storage_drive_count) : "—")],
    [
      "OS",
      (row) => [row.os, row.os_version, row.os_architecture].filter(Boolean).join(" · ") || "—",
    ],
    [
      "Schermo",
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
      "Connettività",
      (row) => [row.wifi, row.ethernet, row.bluetooth].filter(Boolean).join(" · ") || "—",
    ],
    ["Garanzia", (row) => WARRANTY_STATUS_META[getWarrantyStatus(row.warranty_expiry_date)].label],
  ];

  return (
    <Modal open={open} onClose={onClose} title="Confronto dispositivi" size="xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th
                className="border-b px-3 py-2 text-left text-xs uppercase text-text3"
                style={{ borderColor: "var(--border)" }}
              >
                Specifica
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
          Chiudi
        </button>
      </div>
    </Modal>
  );
}

function WarrantyBadge({ expiryDate }: { expiryDate: string | null }) {
  const status = getWarrantyStatus(expiryDate);
  const meta = WARRANTY_STATUS_META[status];
  const days = daysUntil(expiryDate);
  const title =
    days === null ? "Nessuna scadenza garanzia impostata" : `Scade il ${fmtDate(expiryDate!)}`;
  const subtitle =
    days === null
      ? null
      : days < 0
        ? `${Math.abs(days)} gg fa`
        : days === 0
          ? "oggi"
          : `${days} gg`;
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
  const meta = DEVICE_STATUS_META[status];
  const readOnlyAssigned = hasActiveAssignment && status === "assigned";

  if (readOnlyAssigned) {
    return (
      <span
        className="pc-badge"
        title="Assegnazione ticket attiva: per coerenza modifica lo stato dal flusso ticket."
        style={{ color: meta.color, background: `${meta.color}26` }}
      >
        {meta.label}
      </span>
    );
  }

  return (
    <select
      aria-label="Stato dispositivo"
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
            {v.label}
          </option>
        ),
      )}
    </select>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toQrDevice(row: Row): QrDevice {
  return { id: row.id, serial: row.serial, model: row.model };
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
