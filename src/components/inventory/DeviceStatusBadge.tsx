import { useTranslation } from "react-i18next";
import { pcReadyColors } from "@/lib/design-system";

export type DeviceStatus = "available" | "assigned" | "maintenance" | "retired";

export const DEVICE_STATUS_META: Record<
  DeviceStatus,
  { label: string; color: string }
> = {
  available: { label: "Disponibile", color: pcReadyColors.success },
  assigned: { label: "Assegnato", color: pcReadyColors.primary },
  maintenance: { label: "Manutenzione", color: pcReadyColors.warning },
  retired: { label: "Dismesso", color: pcReadyColors.textSecondary },
};

export function DeviceStatusBadge({
  deviceId,
  status,
  hasActiveAssignment,
  saving,
  onStatusChange,
}: {
  deviceId: string;
  status: DeviceStatus;
  hasActiveAssignment: boolean;
  saving: boolean;
  onStatusChange: (id: string, next: DeviceStatus) => void | Promise<void>;
}) {
  const { t } = useTranslation("inventory");
  const meta = DEVICE_STATUS_META[status];
  const readOnlyAssigned = hasActiveAssignment && status === "assigned";

  if (readOnlyAssigned) {
    return (
      <span
        className="pc-badge"
        title={t(
          "details.readOnlyAssigned",
          "Assegnazione ticket attiva: per coerenza modifica lo stato dal flusso ticket.",
        )}
        style={{ color: meta.color, background: `${meta.color}26` }}
      >
        {t("status." + status, meta.label)}
      </span>
    );
  }

  return (
    <div
      className="pc-badge max-w-[155px]"
      style={{
        color: meta.color,
        background: `${meta.color}26`,
        borderColor: `color-mix(in oklab, ${meta.color} 24%, transparent)`,
        opacity: saving ? 0.6 : 1,
        cursor: saving ? "wait" : "pointer",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <select
        aria-label={t("columns.status", "Stato dispositivo")}
        className="bg-transparent border-0 p-0 min-w-0"
        style={{ color: "inherit", font: "inherit", fontSize: "12px" }}
        value={status}
        disabled={saving}
        onChange={(event) => {
          const next = event.target.value as DeviceStatus;
          void onStatusChange(deviceId, next);
        }}
      >
        {(Object.entries(DEVICE_STATUS_META) as [DeviceStatus, { label: string }][]).map(
          ([key, v]) => (
            <option key={key} value={key}>
              {t("status." + key, v.label)}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
