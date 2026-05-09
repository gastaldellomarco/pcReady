import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { openDeviceDetail } from "@/lib/use-detail";
import { OS_OPTIONS, fmtDate } from "@/lib/pcready";
import { getPublicAppSettings } from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { Plus, FileDown, Eye, QrCode, Upload, ScanLine, Printer } from "lucide-react";
import { toast } from "sonner";
import { InventoryPdf, type DevicePdfRow } from "@/components/pcready/pdf/InventoryPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import { QrCodeDialog, type QrDevice } from "@/components/inventory/QrCodeDialog";
import { ImportCsvDialog } from "@/components/inventory/ImportCsvDialog";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";
import { buildLabelItems, printLabelBatch } from "@/lib/inventory-labels";

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
}

interface AssignmentDeviceRow {
  device_id: string | null;
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
  const { refreshKey, openAddDevice, triggerRefresh } = useTickets();
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
  const [osOptions, setOsOptions] = useState<string[]>(OS_OPTIONS);

  useEffect(() => {
    if (!session?.access_token) return;
    loadSettings({ data: { accessToken: session.access_token } })
      .then((settings) => setOsOptions(settings.os_options.length ? settings.os_options : OS_OPTIONS))
      .catch(() => setOsOptions(OS_OPTIONS));
  }, [loadSettings, session?.access_token]);

  useEffect(() => {
    // check for optional URL filter param (e.g. ?filter=without_ticket)
    const params = new URLSearchParams(window.location.search);
    const urlFilter = params.get("filter");
    const detailDeviceId = params.get("device");
    if (detailDeviceId) openDeviceDetail(detailDeviceId);

    async function load() {
      // if asking for devices without ticket, fetch assigned ids first
      let assignedIds: string[] = [];
      if (urlFilter === "without_ticket") {
        const { data: assigned } = await supabase
          .from("ticket_device_assignments")
          .select("device_id")
          .is("unassigned_at", null);
        assignedIds = ((assigned ?? []) as AssignmentDeviceRow[])
          .map((r) => r.device_id)
          .filter((id): id is string => Boolean(id));
      }

      let query = supabase
        .from("devices")
        .select(
          "id, serial, model, os, status, client_id, updated_at, assigned_to, client:clients(name)",
          {
            count: "exact",
          },
        )
        .order("updated_at", { ascending: false });

      if (fs) query = query.eq("status", fs as DeviceStatus);
      if (fos) query = query.eq("os", fos);
      const term = q.trim().replace(/[,%]/g, "");
      if (term) {
        query = query.or(
          `serial.ilike.%${term}%,model.ilike.%${term}%,assigned_to.ilike.%${term}%`,
        );
      }

      if (urlFilter === "without_ticket" && assignedIds.length) {
        // exclude assigned ids
        const inList = assignedIds.map((id) => `'${id}'`).join(",");
        query = query.not("id", "in", `(${assignedIds.join(",")})`);
      }

      const { data, count, error } = await query.range(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE - 1,
      );
      if (error) {
        toast.error(error.message);
        return;
      }
      const totalRows = count ?? 0;
      if (page > 0 && page * PAGE_SIZE >= totalRows) {
        setPage(0);
        return;
      }
      setRows((data ?? []) as Row[]);
      setTotal(totalRows);
    }

    void load();
  }, [refreshKey, fs, fos, q, page]);

  useEffect(() => {
    setPage(0);
  }, [fs, fos, q]);

  const data = rows;
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
      await downloadPdf(
        <InventoryPdf rows={pdfRows()} />,
        `pcready-inventario-${new Date().toISOString().slice(0, 10)}.pdf`,
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
      await previewPdf(<InventoryPdf rows={pdfRows()} />);
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

    const { data: found, error } = await supabase
      .from("devices")
      .select("id, serial")
      .ilike("serial", code)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      return;
    }
    if (found?.id) {
      openDeviceDetail(found.id);
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
              {data.map((r) => (
                <tr
                  key={r.id}
                  className="border-b hover:bg-surface2 transition-colors cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => openDeviceDetail(r.id)}
                >
                  <td className="px-[14px] py-[10px]" onClick={(event) => event.stopPropagation()}>
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
                  <td className="px-[14px] py-[10px]">
                    <DeviceStatusBadge status={r.status} />
                  </td>
                  <td className="px-[14px] py-[10px] text-[12px]">{r.client?.name || "-"}</td>
                  <td className="px-[14px] py-[10px] text-[12px]">{r.assigned_to || "-"}</td>
                  <td className="px-[14px] py-[10px] text-[11px] text-text3">
                    {fmtDate(r.updated_at)}
                  </td>
                  <td className="px-[14px] py-[10px]" onClick={(event) => event.stopPropagation()}>
                    <button
                      className="pc-btn-icon"
                      title="QR dispositivo"
                      aria-label={`QR ${r.serial || r.id}`}
                      onClick={() => setQrDevice(toQrDevice(r))}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
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
            </tbody>
          </table>
        </div>
      </div>
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
          triggerRefresh();
        }}
      />
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => void handleDetected(code)}
      />
    </div>
  );
}

function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const meta = DEVICE_STATUS_META[status];
  return (
    <span className="pc-badge" style={{ color: meta.color, background: "var(--surface2)" }}>
      {meta.label}
    </span>
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
