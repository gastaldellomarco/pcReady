import { createFileRoute, Link } from "@tanstack/react-router";
import { TableSkeletonRows, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useTickets } from "@/lib/use-tickets";
import { loadClientOptions, useTicketsList } from "@/lib/queries/tickets";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
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
  fmtDateTime,
  formatOpenDuration,
  computeSlaStatus,
  type SlaLimits,
  DEFAULT_SLA_LIMITS,
} from "@/lib/pcready";
import {
  StatusBadge,
  PriorityLabel,
  AssigneeChip,
  TicketTypeBadge,
} from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import { Eye, FileDown, ArrowUpDown } from "lucide-react";
import { TicketListPdf, type TicketPdfRow } from "@/components/pcready/pdf/TicketListPdf";
import { downloadPdf, previewPdf } from "@/components/pcready/pdf/export";
import { getPublicAppSettings } from "@/lib/app-settings";
import { buildDownloadFileName } from "@/lib/downloads";
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
  assignee_id: string | null;
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
  const [fa, setFa] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "priority" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits>(DEFAULT_SLA_LIMITS);
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const [hasUpdates, setHasUpdates] = useState(false);
  const loadSettings = useServerFn(getPublicAppSettings);
  const loadTechnicians = useServerFn(listTechnicians);
  const listQuery = useTicketsList({
    status: fs || undefined,
    priority: fp || undefined,
    ticket_type: ft || undefined,
    client_id: fc || undefined,
    assignee_id: fa || undefined,
    q: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
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
  }, [fs, fp, ft, fc, fa, dateFrom, dateTo, sortBy, sortDir, search]);

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

  // Load technicians list for assignee filter
  useEffect(() => {
    if (session?.access_token) {
      loadTechnicians({ data: { accessToken: session.access_token } })
        .then(setTechnicians)
        .catch(() => {});
    }
  }, [session?.access_token, loadTechnicians]);

  // Load SLA limits from public settings
  useEffect(() => {
    if (session?.access_token) {
      loadSettings({ data: { accessToken: session.access_token } })
        .then((settings) => {
          if (settings?.sla_limits) setSlaLimits(settings.sla_limits);
        })
        .catch(() => {});
    }
  }, [session?.access_token, loadSettings]);

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
        buildDownloadFileName("pcready-ticket", "pdf", { dated: true }),
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
        <input
          type="date"
          className="pc-input max-w-[155px]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="Data inizio"
        />
        <input
          type="date"
          className="pc-input max-w-[155px]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Data fine"
        />
        <select
          className="pc-input max-w-[180px]"
          value={fa}
          onChange={(e) => setFa(e.target.value)}
        >
          <option value="">Tutti i tecnici</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
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

      {listQuery.isError ? (
        <PageFetchError
          message="Impossibile caricare i ticket. Controlla la connessione e riprova."
          onRetry={() => listQuery.refetch()}
        />
      ) : (
        <div className="pc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    { key: "id", label: "ID", sortable: false },
                    { key: "model", label: "Modello", sortable: false },
                    { key: "serial", label: "Seriale", sortable: false },
                    { key: "client", label: "Cliente", sortable: false },
                    { key: "requester", label: "Richiedente", sortable: false },
                    { key: "priority", label: "Priorita", sortable: true },
                    { key: "status", label: "Stato", sortable: true },
                    { key: "type", label: "Tipo", sortable: false },
                    { key: "assignee", label: "Assegnatario", sortable: false },
                    { key: "created_at", label: "Creato", sortable: true },
                    { key: "time_open", label: "Tempo aperto", sortable: false },
                  ].map((h) => (
                    <th
                      key={h.key}
                      className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b select-none"
                      style={{
                        background: "var(--surface2)",
                        borderColor: "var(--border)",
                        cursor: h.sortable ? "pointer" : undefined,
                      }}
                      onClick={
                        h.sortable
                          ? () => {
                              const col = h.key as "created_at" | "priority" | "status";
                              if (sortBy === col) {
                                setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                              } else {
                                setSortBy(col);
                                setSortDir("desc");
                              }
                            }
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.label}
                        {h.sortable && sortBy === h.key ? (
                          sortDir === "desc" ? (
                            <span className="text-[10px]">&#9660;</span>
                          ) : (
                            <span className="text-[10px]">&#9650;</span>
                          )
                        ) : h.sortable ? (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
                        ) : null}
                      </span>
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
                        <td
                          className="px-[14px] py-[10px] text-[11px] text-text3"
                          title={fmtDateTime(t.created_at)}
                        >
                          {fmtDate(t.created_at)}
                        </td>
                        <td className="px-[14px] py-[10px]">
                          <TimeOpenBadge
                            created_at={t.created_at}
                            priority={t.priority}
                            slaLimits={slaLimits}
                          />
                        </td>
                      </tr>
                    ))}
                    {!data.length && (
                      <tr>
                        <td colSpan={11} className="text-center py-10 text-text3 text-sm">
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
    </div>
  );
}

function TimeOpenBadge({
  created_at,
  priority,
  slaLimits,
}: {
  created_at: string;
  priority: TicketPriority;
  slaLimits?: SlaLimits;
}) {
  const sla = computeSlaStatus(created_at, priority, slaLimits);
  const created = new Date(created_at);
  const hoursOpen = (Date.now() - created.getTime()) / (1000 * 60 * 60);

  let bg: string;
  let fg: string;
  let label: string;
  if (sla.status === "overdue") {
    bg = "#FEE2E2";
    fg = "#991B1B";
    label = "SLA scaduto";
  } else if (hoursOpen > 72) {
    bg = "#FEF2F2";
    fg = "#DC2626";
    label = "> 3gg";
  } else if (hoursOpen > 24) {
    bg = "#FEF3C7";
    fg = "#92400E";
    label = "1-3gg";
  } else {
    bg = "#D1FAE5";
    fg = "#065F46";
    label = "< 24h";
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
      title={`Creato: ${fmtDateTime(created_at)}`}
    >
      {formatOpenDuration(created_at)}
      <span className="opacity-70">({label})</span>
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
