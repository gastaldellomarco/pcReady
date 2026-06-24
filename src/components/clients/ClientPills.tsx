import i18n from "@/i18n";
import { CalendarDays, HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";
import OverflowTable from "@/components/ui/overflow-table";

// ── Types ──

type DeviceRowStatus = "available" | "assigned" | "maintenance" | "retired";

type ContactRow = {
  id: string;
  client_id: string;
  full_name: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  is_primary: boolean;
  notes: string | null;
  is_starred: boolean | null;
  private_note: string | null;
  availability_status: string | null;
  return_date: string | null;
  group_id: string | null;
};

type DeviceRow = {
  id: string;
  asset_tag: string | null;
  model: string;
  serial: string | null;
  os: string | null;
  status: DeviceRowStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

// ── Small Metric Pill ──

export function SmallMetric({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "danger" | "muted";
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
      style={{
        background: tone === "danger" ? "var(--badge-danger-bg)" : "var(--surface2)",
        borderColor: tone === "danger" ? "var(--badge-danger-border)" : "transparent",
        color: tone === "danger" ? "var(--badge-danger-fg)" : "var(--text3)",
      }}
    >
      {icon}
      {label}
    </span>
  );
}

// ── Header Counter ──

export function HeaderCounter({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border px-3 py-2 text-left"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      onClick={onClick}
    >
      <div className="font-mono text-sm font-bold">{value}</div>
      <div className="text-[10.5px] uppercase text-text3">{label}</div>
    </button>
  );
}

// ── Responsive Table ──

export function ResponsiveTable({
  headers,
  rows,
  empty,
  emptyAction,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
  emptyAction?: React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div
        className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-md border text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="text-sm text-text3">{empty}</div>
        {emptyAction}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
      <OverflowTable>
        <table className="w-full text-[12.5px]">
          <thead style={{ background: "var(--surface2)" }}>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, rowIndex) => (
              <tr key={rowIndex} className="border-t" style={{ borderColor: "var(--border)" }}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 align-middle text-text2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </OverflowTable>
    </div>
  );
}

// ── Portal Badge ──

export function PortalBadge({ active }: { active: boolean }) {
  const { t } = useTranslation("clients");
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{
        background: active ? "rgba(22, 163, 74, .12)" : "var(--surface2)",
        color: active ? "#15803d" : "var(--text3)",
      }}
    >
      {active ? t("portal.active", "Attivo") : t("portal.noAccess", "Nessun accesso")}
    </span>
  );
}

// ── Status Pill ──

export function StatusPill({ value }: { value: string }) {
  const { t } = useTranslation("clients");
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: {
      label: t("statusPill.pending", "In attesa"),
      color: "#92400e",
      bg: "rgba(245, 158, 11, .14)",
    },
    "in-progress": {
      label: t("statusPill.inProgress", "In corso"),
      color: "#1d4ed8",
      bg: "rgba(37, 99, 235, .12)",
    },
    testing: {
      label: t("statusPill.testing", "Test"),
      color: "#7c3aed",
      bg: "rgba(124, 58, 237, .12)",
    },
    ready: {
      label: t("statusPill.ready", "Pronto"),
      color: "#15803d",
      bg: "rgba(22, 163, 74, .12)",
    },
    completed: {
      label: t("statusPill.completed", "Completato"),
      color: "#166534",
      bg: "rgba(22, 101, 52, .12)",
    },
    archived: {
      label: t("statusPill.archived", "Archiviato"),
      color: "var(--text3)",
      bg: "var(--surface2)",
    },
  };
  const meta = map[value] ?? { label: value, color: "var(--text3)", bg: "var(--surface2)" };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ color: meta.color, background: meta.bg }}
    >
      {meta.label}
    </span>
  );
}

// ── Priority Pill ──

export function PriorityPill({ value }: { value: string }) {
  const { t } = useTranslation("clients");
  const label =
    value === "high"
      ? t("priority.high", "Alta")
      : value === "med"
        ? t("priority.medium", "Media")
        : value === "low"
          ? t("priority.low", "Bassa")
          : value;
  return (
    <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10.5px] font-bold text-text3">
      {label}
    </span>
  );
}

// ── Device Status Pill ──

export function DeviceStatusPill({ status }: { status: DeviceRowStatus }) {
  const { t } = useTranslation("clients");
  const map = {
    available: [t("deviceStatus.available", "Disponibile"), "#15803d", "rgba(22, 163, 74, .12)"],
    assigned: [t("deviceStatus.assigned", "Assegnato"), "#1d4ed8", "rgba(37, 99, 235, .12)"],
    maintenance: [
      t("deviceStatus.maintenance", "Manutenzione"),
      "#92400e",
      "rgba(245, 158, 11, .14)",
    ],
    retired: [t("deviceStatus.retired", "Dismesso"), "var(--text3)", "var(--surface2)"],
  } as const;
  const [label, color, bg] = map[status] ?? map.available;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  );
}

// ── Device Summary ──

export function DeviceSummary({ devices }: { devices: DeviceRow[] }) {
  const { t } = useTranslation("clients");
  const count = (status: DeviceRowStatus) =>
    devices.filter((device) => device.status === status).length;
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.available", {
          defaultValue: "Disponibili: {{count}}",
          count: count("available"),
        })}
      />
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.assigned", {
          defaultValue: "Assegnati: {{count}}",
          count: count("assigned"),
        })}
      />
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.maintenance", {
          defaultValue: "Manutenzione: {{count}}",
          count: count("maintenance"),
        })}
      />
      <SmallMetric
        tone="muted"
        icon={<HardDrive className="h-3 w-3" />}
        label={t("deviceSummary.retired", {
          defaultValue: "Dismessi: {{count}}",
          count: count("retired"),
        })}
      />
    </div>
  );
}

// ── Contact Availability Badge ──

export function contactAvailabilityBadge(contact: ContactRow) {
  const status = contact.availability_status;
  const returnDate = contact.return_date;
  if (!status) return null;

  const now = new Date();
  if (returnDate) {
    const ret = new Date(returnDate);
    if (ret < now) return null;
  }

  const config: Record<string, { label: string; color: string }> = {
    vacation: { label: i18n.t("contacts.availabilityVacation", "In ferie"), color: "#F59E0B" },
    sick_leave: { label: i18n.t("contacts.availabilitySick", "In malattia"), color: "#EF4444" },
    unavailable: { label: i18n.t("contacts.availabilityUnavailable", "Non disp."), color: "#6B7280" },
    available: { label: i18n.t("contacts.availabilityAvailable", "Disponibile"), color: "#22C55E" },
  };
  const cfg = config[status];
  if (!cfg) return null;

  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
      }}
      title={returnDate ? i18n.t("contacts.returnsOn", { defaultValue: "Rientro il {{date}}", date: returnDate }) : undefined}
    >
      <CalendarDays className="size-2.5" />
      {cfg.label}
    </span>
  );
}
