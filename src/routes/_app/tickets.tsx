import { createFileRoute, Link } from "@tanstack/react-router";
import { TableSkeletonRows } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useTickets } from "@/lib/use-tickets";
import { loadClientOptions, useTicketsList } from "@/lib/queries/tickets";
import { useAuth } from "@/lib/auth-context";
import { openTicketDetail } from "@/lib/use-detail";
import {
  STATUS_META,
  type TicketStatus,
  type TicketPriority,
  type TicketType,
  PRIORITY_LABEL,
  TICKET_TYPE_LABEL,
  fmtDate,
} from "@/lib/pcready";
import {
  StatusBadge,
  PriorityLabel,
  AssigneeChip,
  TicketTypeBadge,
} from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import { Eye, FileDown } from "lucide-react";
import { TicketListPdf, type TicketPdfRow } from "@/components/pcready/pdf/TicketListPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import { getPublicAppSettings } from "@/lib/app-settings";
import {
  AsyncAutocomplete,
  type AsyncAutocompleteOption,
} from "@/components/pcready/AsyncAutocomplete";

export const Route = createFileRoute("/_app/tickets")({
  head: () => ({
    meta: [
      { title: "Ticket PC - PCReady" },
      { name: "description", content: "Lista dei ticket di preparazione PC con filtri avanzati." },
    ],
  }),
  component: TicketsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

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
  client_ref?: { name: string } | null;
  device?: { model: string; serial: string | null; os: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}

const PAGE_SIZE = 50;

function TicketsPage() {
  const { search } = useTickets();
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedClient, setSelectedClient] = useState<AsyncAutocompleteOption | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [fs, setFs] = useState("");
  const [fp, setFp] = useState("");
  const [ft, setFt] = useState("");
  const [fc, setFc] = useState("");
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const [hasUpdates, setHasUpdates] = useState(false);
  const loadSettings = useServerFn(getPublicAppSettings);
  const listQuery = useTicketsList({
    status: fs || undefined,
    priority: fp || undefined,
    ticket_type: ft || undefined,
    client_id: fc || undefined,
    q: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.data as Row[]);
      setTotal(listQuery.data.count ?? 0);
    }
  }, [listQuery.data]);

  useEffect(() => {
    // Read initial status filter from URL query param `status` (e.g. /_app/tickets?status=pending)
    try {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get("status");
      if (statusParam) setFs(statusParam);
    } catch {
      /* ignore in non-browser contexts */
    }
  }, [fs, fp, ft, fc, search, page]);

  useEffect(() => {
    setPage(0);
  }, [fs, fp, ft, fc, search]);

  useEffect(() => {
    const channel = supabase
      .channel("tickets-list-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () =>
        setHasUpdates(true),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const data = rows;
  const listLoading = listQuery.isLoading;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ticketClient = (t: Row) => t.client_ref?.name || t.client || "-";
  const ticketModel = (t: Row) => t.device?.model || "Nessun asset";
  const ticketSerial = (t: Row) => t.device?.serial || null;

  // useTicketsList provides a loadClientOptions helper as well
  async function loadClientOptsWrapper(q: string) {
    try {
      const data = await loadClientOptions(q);
      return (data ?? []).map((client: any) => ({
        value: client.id,
        label: client.company_name || client.name,
        description: client.email,
      }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento clienti");
      return [];
    }
  }

  function pdfRows(): TicketPdfRow[] {
    return data.map((t) => ({
      ticket_code: t.ticket_code,
      model: ticketModel(t),
      serial: ticketSerial(t),
      client: ticketClient(t),
      requester: t.requester,
      ticket_type: t.ticket_type,
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
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      const org = settings?.organization_name;
      await downloadPdf(
        <TicketListPdf rows={pdfRows()} organizationName={org} />,
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
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      const org = settings?.organization_name;
      await previewPdf(<TicketListPdf rows={pdfRows()} organizationName={org} />);
    } catch (error) {
      toast.error(errorMessage(error, "Errore anteprima PDF"));
    } finally {
      setPdfBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {hasUpdates ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            background: "color-mix(in oklab, var(--accent) 8%, var(--surface1))",
            borderColor: "var(--border)",
          }}
        >
          <span className="text-text2">Sono disponibili aggiornamenti alla lista ticket.</span>
          <button
            type="button"
            className="pc-btn pc-btn-primary pc-btn-sm shrink-0"
            onClick={() => {
              void listQuery.refetch().then(() => setHasUpdates(false));
            }}
          >
            Aggiorna
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="pc-input max-w-[180px]"
          value={fs}
          onChange={(e) => setFs(e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_META)
            .filter(([k]) => k !== "archived")
            .map(([k, v]) => (
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
          className="pc-input max-w-[190px]"
          value={ft}
          onChange={(e) => setFt(e.target.value)}
        >
          <option value="">Tutti i tipi</option>
          {Object.entries(TICKET_TYPE_LABEL).map(([k, v]) => (
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
          loadOptions={loadClientOptsWrapper}
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
        <Link to="/tickets/archive" className="pc-btn pc-btn-ghost pc-btn-sm">
          Storico
        </Link>
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
                  "Tipo",
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
              {listLoading ? (
                <TableSkeletonRows rows={12} columns={10} cellClassName="px-[14px] py-[10px]" />
              ) : (
                <>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={t.status} />
                        </div>
                      </td>
                      <td className="px-[14px] py-[10px]">
                        <TicketTypeBadge type={t.ticket_type} />
                      </td>
                      <td className="px-[14px] py-[10px]">
                        <AssigneeChip
                          initials={t.assignee?.initials}
                          name={t.assignee?.full_name}
                        />
                      </td>
                      <td className="px-[14px] py-[10px] text-[11px] text-text3">
                        {fmtDate(t.created_at)}
                      </td>
                    </tr>
                  ))}
                  {!data.length && (
                    <tr>
                      <td colSpan={10} className="text-center py-10 text-text3 text-sm">
                        Nessun ticket
                      </td>
                    </tr>
                  )}
                </>
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
