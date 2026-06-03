import { PlusCircle, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VariableTextField } from "../VariableTextField";
import type { CreateTicketAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";

interface CreateTicketBlockProps {
  action: CreateTicketAction;
  onChange: (action: CreateTicketAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const PRIORITIES = [
  { value: "low", label: "Bassa" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

/**
 *
 */
export function CreateTicketBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: CreateTicketBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<CreateTicketAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <PlusCircle className="size-5 text-orange-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.create_ticket.title", "Crea ticket")}
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
        <VariableTextField
          label={t("actionsBuilder.blocks.create_ticket.titleField", "Titolo")}
          value={action.config.title}
          onChange={(v) => updateConfig({ title: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.create_ticket.titlePlaceholder", "Titolo del nuovo ticket")}
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.create_ticket.description", "Descrizione")}
          value={action.config.description}
          onChange={(v) => updateConfig({ description: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.create_ticket.descriptionPlaceholder", "Descrizione del problema...")}
          multiline
          rows={4}
        />

        <div className="grid grid-cols-2 gap-4">
          <VariableTextField
            label={t("actionsBuilder.blocks.create_ticket.customer", "Cliente (opzionale)")}
            value={action.config.customer_id || ""}
            onChange={(v) => updateConfig({ customer_id: v || undefined })}
            variables={availableVariables}
            placeholder={t("actionsBuilder.blocks.create_ticket.customerPlaceholder", "ID cliente")}
          />

          <div>
            <label className="block text-sm font-medium text-text2 mb-1.5">
              {t("actionsBuilder.blocks.create_ticket.priority", "Priorità")}
            </label>
            <select
              value={action.config.priority || ""}
              onChange={(e) => updateConfig({ priority: e.target.value as CreateTicketAction["config"]["priority"] || undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">{t("actionsBuilder.selectPriority", "Seleziona priorità")}</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <VariableTextField
          label={t("actionsBuilder.blocks.create_ticket.assignee", "Assegnatario (opzionale)")}
          value={action.config.assignee_id || ""}
          onChange={(v) => updateConfig({ assignee_id: v || undefined })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.create_ticket.assigneePlaceholder", "UUID assegnatario")}
        />
      </div>
    </div>
  );
}
