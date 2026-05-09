import {
  STATUS_META,
  type TicketStatus,
  PRIORITY_LABEL,
  type TicketPriority,
  avatarColors,
  TICKET_TYPE_META,
  type TicketType,
} from "@/lib/pcready";

export function StatusBadge({ status }: { status: TicketStatus }) {
  const m = STATUS_META[status];
  return <span className={`pc-badge ${m.cls}`}>{m.label}</span>;
}

export function PriorityLabel({ p }: { p: TicketPriority }) {
  return <span className={`pc-pri-${p}`}>{PRIORITY_LABEL[p]}</span>;
}

export function TicketTypeBadge({ type }: { type: TicketType }) {
  const meta = TICKET_TYPE_META[type];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>;
}

export function AssigneeChip({ initials, name }: { initials?: string | null; name?: string | null }) {
  if (!initials || !name) return <span className="text-text3 text-xs">—</span>;
  const c = avatarColors(initials);
  return (
    <span className="pc-chip">
      <span className="pc-chip-ava" style={{ background: c.bg, color: c.fg }}>{initials}</span>
      {name}
    </span>
  );
}
