import type { AdminUserRow } from "@/lib/admin-users";

function fmtElapsed(value: string | null) {
  if (!value) return "in attesa";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} g`;
}

export function AdminUserStatusBadge({
  status,
  invitedAt,
  busy,
  onResend,
}: {
  status: AdminUserRow["status"];
  invitedAt?: string | null;
  busy?: boolean;
  onResend?: () => void;
}) {
  if (status === "invited") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span
          className="pc-badge"
          style={{
            background: "var(--warning-bg, #FEF3C7)",
            color: "var(--warning, #D97706)",
          }}
        >
          Invitato da {fmtElapsed(invitedAt ?? null)}
        </span>
        {onResend && (
          <button
            type="button"
            className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={onResend}
          >
            Re-invia invito
          </button>
        )}
      </div>
    );
  }

  const active = status === "active";
  return (
    <span
      className="pc-badge"
      style={{
        background: active ? "var(--success-bg)" : "var(--danger-bg)",
        color: active ? "var(--success)" : "var(--danger)",
      }}
    >
      {active ? "Attivo" : "Disabilitato"}
    </span>
  );
}
