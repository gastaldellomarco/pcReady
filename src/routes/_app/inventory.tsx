import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketStatus, fmtDate } from "@/lib/pcready";
import { StatusBadge } from "@/components/pcready/StatusBadge";
import { openTicketDetail } from "@/lib/use-detail";
import { Plus, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventario — PCReady" }, { name: "description", content: "Inventario completo dei dispositivi gestiti, con seriali e stato." }] }),
  component: InventoryPage,
});

interface Row { id: string; serial: string | null; model: string; os: string | null;
  status: TicketStatus; client: string; updated_at: string; end_user: string | null; ticket_code: string; }

function InventoryPage() {
  const { refreshKey, openCreate } = useTickets();
  const [rows, setRows] = useState<Row[]>([]);
  const [fs, setFs] = useState(""); const [fos, setFos] = useState(""); const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("tickets").select("id, ticket_code, serial, model, os, status, client, updated_at, end_user")
      .order("updated_at", { ascending: false }).then(({ data }) => setRows((data ?? []) as any));
  }, [refreshKey]);

  const oss = Array.from(new Set(rows.map(r => r.os).filter(Boolean))) as string[];
  const data = useMemo(() => rows.filter(r =>
    (!fs || r.status === fs) && (!fos || r.os === fos) &&
    (!q || ((r.serial || "") + r.model + r.client + (r.end_user || "")).toLowerCase().includes(q.toLowerCase()))
  ), [rows, fs, fos, q]);

  function exportPdf() {
    if (!data.length) return toast.error("Nessun dispositivo da esportare");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // ---------- Header ----------
    doc.setFillColor(27, 79, 216); // accent
    doc.rect(0, 0, pageW, 70, "F");

    // Logo block
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(40, 20, 30, 30, 4, 4, "F");
    doc.setFillColor(27, 79, 216);
    doc.rect(46, 26, 7, 7, "F"); doc.rect(57, 26, 7, 7, "F");
    doc.rect(46, 37, 7, 7, "F"); doc.rect(57, 37, 7, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PCReady", 82, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Inventario dispositivi", 82, 54);

    // Right meta
    doc.setFontSize(9);
    const dateStr = new Date().toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
    doc.text(dateStr, pageW - 40, 38, { align: "right" });
    doc.text(`${data.length} dispositivi`, pageW - 40, 54, { align: "right" });

    // ---------- Stats strip ----------
    const counts: Record<string, number> = { pending: 0, "in-progress": 0, testing: 0, ready: 0 };
    data.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    const stats = [
      { label: "In attesa", v: counts.pending, c: [239, 152, 39] },
      { label: "In lavorazione", v: counts["in-progress"], c: [27, 79, 216] },
      { label: "Testing", v: counts.testing, c: [124, 58, 237] },
      { label: "Pronti", v: counts.ready, c: [22, 163, 74] },
    ] as const;
    const sw = (pageW - 80 - 30) / 4;
    stats.forEach((s, i) => {
      const x = 40 + i * (sw + 10);
      doc.setFillColor(248, 247, 244); // surface2
      doc.roundedRect(x, 90, sw, 50, 6, 6, "F");
      doc.setFillColor(s.c[0], s.c[1], s.c[2]);
      doc.rect(x, 90, 3, 50, "F");
      doc.setTextColor(120, 116, 110);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(s.label.toUpperCase(), x + 12, 105);
      doc.setTextColor(s.c[0], s.c[1], s.c[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(String(s.v), x + 12, 130);
    });

    // ---------- Table ----------
    autoTable(doc, {
      startY: 160,
      head: [["ID", "Modello", "Seriale", "OS", "Stato", "Cliente", "Utente", "Aggiornato"]],
      body: data.map(r => [
        r.ticket_code,
        r.model,
        r.serial || "—",
        r.os || "—",
        STATUS_META[r.status].label,
        r.client,
        r.end_user || "—",
        fmtDate(r.updated_at),
      ]),
      styles: {
        font: "helvetica", fontSize: 9, cellPadding: 7,
        textColor: [40, 38, 35], lineColor: [232, 228, 220], lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [40, 38, 35], textColor: [255, 255, 255],
        fontStyle: "bold", fontSize: 8, cellPadding: 8,
      },
      alternateRowStyles: { fillColor: [250, 249, 246] },
      columnStyles: {
        0: { font: "courier", fontSize: 8, textColor: [120, 116, 110], cellWidth: 70 },
        2: { font: "courier", fontSize: 8, textColor: [120, 116, 110] },
        4: { fontStyle: "bold" },
      },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 4) {
          const s = data[d.row.index]?.status;
          if (s) {
            const col = STATUS_META[s].color;
            const r = parseInt(col.slice(1, 3), 16);
            const g = parseInt(col.slice(3, 5), 16);
            const b = parseInt(col.slice(5, 7), 16);
            d.cell.styles.textColor = [r, g, b];
          }
        }
      },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(160, 156, 150);
        doc.setFont("helvetica", "normal");
        const pageNum = (doc as any).internal.getNumberOfPages();
        const cur = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.text("PCReady · Inventario dispositivi", 40, pageH - 20);
        doc.text(`Pagina ${cur} di ${pageNum}`, pageW - 40, pageH - 20, { align: "right" });
      },
    });

    doc.save(`pcready-inventario-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF inventario esportato");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="pc-input max-w-[160px]" value={fs} onChange={e => setFs(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="pc-input max-w-[200px]" value={fos} onChange={e => setFos(e.target.value)}>
          <option value="">Tutti gli OS</option>
          {oss.map(o => <option key={o}>{o}</option>)}
        </select>
        <input className="pc-input max-w-[260px]" placeholder="Cerca seriale, modello, utente..." value={q} onChange={e => setQ(e.target.value)} />
        <span className="ml-auto self-center text-xs text-text3 font-mono">{data.length} dispositivi</span>
        <button onClick={exportPdf} className="pc-btn pc-btn-ghost pc-btn-sm">
          <FileDown className="w-3 h-3" /> Esporta PDF
        </button>
        <button onClick={() => openCreate()} className="pc-btn pc-btn-primary pc-btn-sm">
          <Plus className="w-3 h-3" /> Aggiungi dispositivo
        </button>
      </div>
      <div className="pc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {["ID", "Seriale", "Modello", "OS", "Stato", "Cliente", "Utente", "Aggiornato"].map(h =>
                <th key={h} className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                  style={{ background: "var(--surface2)", borderColor: "var(--border)" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(r => (
                <tr key={r.id} className="border-b cursor-pointer hover:bg-surface2 transition-colors"
                  style={{ borderColor: "var(--border)" }} onClick={() => openTicketDetail(r.id)}>
                  <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">{r.ticket_code}</td>
                  <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">{r.serial || "—"}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{r.model}</td>
                  <td className="px-[14px] py-[10px] text-[12px] text-text2">{r.os || "—"}</td>
                  <td className="px-[14px] py-[10px]"><StatusBadge status={r.status} /></td>
                  <td className="px-[14px] py-[10px] text-[12px]">{r.client}</td>
                  <td className="px-[14px] py-[10px] text-[12px]">{r.end_user || "—"}</td>
                  <td className="px-[14px] py-[10px] text-[11px] text-text3">{fmtDate(r.updated_at)}</td>
                </tr>
              ))}
              {!data.length && (
                <tr><td colSpan={8} className="text-center py-12 text-text3 text-sm">
                  Nessun dispositivo. Clicca <b>“Aggiungi dispositivo”</b> per iniziare.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
