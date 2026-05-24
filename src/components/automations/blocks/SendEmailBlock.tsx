import { useTranslation } from "react-i18next";
import { Mail, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { SendEmailAction } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";
import { VariableTextField } from "../VariableTextField";

interface SendEmailBlockProps {
  action: SendEmailAction;
  onChange: (action: SendEmailAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SendEmailBlock({
  action,
  onChange,
  onRemove,
  availableVariables,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: SendEmailBlockProps) {
  const { t } = useTranslation("automations");

  const updateConfig = (patch: Partial<SendEmailAction["config"]>) => {
    onChange({
      ...action,
      config: { ...action.config, ...patch },
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Mail className="w-5 h-5 text-blue-500" />
        <span className="font-medium text-text">
          {t("actionsBuilder.blocks.send_email.title", "Invia email")}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 text-text3 hover:text-text hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
            title={t("actionsBuilder.reorder.up", "Sposta su")}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 text-text3 hover:text-text hover:bg-gray-200 rounded disabled:opacity-30 disabled:hover:bg-transparent"
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
          label={t("actionsBuilder.blocks.send_email.to", "A")}
          value={action.config.to}
          onChange={(v) => updateConfig({ to: v })}
          variables={availableVariables}
          placeholder="cliente@esempio.it"
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.send_email.subject", "Oggetto")}
          value={action.config.subject}
          onChange={(v) => updateConfig({ subject: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.send_email.subjectPlaceholder", "Nuovo ticket creato")}
        />

        <VariableTextField
          label={t("actionsBuilder.blocks.send_email.body", "Corpo")}
          value={action.config.body}
          onChange={(v) => updateConfig({ body: v })}
          variables={availableVariables}
          placeholder={t("actionsBuilder.blocks.send_email.bodyPlaceholder", "Messaggio dell'email...")}
          multiline
          rows={4}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={action.config.is_html}
            onChange={(e) => updateConfig({ is_html: e.target.checked })}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-text2">
            {t("actionsBuilder.blocks.send_email.isHtml", "Corpo è HTML")}
          </span>
        </label>
      </div>
    </div>
  );
}
