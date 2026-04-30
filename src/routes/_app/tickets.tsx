import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { openTicketDetail } from "@/lib/use-detail";
import { STATUS_META, type TicketStatus, type TicketPriority, PRIORITY_LABEL, CLIENTS, fmtDate } from "@/lib/pcready";
import { StatusBadge, PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_app/tickets")({
  validateSearch: (s: Record<string, unknown>) => ({ export: s.export === true || s.export === "true" }),
  head: () => ({ meta: [{ title: "Ticket PC — PCReady" }, { name: "description", content: "Lista dei ticket di preparazione PC con filtri avanzati." }] }),
  component: TicketsPage,
});

interface Row { id: string; ticket_code: string; client: string; model: string; serial: string | null;
  requester: string; priority: TicketPriority; status: TicketStatus; created_at: string;
  assignee?: { full_name: string; initials: string } | null; }

function TicketsPage() {
  const { refreshKey, search } = useTickets();
  const sp = useSearch({ from: "/_app/tickets" });
  const [rows, setRows] = useState<Row[]>([]);
  const [fs, setFs] = useState(""); const [fp, setFp] = useState(""); const [fc, setFc] = useState("");

  useEffect(() => {
    supabase.from("tickets").select("id, ticket_code, client, model, serial, requester, priority, status, created_at, assignee:profiles!tickets_assignee_id_fkey(full_name, initials)")
      .order("created_at", { ascending: false }).then(({ data }) => setRows((data ?? []) as any));
  }, [refreshKey]);

  const data = useMemo(() => rows.filter(t =>
    (!fs || t.status === fs) && (!fp || t.priority === fp) && (!fc || t.client === fc) &&
    (!search || (t.ticket_code + t.model + (t.serial || "") + t.requester).toLowerCase().includes(search.toLowerCase()))
  ), [rows, fs, fp, fc, search]);

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("PCReady — Ticket PC", 14, 18);
    doc.setFontSize(10); doc.text(new Date().toLocaleString("it-IT"), 14, 25);
    let y = 35;
    doc.setFontSize(9);
    data.forEach(t => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(`${t.ticket_code}  ${t.model}  [${STATUS_META[t.status].label}]  ${PRIORITY_LABEL[t.priority]}  ${t.client}`, 14, y);
      y += 6;
    });
    doc.save(`pcready-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF esportato");
  }
  useEffect(() => { if (sp.export) exportPdf(); /* eslint-disable-next-line */ }, [sp.export]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="pc-input max-w-[180px]" value={fs} onChange={e => setFs(e.target.value)}>
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="pc-input max-w-[160px]" value={fp} onChange={e => setFp(e.target.value)}>
          <option value="">Tutte le priorità</option>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="pc-input max-w-[200px]" value={fc} onChange={e => setFc(e.target.value)}>
          <option value="">Tutti i clienti</option>
          {CLIENTS.map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="ml-auto text-xs text-text3 font-mono">{data.length} risultati</span>
        <button onClick={exportPdf} className="pc-btn pc-btn-ghost pc-btn-sm">Esporta PDF</button>
      </div>

      <div className="pc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {["ID", "Modello", "Seriale", "Cliente", "Richiedente", "Priorità", "Stato", "Assegnatario", "Creato"].map(h =>
                <th key={h} className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                  style={{ background: "var(--surface2)", borderColor: "var(--border)" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(t => (
                <tr key={t.id} className="border-b cursor-pointer transition-colors hover:bg-surface2"
                  style={{ borderColor: "var(--border)" }} onClick={() => openTicketDetail(t.id)}>
                  <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">{t.ticket_code}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.model}</td>
                  <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">{t.serial || "—"}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.client}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.requester}</td>
                  <td className="px-[14px] py-[10px]"><PriorityLabel p={t.priority} /></td>
                  <td className="px-[14px] py-[10px]"><StatusBadge status={t.status} /></td>
                  <td className="px-[14px] py-[10px]"><AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} /></td>
                  <td className="px-[14px] py-[10px] text-[11px] text-text3">{fmtDate(t.created_at)}</td>
                </tr>
              ))}
              {!data.length && <tr><td colSpan={9} className="text-center py-10 text-text3 text-sm">Nessun ticket</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
