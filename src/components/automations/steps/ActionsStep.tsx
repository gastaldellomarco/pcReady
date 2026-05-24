import { useTranslation } from "react-i18next";
import { NOTIFICATION_TYPES } from "@/lib/notifications";
import type { ActionDef, ActionType } from "@/types/automation";

function uid(prefix = "a") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function defaultConfigForType(type: string): Record<string, unknown> {
  switch (type) {
    case "send_email":
      return { to: "", subject: "", body: "", is_html: false };
    case "update_ticket_status":
      return { ticket_id: "", status: "ready" };
    case "create_notification":
      return { user_id: "", type: "ticket_status_changed", title: "", body: "", link: "" };
    case "update_device_status":
      return { device_id: "", status: "available" };
    case "assign_ticket":
      return { ticket_id: "", assignee_id: "" };
    default:
      return {};
  }
}

export default function ActionsStep({
  value,
  onChange,
}: {
  value: ActionDef[];
  onChange: (v: ActionDef[]) => void;
}) {
  const { t } = useTranslation("automations");

  const ACTION_TYPES = [
    { value: "send_email", label: t("actions.types.send_email", "Send email") },
    { value: "update_ticket_status", label: t("actions.types.update_ticket_status", "Update ticket status") },
    { value: "create_notification", label: t("actions.types.create_notification", "In-app notification") },
    { value: "update_device_status", label: t("actions.types.update_device_status", "Update device status") },
    { value: "assign_ticket", label: t("actions.types.assign_ticket", "Assign ticket") },
  ] as const;

  const TICKET_STATUSES = [
    { value: "pending", label: t("actions.ticketStatus.statuses.pending", "Pending") },
    { value: "in-progress", label: t("actions.ticketStatus.statuses.in-progress", "In progress") },
    { value: "testing", label: t("actions.ticketStatus.statuses.testing", "Testing") },
    { value: "ready", label: t("actions.ticketStatus.statuses.ready", "Ready") },
  ] as const;

  const DEVICE_STATUSES = [
    { value: "available", label: t("actions.deviceStatus.statuses.available", "Available") },
    { value: "assigned", label: t("actions.deviceStatus.statuses.assigned", "Assigned") },
    { value: "maintenance", label: t("actions.deviceStatus.statuses.maintenance", "Maintenance") },
    { value: "retired", label: t("actions.deviceStatus.statuses.retired", "Retired") },
  ] as const;

  const addAction = () => {
    onChange([
      ...(value || []),
      { id: uid(), type: "send_email", config: defaultConfigForType("send_email") },
    ]);
  };

  function updateConfig(id: string, configPatch: Record<string, unknown>) {
    onChange(
      (value || []).map((c) =>
        c.id === id ? { ...c, config: { ...c.config, ...configPatch } } : c,
      ),
    );
  }

  function setType(id: string, type: ActionType) {
    onChange(
      (value || []).map((c) =>
        c.id === id ? { ...c, type, config: defaultConfigForType(type) } : c,
      ),
    );
  }

  function remove(id: string) {
    onChange((value || []).filter((c) => c.id !== id));
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("actions.title", "Actions")}</h3>
      <p className="text-sm text-text3">
        {t("actions.subtitle", "Define the actions executed by the runtime (Supabase / email).")}
      </p>
      <p className="mt-1 text-xs text-text3">
        {t("actions.payloadNote", "Ticket and device: leave the ID empty if the trigger sends ticket_id / device_id in the payload.")}
      </p>

      <div className="mt-3 space-y-4">
        {(value || []).map((a) => (
          <div key={a.id} className="rounded-md border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={a.type}
                onChange={(e) => setType(a.id, e.target.value as ActionType)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                {ACTION_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => remove(a.id)} className="text-sm text-rose-600">
                {t("actions.remove", "Remove")}
              </button>
            </div>

            {a.type === "send_email" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs sm:col-span-2">
                  {t("actions.email.recipient", "Recipient (optional if in trigger payload)")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.to as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { to: e.target.value })}
                    placeholder={t("actions.email.recipientPlaceholder", "client@example.com")}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  {t("actions.email.subject", "Subject")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.subject as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { subject: e.target.value })}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  {t("actions.email.body", "Body")}
                  <textarea
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    rows={3}
                    value={(a.config?.body as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { body: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(a.config?.is_html)}
                    onChange={(e) => updateConfig(a.id, { is_html: e.target.checked })}
                  />
                  {t("actions.email.isHtml", "Body is HTML")}
                </label>
              </div>
            )}

            {a.type === "update_ticket_status" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  {t("actions.ticketStatus.ticketId", "Ticket ID")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.ticket_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { ticket_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
                <label className="text-xs">
                  {t("actions.ticketStatus.status", "Status")}
                  <select
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.status as string) ?? "ready"}
                    onChange={(e) => updateConfig(a.id, { status: e.target.value })}
                  >
                    {TICKET_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {a.type === "create_notification" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  {t("actions.notification.userId", "User ID (auth / profile)")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.user_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { user_id: e.target.value })}
                    placeholder={t("actions.notification.userIdPlaceholder", "UUID — or use assignee_id in payload")}
                  />
                </label>
                <label className="text-xs">
                  {t("actions.notification.type", "Type")}
                  <select
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.type as string) ?? "ticket_status_changed"}
                    onChange={(e) => updateConfig(a.id, { type: e.target.value })}
                  >
                    {NOTIFICATION_TYPES.map((nt) => (
                      <option key={nt} value={nt}>
                        {nt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs sm:col-span-2">
                  {t("actions.notification.title", "Title")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.title as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { title: e.target.value })}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  {t("actions.notification.message", "Message")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.body as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { body: e.target.value })}
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  {t("actions.notification.link", "Link")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.link as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { link: e.target.value })}
                    placeholder={t("actions.notification.linkPlaceholder", "/tickets")}
                  />
                </label>
              </div>
            )}

            {a.type === "update_device_status" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  {t("actions.deviceStatus.deviceId", "Device ID")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.device_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { device_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
                <label className="text-xs">
                  {t("actions.deviceStatus.status", "Status")}
                  <select
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
                    value={(a.config?.status as string) ?? "available"}
                    onChange={(e) => updateConfig(a.id, { status: e.target.value })}
                  >
                    {DEVICE_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {a.type === "assign_ticket" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">
                  {t("actions.assignTicket.ticketId", "Ticket ID")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.ticket_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { ticket_id: e.target.value })}
                    placeholder="UUID"
                  />
                </label>
                <label className="text-xs">
                  {t("actions.assignTicket.assignee", "Assignee (profile / user UUID)")}
                  <input
                    className="mt-0.5 w-full rounded border px-2 py-1 text-sm font-mono"
                    value={(a.config?.assignee_id as string) ?? ""}
                    onChange={(e) => updateConfig(a.id, { assignee_id: e.target.value })}
                    placeholder={t("actions.assignTicket.assigneePlaceholder", "UUID")}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={addAction}
          className="rounded bg-slate-100 px-3 py-1 text-sm"
        >
          {t("actions.addAction", "Add action")}
        </button>
      </div>
    </div>
  );
}
