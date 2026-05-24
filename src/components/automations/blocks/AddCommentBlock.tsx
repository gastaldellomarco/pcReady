import { useTranslation } from "react-i18next";
import { MessageSquare, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { AddCommentAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";
import { VariableTextField } from "../VariableTextField";

interface AddCommentBlockProps {
  action: AddCommentAction;
  onChange: (action: AddCommentAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function AddCommentBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: AddCommentBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<AddCommentAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <MessageSquare className="w-5 h-5 text-purple-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.add_comment.title", "Aggiungi commento")}
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
          label={t("actionsBuilder.blocks.add_comment.ticketId", "ID Ticket (opzionale)")}
          value={action.config.ticket_id || ""}
          onChange={(v) => updateConfig({ ticket_id: v || undefined })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.optionalPlaceholder", "Lascia vuoto per usare il ticket dal trigger")}
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.add_comment.content", "Contenuto")}
          value={action.config.content}
          onChange={(v) => updateConfig({ content: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.add_comment.contentPlaceholder", "Scrivi il commento...")}
          multiline
          rows={4}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={action.config.is_internal}
            onChange={(e) => updateConfig({ is_internal: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-text2">
            {t("actionsBuilder.blocks.add_comment.isInternal", "Nota interna (non visibile al cliente)")}
          </span>
        </label>
      </div>
    </div>
  );
}
