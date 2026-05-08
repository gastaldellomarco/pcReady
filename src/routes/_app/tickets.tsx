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
import { Eye, FileDown } from "lucide-react";
import { TicketListPdf, type TicketPdfRow } from "@/components/pcready/pdf/TicketListPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import { AsyncAutocomplete, type AsyncAutocompleteOption } from "@/components/pcready/AsyncAutocomplete";

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
  requester: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  client_ref?: { name: string } | null;
  device?: { model: string; serial: string | null; os: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}

const PAGE_SIZE = 50;

function TicketsPage() {
  const { refreshKey, search } = useTickets();
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedClient, setSelectedClient] = useState<AsyncAutocompleteOption | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [fs, setFs] = useState("");
  const [fp, setFp] = useState("");
  const [fc, setFc] = useState("");
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);

  useEffect(() => {
    let query = supabase
      .from("tickets")
      .select(
        "id, ticket_code, client, client_id, requester, priority, status, created_at, client_ref:clients(name), device:devices(model, serial, os), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (fs) query = query.eq("status", fs as TicketStatus);
    if (fp) query = query.eq("priority", fp as TicketPriority);
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
  const ticketModel = (t: Row) => t.device?.model || "Nessun asset";
  const ticketSerial = (t: Row) => t.device?.serial || null;

  async function loadClientOptions(query: string): Promise<AsyncAutocompleteOption[]> {
    let request = supabase.from("clients").select("id, name, company_name, email").order("name");
    const term = query.trim().replace(/[,%]/g, "");
    if (term) {
      request = request.or(`name.ilike.%${term}%,company_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const { data, error } = await request.range(0, 19);
    if (error) {
      toast.error(error.message);
      return [];
    }
    return (data ?? []).map((client) => ({
      value: client.id,
      label: client.company_name || client.name,
      description: client.email,
    }));
  }

  function pdfRows(): TicketPdfRow[] {
    return data.map((t) => ({
      ticket_code: t.ticket_code,
      model: ticketModel(t),
      serial: ticketSerial(t),
      client: ticketClient(t),
      requester: t.requester,
      priority: t.priority,
      status: t.status,
      assignee: t.assignee?.full_name || null,
      created_at: t.created_at,
    }));
  }

  async function exportPdf() {
    if (!data.length) return toast.error("Nessun ticket da esportare");
    setPdfBusy("download");
    try {
      await downloadPdf(
        <TicketListPdf rows={pdfRows()} />,
        `pcready-ticket-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("PDF ticket esportato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore esportazione PDF"));
    } finally {
      setPdfBusy(null);
    }
  }

  async function openPdfPreview() {
    if (!data.length) return toast.error("Nessun ticket da visualizzare");
    setPdfBusy("preview");
    try {
      await previewPdf(<TicketListPdf rows={pdfRows()} />);
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
        <AsyncAutocomplete
          className="w-[220px]"
          value={fc}
          selectedOption={selectedClient}
          placeholder="Tutti i clienti"
          emptyLabel="Nessun cliente"
          loadOptions={loadClientOptions}
          onChange={(value, option) => {
            setFc(value);
            setSelectedClient(option);
          }}
        />
        <span className="ml-auto text-xs text-text3 font-mono">
          {total
            ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + data.length} di ${total}`
            : "0 risultati"}
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
