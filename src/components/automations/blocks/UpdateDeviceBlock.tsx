import { useTranslation } from "react-i18next";
import { Monitor, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { UpdateDeviceAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";
import { VariableTextField } from "../VariableTextField";

interface UpdateDeviceBlockProps {
  action: UpdateDeviceAction;
  onChange: (action: UpdateDeviceAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const DEVICE_STATUSES = [
  { value: "available", label: "Disponibile" },
  { value: "assigned", label: "Assegnato" },
  { value: "maintenance", label: "Manutenzione" },
  { value: "retired", label: "Dismesso" },
];

export function UpdateDeviceBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: UpdateDeviceBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<UpdateDeviceAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Monitor className="w-5 h-5 text-cyan-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.update_device.title", "Aggiorna dispositivo")}
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
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 text-text3 hover:text-text hover:bg-gray-200 rounded disabled:opacity-30"
            title={t("actionsBuilder.reorder.down", "Sposta giù")}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-text3 hover:text-red-500 hover:bg-red-50 rounded ml-1"
            title={t("actionsBuilder.remove", "Rimuovi")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <VariableTextField
          label={t("actionsBuilder.blocks.update_device.deviceId", "ID Dispositivo (opzionale)")}
          value={action.config.device_id || ""}
          onChange={(v) => updateConfig({ device_id: v || undefined })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.optionalPlaceholder", "Lascia vuoto per usare il dispositivo dal trigger")}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text2 mb-1.5">
              {t("actionsBuilder.blocks.update_device.status", "Stato")}
            </label>
            <select
              value={action.config.status || ""}
              onChange={(e) => updateConfig({ status: e.target.value as UpdateDeviceAction["config"]["status"] || undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">
                {t("actionsBuilder.keepCurrent", "Mantieni attuale")}
              </option>
              {DEVICE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <VariableTextField
            label={t("actionsBuilder.blocks.update_device.location", "Sede (opzionale)")}
            value={action.config.location_id || ""}
            onChange={(v) => updateConfig({ location_id: v || undefined })}
            variables={availableVariables}
            placeholder={t("actionsBuilder.blocks.update_device.locationPlaceholder", "ID sede")}
          />
        </div>
      </div>
    </div>
  );
}
