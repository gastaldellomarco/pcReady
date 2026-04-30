import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { openTicketDetail } from "@/lib/use-detail";
import {
  STATUS_META,
  type TicketStatus,
  type TicketPriority,
  PRIORITY_LABEL,
  fmtDate,
} from "@/lib/pcready";
import { StatusBadge, PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_app/tickets")({
  head: () => ({
    meta: [
      { title: "Ticket PC - PCReady" },
      { name: "description", content: "Lista dei ticket di preparazione PC con filtri avanzati." },
    ],
  }),
  component: TicketsPage,
});

interface Row {
  id: string;
  ticket_code: string;
  client: string | null;
  client_id: string | null;
  model: string | null;
  serial: string | null;
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  client_ref?: { name: string } | null;
  device?: { model: string; serial: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}

interface ClientOpt {
  id: string;
  name: string;
}

const PAGE_SIZE = 50;

function TicketsPage() {
  const { refreshKey, search } = useTickets();
  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [fs, setFs] = useState("");
  const [fp, setFp] = useState("");
  const [fc, setFc] = useState("");

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, name")
      .order("name")
      .then(({ data }) => setClients((data ?? []) as ClientOpt[]));
  }, [refreshKey]);

  useEffect(() => {
    let query = supabase
      .from("tickets")
      .select(
        "id, ticket_code, client, client_id, model, serial, requester, priority, status, created_at, client_ref:clients(name), device:devices(model, serial), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (fs) query = query.eq("status", fs);
    if (fp) query = query.eq("priority", fp);
    if (fc) query = query.eq("client_id", fc);
    const q = search.trim().replace(/[,%]/g, "");
    if (q) {
      query = query.or(`ticket_code.ilike.%${q}%,requester.ilike.%${q}%`);
    }

    query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1).then(({ data, count, error }) => {
      if (error) {
        toast.error(error.message);
        return;
      }
      const totalRows = count ?? 0;
      if (page > 0 && page * PAGE_SIZE >= totalRows) {
        setPage(0);
        return;
      }
      setRows((data ?? []) as unknown as Row[]);
      setTotal(totalRows);
    });
  }, [refreshKey, fs, fp, fc, search, page]);

  useEffect(() => {
    setPage(0);
  }, [fs, fp, fc, search]);

  const data = rows;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ticketClient = (t: Row) => t.client_ref?.name || t.client || "-";
  const ticketModel = (t: Row) => t.device?.model || t.model || "-";
  const ticketSerial = (t: Row) => t.device?.serial || t.serial || null;

  function exportPdf() {
    if (!data.length) return toast.error("Nessun ticket da esportare");

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const priorityColors: Record<TicketPriority, [number, number, number]> = {
      high: [220, 38, 38],
      med: [239, 152, 39],
      low: [22, 163, 74],
    };

    doc.setFillColor(27, 79, 216);
    doc.rect(0, 0, pageW, 70, "F");

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(40, 20, 30, 30, 4, 4, "F");
    doc.setFillColor(27, 79, 216);
    doc.rect(46, 26, 7, 7, "F");
    doc.rect(57, 26, 7, 7, "F");
    doc.rect(46, 37, 7, 7, "F");
    doc.rect(57, 37, 7, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PCReady", 82, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Ticket PC", 82, 54);

    doc.setFontSize(9);
    const dateStr = new Date().toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
    doc.text(dateStr, pageW - 40, 38, { align: "right" });
    doc.text(`${data.length} ticket`, pageW - 40, 54, { align: "right" });

    const priorityCounts: Record<TicketPriority, number> = { high: 0, med: 0, low: 0 };
    data.forEach((t) => {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
    });
    const stats = [
      { label: PRIORITY_LABEL.high, v: priorityCounts.high, c: priorityColors.high },
      { label: PRIORITY_LABEL.med, v: priorityCounts.med, c: priorityColors.med },
      { label: PRIORITY_LABEL.low, v: priorityCounts.low, c: priorityColors.low },
    ] as const;
    const sw = (pageW - 80 - 20) / 3;
    stats.forEach((s, i) => {
      const x = 40 + i * (sw + 10);
      doc.setFillColor(248, 247, 244);
      doc.roundedRect(x, 90, sw, 50, 6, 6, "F");
      doc.setFillColor(s.c[0], s.c[1], s.c[2]);
      doc.rect(x, 90, 3, 50, "F");
      doc.setTextColor(120, 116, 110);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`PRIORITA ${s.label}`.toUpperCase(), x + 12, 105);
      doc.setTextColor(s.c[0], s.c[1], s.c[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(String(s.v), x + 12, 130);
    });

    autoTable(doc, {
      startY: 160,
      head: [
        [
          "ID",
          "Modello",
          "Seriale",
          "Cliente",
          "Richiedente",
          "Priorita",
          "Stato",
          "Assegnatario",
          "Creato",
        ],
      ],
      body: data.map((t) => [
        t.ticket_code,
        ticketModel(t),
        ticketSerial(t) || "-",
        ticketClient(t),
        t.requester,
        PRIORITY_LABEL[t.priority],
        STATUS_META[t.status].label,
        t.assignee?.full_name || "Non assegnato",
        fmtDate(t.created_at),
      ]),
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 6,
        textColor: [40, 38, 35],
        lineColor: [232, 228, 220],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [40, 38, 35],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 7,
      },
      alternateRowStyles: { fillColor: [250, 249, 246] },
      columnStyles: {
        0: { font: "courier", fontSize: 8, textColor: [120, 116, 110], cellWidth: 68 },
        2: { font: "courier", fontSize: 8, textColor: [120, 116, 110], cellWidth: 70 },
        5: { fontStyle: "bold", cellWidth: 54 },
        6: { fontStyle: "bold", cellWidth: 72 },
        8: { cellWidth: 54 },
      },
      didParseCell: (d) => {
        if (d.section !== "body") return;
        const row = data[d.row.index];
        if (!row) return;
        if (d.column.index === 5) {
          d.cell.styles.textColor = priorityColors[row.priority];
        }
        if (d.column.index === 6) {
          const col = STATUS_META[row.status].color;
          const r = parseInt(col.slice(1, 3), 16);
          const g = parseInt(col.slice(3, 5), 16);
          const b = parseInt(col.slice(5, 7), 16);
          d.cell.styles.textColor = [r, g, b];
        }
      },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.setTextColor(160, 156, 150);
        doc.setFont("helvetica", "normal");
        const pageNum = doc.getNumberOfPages();
        const cur = doc.getCurrentPageInfo().pageNumber;
        doc.text("PCReady - Ticket PC", 40, pageH - 20);
        doc.text(`Pagina ${cur} di ${pageNum}`, pageW - 40, pageH - 20, { align: "right" });
      },
    });

    doc.save(`pcready-ticket-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF ticket esportato");
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="pc-input max-w-[180px]"
          value={fs}
          onChange={(e) => setFs(e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          className="pc-input max-w-[160px]"
          value={fp}
          onChange={(e) => setFp(e.target.value)}
        >
          <option value="">Tutte le priorita</option>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="pc-input max-w-[200px]"
          value={fc}
          onChange={(e) => setFc(e.target.value)}
        >
          <option value="">Tutti i clienti</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-text3 font-mono">
          {total
            ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + data.length} di ${total}`
            : "0 risultati"}
        </span>
        <button onClick={exportPdf} className="pc-btn pc-btn-ghost pc-btn-sm">
          Esporta PDF
        </button>
      </div>

      <div className="pc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[
                  "ID",
                  "Modello",
                  "Seriale",
                  "Cliente",
                  "Richiedente",
                  "Priorita",
                  "Stato",
                  "Assegnatario",
                  "Creato",
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
              {data.map((t) => (
                <tr
                  key={t.id}
                  className="border-b cursor-pointer transition-colors hover:bg-surface2"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() => openTicketDetail(t.id)}
                >
                  <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                    {t.ticket_code}
                  </td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{ticketModel(t)}</td>
                  <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">
                    {ticketSerial(t) || "-"}
                  </td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{ticketClient(t)}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.requester}</td>
                  <td className="px-[14px] py-[10px]">
                    <PriorityLabel p={t.priority} />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} />
                  </td>
                  <td className="px-[14px] py-[10px] text-[11px] text-text3">
                    {fmtDate(t.created_at)}
                  </td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-text3 text-sm">
                    Nessun ticket
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
