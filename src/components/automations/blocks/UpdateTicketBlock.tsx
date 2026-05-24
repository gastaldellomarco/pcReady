import { useTranslation } from "react-i18next";
import { Ticket, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { UpdateTicketAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";
import { VariableTextField } from "../VariableTextField";

interface UpdateTicketBlockProps {
  action: UpdateTicketAction;
  onChange: (action: UpdateTicketAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const TICKET_STATUSES = [
  { value: "pending", label: "In attesa" },
  { value: "in-progress", label: "In corso" },
  { value: "testing", label: "In test" },
  { value: "ready", label: "Pronto" },
];

const PRIORITIES = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

export function UpdateTicketBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: UpdateTicketBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<UpdateTicketAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Ticket className="w-5 h-5 text-green-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.update_ticket.title", "Aggiorna ticket")}
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
          label={t("actionsBuilder.blocks.update_ticket.ticketId", "ID Ticket (opzionale)")}
          value={action.config.ticket_id || ""}
          onChange={(v) => updateConfig({ ticket_id: v || undefined })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.optionalPlaceholder", "Lascia vuoto per usare il ticket dal trigger")}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text2 mb-1.5">
              {t("actionsBuilder.blocks.update_ticket.status", "Stato")}
            </label>
            <select
              value={action.config.status || ""}
              onChange={(e) => updateConfig({ status: e.target.value as UpdateTicketAction["config"]["status"] || undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">
                {t("actionsBuilder.keepCurrent", "Mantieni attuale")}
              </option>
              {TICKET_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text2 mb-1.5">
              {t("actionsBuilder.blocks.update_ticket.priority", "Priorità")}
            </label>
            <select
              value={action.config.priority || ""}
              onChange={(e) => updateConfig({ priority: e.target.value as UpdateTicketAction["config"]["priority"] || undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">
                {t("actionsBuilder.keepCurrent", "Mantieni attuale")}
              </option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <VariableTextField
          label={t("actionsBuilder.blocks.update_ticket.assignee", "Assegnatario")}
          value={action.config.assignee_id || ""}
          onChange={(v) => updateConfig({ assignee_id: v || undefined })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.update_ticket.assigneePlaceholder", "UUID assegnatario")}
        />
      </div>
    </div>
  );
}
