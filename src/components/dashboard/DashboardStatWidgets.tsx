import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { STATUS_META, type TicketStatus } from "@/lib/pcready";

import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  accent: string;
  sub: string;
  valueColor?: string;
  icon: ReactNode;
  href?: string;
  highlight?: boolean;
}

/**
 *
 */
export function DashboardStatCard({
  label,
  value,
  accent,
  sub,
  valueColor,
  icon,
  href,
  highlight,
}: StatCardProps) {
  const inner = (
    <div
      className={`pc-stat ${href ? "hover:opacity-95 cursor-pointer transition-all" : ""}`}
      style={{
        borderLeft: `3px solid ${accent}`,
        boxShadow: highlight
          ? `0 0 0 2px color-mix(in oklab, ${accent} 14%, transparent)`
          : undefined,
      }}
    >
      <div
        className="absolute right-4 top-4 size-8 rounded-lg flex items-center justify-center opacity-15"
        style={{ background: accent, color: accent }}
      >
        {icon}
      </div>
      <div className="pc-stat-lbl break-anywhere pr-10">{label}</div>
      <div className="pc-stat-val break-anywhere pr-8" style={{ color: valueColor || "inherit" }}>
        {value}
      </div>
      <div className="pc-stat-sub break-anywhere">{sub}</div>
    </div>
  );

  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

/**
 *
 */
export function DashboardDonut({
  data,
  total,
  hideLegend = false,
}: {
  data: { status: TicketStatus; n: number }[];
  total: number;
  hideLegend?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const [hovered, setHovered] = useState<TicketStatus | null>(null);

  const segments = useMemo(() => {
    if (total <= 0) return [] as Array<{
      status: TicketStatus;
      n: number;
      pct: number;
      len: number;
      offset: number;
    }>;
    const r = 38;
    const c = 2 * Math.PI * r;
    let off = 0;
    const out: Array<{ status: TicketStatus; n: number; pct: number; len: number; offset: number }> = [];
    for (const d of data) {
      if (d.n <= 0) continue;
      const pct = (d.n / total) * 100;
      const len = (pct / 100) * c;
      out.push({ status: d.status, n: d.n, pct, len, offset: off });
      off += len;
    }
    return out;
  }, [data, total]);

  const r = 38;
  const c = 2 * Math.PI * r;

  const hoveredSegment = hovered ? segments.find((s) => s.status === hovered) : null;

  const svg = (
    <div className="relative" style={{ width: 110, height: 110 }}>
      <svg
        width={110}
        height={110}
        viewBox="0 0 110 110"
        style={{ transform: "rotate(-90deg)" }}
        onMouseLeave={() => setHovered(null)}
        role="img"
        aria-label={`${t("stats.ticket", "Ticket")}: ${total}`}
      >
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--surface3)" strokeWidth={14} />
        {segments.map((seg) => {
          const dim = hovered !== null && hovered !== seg.status;
          const localizedLabel = t(`dashboard:status.${seg.status}`, STATUS_META[seg.status].label);
          return (
            <circle
              key={seg.status}
              cx={55}
              cy={55}
              r={r}
              fill="none"
              stroke={STATUS_META[seg.status].color}
              strokeWidth={14}
              strokeDasharray={`${seg.len} ${c}`}
              strokeDashoffset={seg.offset}
              style={{
                cursor: "pointer",
                transition: "stroke-opacity 120ms ease-out, filter 120ms ease-out",
                strokeOpacity: dim ? 0.45 : 1,
                filter:
                  hovered === seg.status
                    ? `drop-shadow(0 0 4px ${STATUS_META[seg.status].color})`
                    : undefined,
              }}
              onMouseEnter={() => setHovered(seg.status)}
              onFocus={() => setHovered(seg.status)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              role="button"
              aria-label={`${localizedLabel}: ${seg.n} (${seg.pct.toFixed(1)}%)`}
            >
              <title>{`${localizedLabel}: ${seg.n} (${seg.pct.toFixed(1)}%)`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <div
          className="text-[22px] font-bold leading-none"
          style={{ fontFamily: "var(--font-head)" }}
        >
          {hoveredSegment ? hoveredSegment.n : total}
        </div>
        <div className="text-[10px] text-text3 uppercase tracking-wider">
          {hoveredSegment
            ? t(`dashboard:status.${hoveredSegment.status}`, STATUS_META[hoveredSegment.status].label)
            : t("stats.ticket", "Ticket")}
        </div>
      </div>
      {hoveredSegment && (
        <div
          role="tooltip"
          aria-live="polite"
          className="absolute left-1/2 top-full -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-lg border bg-background shadow-xl text-[11px] whitespace-nowrap pointer-events-none z-10"
          style={{
            borderColor: STATUS_META[hoveredSegment.status].color,
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ background: STATUS_META[hoveredSegment.status].color }}
            />
            <span className="font-medium">
              {t(`dashboard:status.${hoveredSegment.status}`, STATUS_META[hoveredSegment.status].label)}
            </span>
            <span className="font-mono text-text2">{hoveredSegment.n}</span>
            <span className="text-text3 font-mono">{hoveredSegment.pct.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );

  if (hideLegend) {
    return svg;
  }

  return (
    <div className="flex items-center gap-6">
      {svg}
      <div className="flex-1 flex flex-col gap-2">
        {data.map((d) => {
          const pct = total > 0 ? (d.n / total) * 100 : 0;
          const isHovered = hovered === d.status;
          return (
            <div
              key={d.status}
              className="flex items-center gap-2 text-[12px] cursor-pointer rounded px-1 -mx-1 hover:bg-surface2"
              onMouseEnter={() => setHovered(d.status)}
              onMouseLeave={() => setHovered(null)}
              style={{ background: isHovered ? "var(--surface2)" : undefined }}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: STATUS_META[d.status].color }}
              />
              <span className="flex-1 text-text2">
                {t(`dashboard:status.${d.status}`, STATUS_META[d.status].label)}
              </span>
              <span className="font-mono text-text3">{d.n}</span>
              <span className="font-mono text-text3 w-10 text-right">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 *
 */
export function DashboardAreaSpark({
  data,
  labels,
  color = "#3b82f6",
  yLabel,
}: {
  data: number[];
  /** Optional labels matching each data point (oldest -> newest). */
  labels?: string[];
  color?: string;
  yLabel?: string;
}) {
  const w = 160;
  const h = 48;
  const max = Math.max(...data, 1);
  const step = w / Math.max(1, data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`)
    .join(" ");
  const area = `${data.map((v, i) => `${i * step} ${h - (v / max) * h}`).join(" L ")}`;
  const [hover, setHover] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / w) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }
  const tooltipLabel = hover != null ? labels?.[hover] ?? "" : "";
  const tooltipValue = hover != null ? data[hover] : 0;
  return (
    <div className="relative w-full" style={{ maxWidth: w, height: h }}>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <path d={`M0 ${h} L ${area} L ${w} ${h} Z`} fill={color} opacity={0.12} />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover !== null && (
          <g>
            <line x1={hover * step} x2={hover * step} y1={0} y2={h} stroke={color} strokeOpacity={0.35} strokeDasharray="3 3" />
            <circle cx={hover * step} cy={h - (data[hover] / max) * h} r={3} fill={color} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full -mt-1.5 px-2 py-1 rounded-md border border-border/50 bg-background text-foreground shadow-md text-[11px] whitespace-nowrap pointer-events-none z-10"
        >
          <div className="flex items-center gap-2 font-mono">
            {tooltipLabel && <span className="text-text3">{tooltipLabel}</span>}
            <span className="font-medium" style={{ color }}>
              {yLabel ? `${tooltipValue} ${yLabel}` : tooltipValue}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 *
 */
export function DashboardAreaSparkMulti({
  series,
  labels,
}: {
  series: { data: number[]; color: string; label?: string }[];
  /** Optional labels matching each data point (oldest -> newest). */
  labels?: string[];
}) {
  const w = 260;
  const h = 64;
  const length = series[0]?.data.length || 1;
  const max = Math.max(...series.flatMap((s) => s.data), 1);
  const step = w / Math.max(1, length - 1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / w) * (length - 1));
    setHoverIdx(Math.max(0, Math.min(length - 1, idx)));
  }
  const tooltipLabel = hoverIdx != null ? labels?.[hoverIdx] ?? "" : "";
  return (
    <div style={{ position: "relative" }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {series.map((s, si) => {
          const path = s.data
            .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`)
            .join(" ");
          return (
            <path
              key={s.label || si}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />
          );
        })}
        {hoverIdx !== null && (
          <line
            x1={hoverIdx * step}
            x2={hoverIdx * step}
            y1={0}
            y2={h}
            stroke="#000"
            strokeOpacity={0.18}
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {hoverIdx !== null && (
        <div
          role="tooltip"
          className="absolute"
          style={{
            left: Math.max(0, Math.min(hoverIdx * step + 12, w - 160)),
            top: 6,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: 8,
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            minWidth: 140,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {tooltipLabel && (
            <div className="text-[10.5px] uppercase tracking-wider text-text3 font-mono mb-1.5">
              {tooltipLabel}
            </div>
          )}
          {series.map((s, i) => (
            <div key={s.label || s.color || String(i)} className="flex items-center gap-2 text-[12px]">
              <span
                style={{ width: 10, height: 6, background: s.color, display: "inline-block" }}
              />
              <span className="text-text2 flex-1">{s.label}</span>
              <span className="font-mono text-text3 ml-2">{s.data[hoverIdx]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
