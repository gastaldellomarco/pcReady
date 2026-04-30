import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketStatus, fmtDateTime } from "@/lib/pcready";
import { StatusBadge, AssigneeChip } from "@/components/pcready/StatusBadge";
import { openTicketDetail } from "@/lib/use-detail";
import { TrendingUp, Activity, Boxes, Clock, CircleCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — PCReady" },
      { name: "description", content: "Panoramica ticket, pipeline e attività recente in PCReady." },
    ],
  }),
  component: DashboardPage,
});

interface T { id: string; ticket_code: string; client: string; model: string; status: TicketStatus;
  created_at: string; assignee?: { full_name: string; initials: string } | null; }
interface Log { id: string; type: string; message: string; created_at: string; }

function DashboardPage() {
  const { refreshKey, setPendingCount } = useTickets();
  const [tickets, setTickets] = useState<T[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    supabase.from("tickets").select("id, ticket_code, client, model, status, created_at, assignee:profiles!tickets_assignee_id_fkey(full_name, initials)")
      .order("created_at", { ascending: false }).then(({ data }) => setTickets((data ?? []) as any));
    supabase.from("activity_log").select("id, type, message, created_at")
      .order("created_at", { ascending: false }).limit(6).then(({ data }) => setLogs((data ?? []) as any));
  }, [refreshKey]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, "in-progress": 0, testing: 0, ready: 0 };
    tickets.forEach(t => { c[t.status] = (c[t.status] || 0) + 1; });
    return c;
  }, [tickets]);

  useEffect(() => { setPendingCount(counts.pending || 0); }, [counts.pending, setPendingCount]);

  const total = tickets.length;
  const pipelineSteps: { label: string; status?: TicketStatus }[] = [
    { label: "Richiesta" }, { label: "Assegnaz." },
    { label: "Setup OS", status: "in-progress" },
    { label: "Software", status: "in-progress" },
    { label: "Test", status: "testing" },
    { label: "QA", status: "testing" },
    { label: "Pronto", status: "ready" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard label="Ticket totali" value={total} accent="var(--accent)" sub="totali" icon={<Boxes className="w-5 h-5" />} />
        <StatCard label="In lavorazione" value={counts["in-progress"]} accent="var(--warn)" sub="attivi ora" valueColor="var(--accent)" icon={<Clock className="w-5 h-5" />} />
        <StatCard label="Pronti" value={counts.ready} accent="var(--success)" sub="da consegnare" valueColor="var(--success)" icon={<CircleCheck className="w-5 h-5" />} />
        <StatCard label="In attesa" value={counts.pending} accent="var(--purple)" sub="in coda" valueColor="var(--purple)" icon={<Activity className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Ticket recenti</span>
            <Link to="/tickets" search={{ export: false }} className="pc-btn pc-btn-ghost pc-btn-sm">Vedi tutti <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {["ID", "Dispositivo", "Stato", "Assegnatario"].map(h =>
                  <th key={h} className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {tickets.slice(0, 6).map(t => (
                  <tr key={t.id} className="border-b cursor-pointer hover:bg-surface2 transition-colors"
                    style={{ borderColor: "var(--border)" }} onClick={() => openTicketDetail(t.id)}>
                    <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">{t.ticket_code}</td>
                    <td className="px-[14px] py-[10px] text-[12.5px]">{t.model}<div className="text-[11px] text-text3">{t.client}</div></td>
                    <td className="px-[14px] py-[10px]"><StatusBadge status={t.status} /></td>
                    <td className="px-[14px] py-[10px]"><AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} /></td>
                  </tr>
                ))}
                {!tickets.length && <tr><td colSpan={4} className="text-center py-8 text-text3 text-sm">Nessun ticket. Creane uno con il pulsante in alto.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Distribuzione stati</span>
            <span className="text-[11px] text-text3 font-mono">{total} totali</span>
          </div>
          <div className="pc-card-body">
            <Donut data={Object.entries(counts).map(([s, n]) => ({ status: s as TicketStatus, n }))} total={total} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Pipeline preparazione</span>
            <span className="text-[11px] text-text3 font-mono flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Flusso automatico</span>
          </div>
          <div className="px-[22px] py-[18px] flex items-center gap-0 overflow-x-auto">
            {pipelineSteps.map((s, i) => {
              const cnt = s.status ? counts[s.status] || 0 : 0;
              const done = !s.status;
              return (
                <div key={i} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-[5px] min-w-[78px]">
                    <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold font-mono border-2"
                      style={{
                        background: done ? "var(--success-bg)" : cnt ? "var(--accent2)" : "var(--surface)",
                        borderColor: done ? "var(--success)" : cnt ? "var(--accent)" : "var(--border2)",
                        color: done ? "var(--success)" : cnt ? "var(--accent)" : "var(--text3)",
                        boxShadow: cnt ? "0 0 0 4px color-mix(in oklab, var(--accent) 15%, transparent)" : undefined,
                      }}>{done ? "✓" : cnt}</div>
                    <div className="text-[10.5px] font-semibold"
                      style={{ color: done ? "var(--success)" : cnt ? "var(--accent)" : "var(--text3)" }}>{s.label}</div>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div className="h-[2px] flex-1 min-w-[24px] max-w-[52px]"
                      style={{ background: done ? "var(--success)" : "var(--border2)" }}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Attività recente</span>
            <Link to="/automations" className="pc-btn pc-btn-ghost pc-btn-sm">Log completo <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="pc-card-body">
            <div className="flex flex-col gap-[7px]">
              {logs.map(l => (
                <div key={l.id} className="flex items-start gap-[10px] px-[12px] py-[10px] rounded-[7px] text-[12px]"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background: l.type === "auto" ? "var(--accent2)" : l.type === "user" ? "var(--success-bg)" : "var(--surface3)",
                      color: l.type === "auto" ? "var(--accent)" : l.type === "user" ? "var(--success)" : "var(--text3)",
                    }}>{l.type === "auto" ? "⚡" : l.type === "user" ? "👤" : "•"}</span>
                  <span className="flex-1 text-text2">{l.message}</span>
                  <span className="text-[10.5px] text-text3 font-mono whitespace-nowrap">{fmtDateTime(l.created_at)}</span>
                </div>
              ))}
              {!logs.length && <div className="text-center text-text3 text-sm py-4">Nessuna attività</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, sub, valueColor, icon }: any) {
  return (
    <div className="pc-stat" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center opacity-15"
        style={{ background: accent, color: accent }}>{icon}</div>
      <div className="pc-stat-lbl">{label}</div>
      <div className="pc-stat-val" style={{ color: valueColor || "inherit" }}>{value}</div>
      <div className="pc-stat-sub">{sub}</div>
    </div>
  );
}

function Donut({ data, total }: { data: { status: TicketStatus; n: number }[]; total: number }) {
  const r = 38, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: 110, height: 110 }}>
        <svg width={110} height={110} viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={55} cy={55} r={r} fill="none" stroke="var(--surface3)" strokeWidth={14}/>
          {total > 0 && data.filter(d => d.n > 0).map(d => {
            const len = (d.n / total) * c;
            const seg = <circle key={d.status} cx={55} cy={55} r={r} fill="none" stroke={STATUS_META[d.status].color}
              strokeWidth={14} strokeDasharray={`${len} ${c}`} strokeDashoffset={-off} />;
            off += len; return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[22px] font-bold leading-none" style={{ fontFamily: "var(--font-head)" }}>{total}</div>
          <div className="text-[10px] text-text3 uppercase tracking-wider">Ticket</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {data.map(d => (
          <div key={d.status} className="flex items-center gap-2 text-[12px]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_META[d.status].color }}/>
            <span className="flex-1 text-text2">{STATUS_META[d.status].label}</span>
            <span className="font-mono text-text3">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
