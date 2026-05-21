import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";

import { STATUS_META, type TicketStatus } from "@/lib/pcready";

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
        className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center opacity-15"
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

export function DashboardDonut({
  data,
  total,
  hideLegend = false,
}: {
  data: { status: TicketStatus; n: number }[];
  total: number;
  hideLegend?: boolean;
}) {
  const r = 38;
  const c = 2 * Math.PI * r;
  let off = 0;
  const segments =
    total > 0
      ? data
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
          })
      : [];

  const svg = (
    <div className="relative" style={{ width: 110, height: 110 }}>
      <svg width={110} height={110} viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--surface3)" strokeWidth={14} />
        {segments}
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
  );

  if (hideLegend) {
    return svg;
  }

  return (
    <div className="flex items-center gap-6">
      {svg}
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

export function DashboardAreaSpark({
  data,
  color = "#3b82f6",
}: {
  data: number[];
  color?: string;
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
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.round((x / w) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }
  return (
    <svg
      width={w}
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
          <circle cx={hover * step} cy={h - (data[hover!] / max) * h} r={3} fill={color} />
          <text x={hover * step} y={10} fontSize={10} textAnchor="middle" fill={color}>
            {data[hover!]}
          </text>
        </g>
      )}
    </svg>
  );
}

export function DashboardAreaSparkMulti({
  series,
}: {
  series: { data: number[]; color: string; label?: string }[];
}) {
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
              key={si}
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
            strokeOpacity={0.06}
          />
        )}
      </svg>
      {hoverIdx !== null && (
        <div
          className="absolute"
          style={{
            right: 6,
            top: 6,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            padding: 8,
            borderRadius: 6,
          }}
        >
          {series.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span
                style={{ width: 10, height: 6, background: s.color, display: "inline-block" }}
              />
              <span className="text-text2">{s.label}</span>
              <span className="font-mono text-text3 ml-2">{s.data[hoverIdx]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
