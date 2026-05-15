import { createFileRoute } from "@tanstack/react-router";
import { TableSkeletonRows, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import queries from "@/lib/queries/inventory";
import { useTickets } from "@/lib/use-tickets";
import { openDeviceDetail } from "@/lib/use-detail";
import { OS_OPTIONS, fmtDate } from "@/lib/pcready";
import { getPublicAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { Plus, FileDown, Eye, QrCode, Upload, ScanLine, Printer, TicketPlus, ClipboardList, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { InventoryPdf, type DevicePdfRow } from "@/components/pcready/pdf/InventoryPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import { QrCodeDialog, type QrDevice } from "@/components/inventory/QrCodeDialog";
import { ImportCsvDialog } from "@/components/inventory/ImportCsvDialog";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { buildLabelItems, printLabelBatch } from "@/lib/inventory-labels";
import { supabase } from "@/integrations/supabase/client";
import { buildDownloadFileName } from "@/lib/downloads";
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
  has_active_assignment?: boolean;
}

type DeviceStatus = "available" | "assigned" | "maintenance" | "retired";

const DEVICE_STATUS_META: Record<DeviceStatus, { label: string; color: string }> = {
  available: { label: "Disponibile", color: "#16A34A" },
  assigned: { label: "Assegnato", color: "#1B4FD8" },
  maintenance: { label: "Manutenzione", color: "#EF9827" },
  retired: { label: "Dismesso", color: "#6B7280" },
};

const PAGE_SIZE = 50;

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
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkClientOpen, setBulkClientOpen] = useState(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<DeviceStatus>("available");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTargetClientName, setBulkTargetClientName] = useState("");
  const { useInventoryList } = queries as any;
  const listQuery = useInventoryList({
    status: fs || undefined,
    os: fos || undefined,
    q,
    page,
    pageSize: PAGE_SIZE,
    withoutTicket: withoutTicketFilter,
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
  }, [fs, fos, q]);

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
    };
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
          onChange={(e) =>
            setUpdatedBeforeDays(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">Tutte le date</option>
          <option value="7">Non aggiornati da &gt; 7 giorni</option>
          <option value="14">Non aggiornati da &gt; 14 giorni</option>
          <option value="30">Non aggiornati da &gt; 30 giorni</option>
          <option value="60">Non aggiornati da &gt; 60 giorni</option>
        </select>
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
      {listQuery.isError ? (
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
                  <TableSkeletonRows rows={12} columns={10} cellClassName="px-[14px] py-[10px]" />
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
                        <td className="px-[14px] py-[10px] text-[12.5px]">{r.model}</td>
                        <td className="px-[14px] py-[10px] text-[12px] text-text2">{r.os || "-"}</td>
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
                        <td className="px-[14px] py-[10px] text-[12px]">{r.client?.name || "-"}</td>
                        <td className="px-[14px] py-[10px] text-[12px]">{r.assigned_to || "-"}</td>
                        <td className="px-[14px] py-[10px] text-[11px] text-text3" title={r.updated_at}>
                          {fmtDate(r.updated_at)}
                        </td>
                        <td
                          className="px-[14px] py-[10px]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              className="pc-btn-icon"
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
                              className="pc-btn-icon"
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
                        <td colSpan={10} className="text-center py-12 text-text3 text-sm">
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

      <AlertDialog open={bulkStatusOpen} onOpenChange={(open) => {
        setBulkStatusOpen(open);
        if (!open) setBulkTargetStatus("available");
      }}>
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
            <AlertDialogAction
              type="button"
              disabled={bulkBusy}
              onClick={handleBulkStatusChange}
            >
              {bulkBusy ? "Aggiornamento..." : `Applica a ${selectedIds.size} dispositivi`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkClientOpen} onOpenChange={(open) => {
        setBulkClientOpen(open);
        if (!open) setBulkTargetClientName("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assegna utente in blocco</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size} dispositivi selezionati. Inserisci il nome utente da assegnare (anagrafica):
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
