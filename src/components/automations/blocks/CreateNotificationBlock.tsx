import { Bell, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VariableTextField } from "../VariableTextField";
import type { CreateNotificationAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";

interface CreateNotificationBlockProps {
  action: CreateNotificationAction;
  onChange: (action: CreateNotificationAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const NOTIFICATION_TYPES = [
  { value: "info", label: "Info" },
  { value: "success", label: "Successo" },
  { value: "warning", label: "Avviso" },
  { value: "error", label: "Errore" },
];

/**
 *
 */
export function CreateNotificationBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: CreateNotificationBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<CreateNotificationAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Bell className="size-5 text-yellow-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.create_notification.title", "Crea notifica")}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 text-text3 hover:text-text hover:bg-gray-200 rounded disabled:opacity-30"
            title={t("actionsBuilder.reorder.up", "Sposta su")}
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 text-text3 hover:text-text hover:bg-gray-200 rounded disabled:opacity-30"
            title={t("actionsBuilder.reorder.down", "Sposta giù")}
          >
            <ChevronDown className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-text3 hover:text-red-500 hover:bg-red-50 rounded ml-1"
            title={t("actionsBuilder.remove", "Rimuovi")}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <VariableTextField
            label={t("actionsBuilder.blocks.create_notification.user", "Utente (opzionale)")}
            value={action.config.user_id || ""}
            onChange={(v) => updateConfig({ user_id: v || undefined })}
            variables={availableVariables}
            placeholder={t("actionsBuilder.blocks.create_notification.userPlaceholder", "ID utente")}
          />

          <div>
            <label className="block text-sm font-medium text-text2 mb-1.5">
              {t("actionsBuilder.blocks.create_notification.type", "Tipo")}
            </label>
            <select
              value={action.config.type}
              onChange={(e) => updateConfig({ type: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              {NOTIFICATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <VariableTextField
          label={t("actionsBuilder.blocks.create_notification.titleField", "Titolo")}
          value={action.config.title}
          onChange={(v) => updateConfig({ title: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.create_notification.titlePlaceholder", "Titolo notifica")}
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.create_notification.body", "Messaggio")}
          value={action.config.body}
          onChange={(v) => updateConfig({ body: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.create_notification.bodyPlaceholder", "Contenuto del messaggio...")}
          multiline
          rows={3}
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.create_notification.link", "Link (opzionale)")}
          value={action.config.link || ""}
          onChange={(v) => updateConfig({ link: v || undefined })}
          variables={availableVariables}
          placeholder="/tickets"
        />
      </div>
    </div>
  );
}
