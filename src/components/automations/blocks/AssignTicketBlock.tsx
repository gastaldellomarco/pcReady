import { UserCheck, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VariableTextField } from "../VariableTextField";
import type { AssignTicketAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";

interface AssignTicketBlockProps {
  action: AssignTicketAction;
  onChange: (action: AssignTicketAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 *
 */
export function AssignTicketBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: AssignTicketBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<AssignTicketAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <UserCheck className="size-5 text-indigo-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.assign_ticket.title", "Assegna ticket")}
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
          label={t("actionsBuilder.blocks.assign_ticket.ticketId", "ID Ticket (opzionale)")}
          value={action.config.ticket_id || ""}
          onChange={(v) => updateConfig({ ticket_id: v || undefined })}
          variables={availableVariables}
          placeholder={t(
            "actionsBuilder.optionalPlaceholder",
            "Lascia vuoto per usare il ticket dal trigger",
          )}
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.assign_ticket.assignee", "Assegnatario")}
          value={action.config.assignee_id}
          onChange={(v) => updateConfig({ assignee_id: v })}
          variables={availableVariables}
          placeholder={t(
            "actionsBuilder.blocks.assign_ticket.assigneePlaceholder",
            "UUID assegnatario",
          )}
        />
      </div>
    </div>
  );
}
