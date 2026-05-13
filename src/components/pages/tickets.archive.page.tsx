import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { openTicketDetail } from "@/lib/use-detail";
import { type TicketStatus, type TicketPriority, type TicketType, fmtDate } from "@/lib/pcready";
import { StatusBadge, PriorityLabel, AssigneeChip, TicketTypeBadge } from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import { Eye, RotateCw } from "lucide-react";

interface Row {
  id: string;
  ticket_code: string;
  client: string | null;
  client_id: string | null;
  requester: string;
  ticket_type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  completed_at?: string | null;
  client_ref?: { name: string } | null;
  device?: { model: string; serial: string | null; os: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}

const PAGE_SIZE = 50;

export default function TicketsArchivePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const q = supabase
      .from("tickets")
      .select(
        "id, ticket_code, client, client_id, requester, ticket_type, priority, status, created_at, completed_at, client_ref:clients(name), device:devices(model, serial, os), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)",
        { count: "exact" },
      )
      .eq("status", "archived" as any)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    q.then(({ data, count, error }) => {
      if (error) {
        toast.error(error.message);
        return;
      }
      try {
        // debug: log how many rows the archive query returned
        // eslint-disable-next-line no-console
        console.debug("TicketsArchive: rows fetched", Array.isArray(data) ? data.length : 0);
        // debug: show a small sample of returned rows and their statuses
        if (Array.isArray(data)) {
          // eslint-disable-next-line no-console
          console.debug(
            "TicketsArchive: data sample",
            data.slice(0, 10).map((r: any) => ({ id: r.id, ticket_code: r.ticket_code, status: r.status })),
          );
          // eslint-disable-next-line no-console
          console.debug(
            "TicketsArchive: statuses",
            Array.from(new Set((data as any[]).map((r) => r.status))).slice(0, 20),
          );
        }
      } catch {}
      setRows((data ?? []) as unknown as Row[]);
      setTotal(count ?? 0);
    });
  }, [page]);

  async function reopen(id: string) {
    try {
      const { error } = await supabase.from("tickets").update({ status: "pending" }).eq("id", id);
      if (error) throw error;
      await supabase.from("ticket_status_history").insert({
        ticket_id: id,
        from_status: "archived",
        to_status: "pending",
        changed_by: null,
        changed_at: new Date().toISOString(),
        note: "Riaperto da archivio",
      });
      toast.success("Ticket riaperto");
      // refresh list
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(err?.message || "Errore riapertura ticket");
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Storico ticket</h2>
        <span className="ml-auto text-xs text-text3 font-mono">{total} risultati</span>
      </div>

      <div className="pc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {[
                  "Codice",
                  "Modello",
                  "Seriale",
                  "Cliente",
                  "Richiedente",
                  "Priorita",
                  "Stato",
                  "Tipo",
                  "Assegnatario",
                  "Creato",
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
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b cursor-pointer transition-colors hover:bg-surface2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">{t.ticket_code}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.device?.model || "Nessun asset"}</td>
                  <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">{t.device?.serial || "-"}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.client_ref?.name || t.client || "-"}</td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{t.requester}</td>
                  <td className="px-[14px] py-[10px]"><PriorityLabel p={t.priority} /></td>
                  <td className="px-[14px] py-[10px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={t.status} />
                    </div>
                  </td>
                  <td className="px-[14px] py-[10px]"><TicketTypeBadge type={t.ticket_type} /></td>
                  <td className="px-[14px] py-[10px]"><AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} /></td>
                  <td className="px-[14px] py-[10px] text-[11px] text-text3">{fmtDate(t.created_at)}</td>
                  <td className="px-[14px] py-[10px]">
                    <div className="flex items-center gap-2">
                      <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => openTicketDetail(t.id)}>
                        <Eye className="w-3 h-3" /> Dettagli
                      </button>
                      <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={() => reopen(t.id)}>
                        <RotateCw className="w-3 h-3" /> Riapri
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-text3 text-sm">
                    Nessun ticket archiviato
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Precedente
        </button>
        <span className="text-xs text-text3 font-mono">Pagina {page + 1} di {pageCount}</span>
        <button className="pc-btn pc-btn-ghost pc-btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
          Successiva
        </button>
      </div>
    </div>
  );
}
