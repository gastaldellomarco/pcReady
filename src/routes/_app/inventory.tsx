import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { openDeviceDetail } from "@/lib/use-detail";
import { OS_OPTIONS, fmtDate } from "@/lib/pcready";
import { Plus, FileDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { InventoryPdf, type DevicePdfRow } from "@/components/pcready/pdf/InventoryPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";

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

type DeviceStatus = "available" | "assigned" | "maintenance" | "retired";

const DEVICE_STATUS_META: Record<DeviceStatus, { label: string; color: string }> = {
  available: { label: "Disponibile", color: "#16A34A" },
  assigned: { label: "Assegnato", color: "#1B4FD8" },
  maintenance: { label: "Manutenzione", color: "#EF9827" },
  retired: { label: "Dismesso", color: "#6B7280" },
};

const PAGE_SIZE = 50;

function InventoryPage() {
  const { refreshKey, openAddDevice } = useTickets();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [fs, setFs] = useState("");
  const [fos, setFos] = useState("");
  const [q, setQ] = useState("");
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);

  useEffect(() => {
    // check for optional URL filter param (e.g. ?filter=without_ticket)
    const params = new URLSearchParams(window.location.search);
    const urlFilter = params.get("filter");

    async function load() {
      // if asking for devices without ticket, fetch assigned ids first
      let assignedIds: string[] = [];
      if (urlFilter === "without_ticket") {
        const { data: assigned } = await supabase
          .from("ticket_device_assignments")
          .select("device_id")
          .eq("unassigned_at", null);
        assignedIds = (assigned ?? []).map((r: any) => r.device_id).filter(Boolean);
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
        query = query.or(`serial.ilike.%${term}%,model.ilike.%${term}%,assigned_to.ilike.%${term}%`);
      }

      if (urlFilter === "without_ticket" && assignedIds.length) {
        // exclude assigned ids
        const inList = assignedIds.map((id) => `'${id}'`).join(",");
        query = query.not("id", "in", `(${assignedIds.join(",")})`);
      }

      const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
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
          {OS_OPTIONS.map((o) => (
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
        <button onClick={() => openAddDevice()} className="pc-btn pc-btn-primary pc-btn-sm">
          <Plus className="w-3 h-3" /> Aggiungi dispositivo
        </button>
      </div>
      <div className="pc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["ID", "Seriale", "Modello", "OS", "Stato", "Cliente", "Utente", "Aggiornato"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                      style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ),
                )}
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
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-text3 text-sm">
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
