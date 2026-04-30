import { STATUS_META, type TicketStatus, PRIORITY_LABEL, type TicketPriority, avatarColors } from "@/lib/pcready";

export function StatusBadge({ status }: { status: TicketStatus }) {
  const m = STATUS_META[status];
  return <span className={`pc-badge ${m.cls}`}>{m.label}</span>;
}

export function PriorityLabel({ p }: { p: TicketPriority }) {
  return <span className={`pc-pri-${p}`}>{PRIORITY_LABEL[p]}</span>;
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
