import { useTranslation } from "react-i18next";
import { getVariablesForTrigger } from "@/domain/automation-variables";
import { fromActionDefs, toActionDefs } from "@/lib/automations/action-adapter";
import { AutomationActionsBuilder } from "../AutomationActionsBuilder";
import type { AutomationAction } from "@/domain/automation";
import type { ActionDef } from "@/types/automation";

interface ActionsStepProps {
  value: ActionDef[];
  onChange: (v: ActionDef[]) => void;
  triggerType?: string;
}

/**
 *
 */
export default function ActionsStep({ value, onChange, triggerType }: ActionsStepProps) {
  const { t } = useTranslation("automations");

  // Convert legacy ActionDefs to new AutomationActions
  const actions: AutomationAction[] = fromActionDefs(value || []);

  // Get available variables based on trigger type
  const availableVariables = getVariablesForTrigger(triggerType || "ticket_created");

  const handleChange = (newActions: AutomationAction[]) => {
    // Convert back to legacy format for parent component
    onChange(toActionDefs(newActions));
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("actionsBuilder.title", "Cosa deve succedere?")}</h3>
      <p className="text-sm text-text3">
        {t(
          "actionsBuilder.description",
          "Scegli le azioni da eseguire quando il trigger e i filtri sono soddisfatti.",
        )}
      </p>

      <div className="mt-4">
        <AutomationActionsBuilder
          value={actions}
          onChange={handleChange}
          availableVariables={availableVariables}
        />
      </div>
    </div>
  );
}
