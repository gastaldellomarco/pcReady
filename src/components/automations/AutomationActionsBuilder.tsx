import { Plus, Mail, Ticket, MessageSquare, PlusCircle, Bell, UserCheck, Monitor } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AUTOMATION_ACTION_TYPES, createDefaultAction } from "@/domain/automation";
import { AddCommentBlock } from "./blocks/AddCommentBlock";
import { AssignTicketBlock } from "./blocks/AssignTicketBlock";
import { CreateNotificationBlock } from "./blocks/CreateNotificationBlock";
import { CreateTicketBlock } from "./blocks/CreateTicketBlock";
import { SendEmailBlock } from "./blocks/SendEmailBlock";
import { UpdateDeviceBlock } from "./blocks/UpdateDeviceBlock";
import { UpdateTicketBlock } from "./blocks/UpdateTicketBlock";
import type { AutomationAction, AutomationActionType } from "@/domain/automation";
import type { AutomationVariable } from "@/domain/automation-variables";

interface AutomationActionsBuilderProps {
  value: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  availableVariables: AutomationVariable[];
}

const ICON_MAP: Record<AutomationActionType, React.ReactNode> = {
  send_email: <Mail className="size-4" />,
  update_ticket: <Ticket className="size-4" />,
  add_comment: <MessageSquare className="size-4" />,
  create_ticket: <PlusCircle className="size-4" />,
  create_notification: <Bell className="size-4" />,
  assign_ticket: <UserCheck className="size-4" />,
  update_device: <Monitor className="size-4" />,
};

/**
 *
 */
export function AutomationActionsBuilder({
  value,
  onChange,
  availableVariables,
}: AutomationActionsBuilderProps) {
  const { t } = useTranslation("automations");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const actions = value || [];

  const addAction = (type: AutomationActionType) => {
    const newAction = createDefaultAction(type);
    newAction.order = actions.length;
    onChange([...actions, newAction]);
    setIsMenuOpen(false);
  };

  const updateAction = (index: number, updatedAction: AutomationAction) => {
    const newActions = [...actions];
    newActions[index] = updatedAction;
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    // Reorder after removal
    newActions.forEach((a, i) => (a.order = i));
    onChange(newActions);
  };

  const moveActionUp = (index: number) => {
    if (index === 0) return;
    const newActions = [...actions];
    [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
    newActions.forEach((a, i) => (a.order = i));
    onChange(newActions);
  };

  const moveActionDown = (index: number) => {
    if (index >= actions.length - 1) return;
    const newActions = [...actions];
    [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
    newActions.forEach((a, i) => (a.order = i));
    onChange(newActions);
  };

  const renderActionBlock = (action: AutomationAction, index: number) => {
    const commonProps = {
      isFirst: index === 0,
      isLast: index === actions.length - 1,
      onMoveUp: () => moveActionUp(index),
      onMoveDown: () => moveActionDown(index),
      onRemove: () => removeAction(index),
      availableVariables,
    };

    switch (action.type) {
      case "send_email":
        return (
          <SendEmailBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      case "update_ticket":
        return (
          <UpdateTicketBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      case "add_comment":
        return (
          <AddCommentBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      case "create_ticket":
        return (
          <CreateTicketBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      case "create_notification":
        return (
          <CreateNotificationBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      case "assign_ticket":
        return (
          <AssignTicketBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      case "update_device":
        return (
          <UpdateDeviceBlock
            key={action.id}
            action={action}
            onChange={(a) => updateAction(index, a)}
            {...commonProps}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {actions.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
          <p className="text-text3 text-sm">
            {t("actionsBuilder.noActions", "Nessuna azione configurata. Aggiungi almeno un'azione.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, index) => renderActionBlock(action, index))}
        </div>
      )}

      {/* Add Action Button with Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
        >
          <Plus className="size-4" />
          {t("actionsBuilder.addAction", "Aggiungi azione")}
        </button>

        {isMenuOpen && (
          <>
            <div
              role="button"
              tabIndex={-1}
              className="fixed inset-0 z-40"
              onClick={() => setIsMenuOpen(false)}
              onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setIsMenuOpen(false); }}
              aria-label={t("actionsBuilder.closeMenu", "Chiudi menu")}
            />
            <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="py-1">
                {AUTOMATION_ACTION_TYPES.map((actionType) => (
                  <button
                    key={actionType.value}
                    type="button"
                    onClick={() => addAction(actionType.value)}
                    className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-text2">{ICON_MAP[actionType.value]}</span>
                    <div>
                      <div className="text-sm font-medium text-text">
                        {actionType.label}
                      </div>
                      <div className="text-xs text-text3">
                        {actionType.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
