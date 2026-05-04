import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTickets } from "@/lib/use-tickets";
import { STATUS_META, type TicketStatus, fmtDateTime } from "@/lib/pcready";
import { StatusBadge, AssigneeChip } from "@/components/pcready/StatusBadge";
import { openTicketDetail } from "@/lib/use-detail";
import { TrendingUp, Activity, Boxes, Clock, CircleCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - PCReady" },
      {
        name: "description",
        content: "Panoramica ticket, pipeline e attivita recente in PCReady.",
      },
    ],
  }),
  component: DashboardPage,
});

interface T {
  id: string;
  ticket_code: string;
  client: string;
  model: string | null;
  status: TicketStatus;
  created_at: string;
  device?: { model: string; serial: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}
interface Log {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

function DashboardPage() {
  const { refreshKey, setPendingCount } = useTickets();
  const [tickets, setTickets] = useState<T[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [recentDevices, setRecentDevices] = useState<any[]>([]);
  const [devicesWithoutTicket, setDevicesWithoutTicket] = useState<any[]>([]);
  const [ticketsWithoutDeviceCount, setTicketsWithoutDeviceCount] = useState<number>(0);
  const [activeClientsCount, setActiveClientsCount] = useState<number>(0);
  const [trendDays, setTrendDays] = useState<number>(14);

  useEffect(() => {
    // fetch tickets, logs, devices in parallel
    Promise.all([
      supabase
        .from("tickets")
        .select(
          "id, ticket_code, client, model, status, created_at, device:devices(model, serial), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("id, type, message, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("devices")
        .select("id, model, serial, created_at, status, client_id, assigned_to")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("ticket_device_assignments").select("device_id").eq("unassigned_at", null),
    ]).then(([tRes, lRes, dRes, aRes]) => {
      const t = (tRes as any).data ?? [];
      const l = (lRes as any).data ?? [];
      const d = (dRes as any).data ?? [];
      const a = (aRes as any).data ?? [];
      setTickets(t as T[]);
      setLogs(l as Log[]);
      setDevices(d as any[]);
      setRecentDevices((d as any[]).slice(0, 6));

      const assignedIds = new Set((a as any[]).map((r) => r.device_id));
      setDevicesWithoutTicket((d as any[]).filter((dev) => !assignedIds.has(dev.id)));

      const withoutDevice = (t as any[]).filter((tt) => !tt.device && !tt.model).length;
      setTicketsWithoutDeviceCount(withoutDevice);

      // active clients = unique clients with tickets in last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const activeClients = new Set(
        (t as any[])
          .filter((tt) => tt.created_at >= since)
          .map((tt) => tt.client)
          .filter(Boolean),
      );
      setActiveClientsCount(activeClients.size);
    });
  }, [refreshKey]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, "in-progress": 0, testing: 0, ready: 0 };
    tickets.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
    });
    return c;
  }, [tickets]);

  useEffect(() => {
    setPendingCount(counts.pending || 0);
  }, [counts.pending, setPendingCount]);

  const total = tickets.length;
  const pipelineSteps: { label: string; status?: TicketStatus }[] = [
    { label: "Richiesta" },
    { label: "Assegnaz." },
    { label: "Setup OS", status: "in-progress" },
    { label: "Software", status: "in-progress" },
    { label: "Test", status: "testing" },
    { label: "QA", status: "testing" },
    { label: "Pronto", status: "ready" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Ticket totali"
          value={total}
          accent="var(--accent)"
          sub="totali"
          icon={<Boxes className="w-5 h-5" />}
        />
        <StatCard
          label="Dispositivi totali"
          value={devices.length}
          accent="var(--accent2)"
          sub="totali"
          icon={<Boxes className="w-5 h-5" />}
        />
        <StatCard
          label="Clienti attivi (30d)"
          value={activeClientsCount}
          accent="var(--purple)"
          sub="ultimi 30 giorni"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          label="In lavorazione"
          value={counts["in-progress"]}
          accent="var(--warn)"
          sub="attivi ora"
          valueColor="var(--accent)"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Pronti"
          value={counts.ready}
          accent="var(--success)"
          sub="da consegnare"
          valueColor="var(--success)"
          icon={<CircleCheck className="w-5 h-5" />}
        />
        <StatCard
          label="In attesa"
          value={counts.pending}
          accent="var(--purple)"
          sub="in coda"
          valueColor="var(--purple)"
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Panoramica dispositivi & ticket</h3>
          <div className="text-xs text-text3">Trend e widget di riepilogo</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text3">Periodo</span>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setTrendDays(d)}
              className={`pc-btn pc-btn-sm ${trendDays === d ? "pc-btn-primary" : "pc-btn-ghost"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Dispositivi senza ticket attivo</span>
            <span className="text-[11px] text-text3 font-mono">{devicesWithoutTicket.length}</span>
          </div>
          <div className="pc-card-body">
            <div className="flex items-center gap-3">
              <div className="text-[22px] font-bold">{devicesWithoutTicket.length}</div>
              <div className="flex-1">
                <AreaSpark data={computeDailyCounts(devices, "created_at", trendDays, (d) => d.status === "available")} color="#3b82f6" />
              </div>
              <Link to="/inventory" search={{ filter: "without_ticket" }} className="pc-btn pc-btn-ghost pc-btn-sm">
                Vedi dispositivi
              </Link>
            </div>
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Ticket senza dispositivo associato</span>
            <span className="text-[11px] text-text3 font-mono">{ticketsWithoutDeviceCount}</span>
          </div>
          <div className="pc-card-body">
            <div className="flex items-center gap-3">
              <div className="text-[22px] font-bold">{ticketsWithoutDeviceCount}</div>
              <div className="flex-1">
                <AreaSpark data={computeDailyCounts(tickets.filter((tt) => !tt.device && !tt.model), "created_at", trendDays)} color="#f97316" />
              </div>
              <Link to="/tickets" search={{ filter: "without_device" }} className="pc-btn pc-btn-ghost pc-btn-sm">
                Vedi ticket
              </Link>
            </div>
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Trend: Ticket aperti vs Asset disponibili</span>
            <span className="text-[11px] text-text3 font-mono">ultimi 14 giorni</span>
          </div>
          <div className="pc-card-body">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <AreaSparkMulti
                  series={[{
                    data: computeDailyCounts(tickets.filter((tt) => tt.status !== "ready"), "created_at", trendDays),
                    color: "#ef4444",
                    label: "Ticket aperti",
                  }, {
                    data: computeDailyCounts(devices.filter((d) => d.status === "available"), "created_at", trendDays),
                    color: "#10b981",
                    label: "Asset disponibili",
                  }]}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Ticket recenti</span>
            <Link
              to="/tickets"
              search={{ export: false }}
              className="pc-btn pc-btn-ghost pc-btn-sm"
            >
              Vedi tutti <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["ID", "Asset", "Stato", "Assegnatario"].map((h) => (
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
                {tickets.slice(0, 6).map((t) => (
                  <tr
                    key={t.id}
                    className="border-b cursor-pointer hover:bg-surface2 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => openTicketDetail(t.id)}
                  >
                    <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                      {t.ticket_code}
                    </td>
                    <td className="px-[14px] py-[10px] text-[12.5px]">
                      {deviceLabel(t)}
                      <div className="text-[11px] text-text3">{t.client}</div>
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-[14px] py-[10px]">
                      <AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} />
                    </td>
                  </tr>
                ))}
                {!tickets.length && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-text3 text-sm">
                      Nessun ticket. Creane uno con il pulsante in alto.
                    </td>
                  </tr>
                )}
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
            <Donut
              data={Object.entries(counts).map(([s, n]) => ({ status: s as TicketStatus, n }))}
              total={total}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Pipeline preparazione</span>
            <span className="text-[11px] text-text3 font-mono flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Flusso automatico
            </span>
          </div>
          <div className="px-[22px] py-[18px] flex items-center gap-0 overflow-x-auto">
            {pipelineSteps.map((s, i) => {
              const cnt = s.status ? counts[s.status] || 0 : 0;
              const done = !s.status;
              return (
                <div key={i} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-[5px] min-w-[78px]">
                    <div
                      className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[11px] font-bold font-mono border-2"
                      style={{
                        background: done
                          ? "var(--success-bg)"
                          : cnt
                            ? "var(--accent2)"
                            : "var(--surface)",
                        borderColor: done
                          ? "var(--success)"
                          : cnt
                            ? "var(--accent)"
                            : "var(--border2)",
                        color: done ? "var(--success)" : cnt ? "var(--accent)" : "var(--text3)",
                        boxShadow: cnt
                          ? "0 0 0 4px color-mix(in oklab, var(--accent) 15%, transparent)"
                          : undefined,
                      }}
                    >
                      {done ? "OK" : cnt}
                    </div>
                    <div
                      className="text-[10.5px] font-semibold"
                      style={{
                        color: done ? "var(--success)" : cnt ? "var(--accent)" : "var(--text3)",
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div
                      className="h-[2px] flex-1 min-w-[24px] max-w-[52px]"
                      style={{ background: done ? "var(--success)" : "var(--border2)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pc-card">
          <div className="pc-card-hd">
            <span className="pc-card-title">Attivita recente</span>
            <Link to="/automations" className="pc-btn pc-btn-ghost pc-btn-sm">
              Log completo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="pc-card-body">
            <div className="flex flex-col gap-[7px]">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-[10px] px-[12px] py-[10px] rounded-[7px] text-[12px]"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{
                      background:
                        l.type === "auto"
                          ? "var(--accent2)"
                          : l.type === "user"
                            ? "var(--success-bg)"
                            : "var(--surface3)",
                      color:
                        l.type === "auto"
                          ? "var(--accent)"
                          : l.type === "user"
                            ? "var(--success)"
                            : "var(--text3)",
                    }}
                  >
                    {l.type === "auto" ? "A" : l.type === "user" ? "U" : "-"}
                  </span>
                  <span className="flex-1 text-text2">{l.message}</span>
                  <span className="text-[10.5px] text-text3 font-mono whitespace-nowrap">
                    {fmtDateTime(l.created_at)}
                  </span>
                </div>
              ))}
              {!logs.length && (
                <div className="text-center text-text3 text-sm py-4">Nessuna attivita</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  accent: string;
  sub: string;
  valueColor?: string;
  icon: ReactNode;
}

function StatCard({ label, value, accent, sub, valueColor, icon }: StatCardProps) {
  return (
    <div className="pc-stat" style={{ borderLeft: `3px solid ${accent}` }}>
      <div
        className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center opacity-15"
        style={{ background: accent, color: accent }}
      >
        {icon}
      </div>
      <div className="pc-stat-lbl">{label}</div>
      <div className="pc-stat-val" style={{ color: valueColor || "inherit" }}>
        {value}
      </div>
      <div className="pc-stat-sub">{sub}</div>
    </div>
  );
}

function Donut({ data, total }: { data: { status: TicketStatus; n: number }[]; total: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="flex items-center gap-6">
      <div className="relative" style={{ width: 110, height: 110 }}>
        <svg width={110} height={110} viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={55} cy={55} r={r} fill="none" stroke="var(--surface3)" strokeWidth={14} />
          {total > 0 &&
            data
              .filter((d) => d.n > 0)
              .map((d) => {
                const len = (d.n / total) * c;
                const seg = (
                  <circle
                    key={d.status}
                    cx={55}
                    cy={55}
                    r={r}
                    fill="none"
                    stroke={STATUS_META[d.status].color}
                    strokeWidth={14}
                    strokeDasharray={`${len} ${c}`}
                    strokeDashoffset={-off}
                  />
                );
                off += len;
                return seg;
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div
            className="text-[22px] font-bold leading-none"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {total}
          </div>
          <div className="text-[10px] text-text3 uppercase tracking-wider">Ticket</div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2 text-[12px]">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: STATUS_META[d.status].color }}
            />
            <span className="flex-1 text-text2">{STATUS_META[d.status].label}</span>
            <span className="font-mono text-text3">{d.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function deviceLabel(ticket: T) {
  return ticket.device?.model || ticket.model || "Nessun asset";
}

function computeDailyCounts(items: any[], dateKey: string, days = 14, filter?: (it: any) => boolean) {
  const res = new Array(days).fill(0);
  const now = new Date();
  for (const it of items) {
    if (filter && !filter(it)) continue;
    const d = new Date(it[dateKey]);
    if (isNaN(d.getTime())) continue;
    const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
    if (diff >= 0 && diff < days) {
      // index 0 = oldest day (days-1 days ago) -> res[days-1-diff]
      res[days - 1 - diff] += 1;
    }
  }
  return res;
}

function AreaSpark({ data, color = "#3b82f6" }: { data: number[]; color?: string }) {
  const w = 160;
  const h = 48;
  const max = Math.max(...data, 1);
  const step = w / Math.max(1, data.length - 1);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`).join(" ");
  const area = `${data.map((v, i) => `${i * step} ${h - (v / max) * h}`).join(" L ")}`;
  const [hover, setHover] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / w) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <path d={`M0 ${h} L ${area} L ${w} ${h} Z`} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {hover !== null && (
        <g>
          <circle cx={hover * step} cy={h - (data[hover!] / max) * h} r={3} fill={color} />
          <text x={hover * step} y={10} fontSize={10} textAnchor="middle" fill={color}>
            {data[hover!]}
          </text>
        </g>
      )}
    </svg>
  );
}

function AreaSparkMulti({ series }: { series: { data: number[]; color: string; label?: string }[] }) {
  const w = 260;
  const h = 64;
  const length = series[0]?.data.length || 1;
  const max = Math.max(...series.flatMap((s) => s.data), 1);
  const step = w / Math.max(1, length - 1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / w) * (length - 1));
    setHoverIdx(Math.max(0, Math.min(length - 1, idx)));
  }
  return (
    <div style={{ position: "relative" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        {series.map((s, si) => {
          const path = s.data.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`).join(" ");
          return <path key={si} d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />;
        })}
        {hoverIdx !== null && (
          <line x1={hoverIdx * step} x2={hoverIdx * step} y1={0} y2={h} stroke="#000" strokeOpacity={0.06} />
        )}
      </svg>
      {hoverIdx !== null && (
        <div className="absolute" style={{ right: 6, top: 6, background: "var(--surface2)", border: "1px solid var(--border)", padding: 8, borderRadius: 6 }}>
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span style={{ width: 10, height: 6, background: s.color, display: "inline-block" }} />
              <span className="text-text2">{s.label}</span>
              <span className="font-mono text-text3 ml-2">{s.data[hoverIdx]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
