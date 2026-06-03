import { useTranslation } from "react-i18next";
import {
  fromConditionDefs,
  toConditionDefs,
} from "@/lib/automations/condition-adapter";
import { AutomationConditionsBuilder } from "../AutomationConditionsBuilder";
import type { ConditionsGroup } from "@/domain/automation";
import type { ConditionDef } from "@/types/automation";

interface FiltersStepProps {
  value: ConditionDef[];
  onChange: (v: ConditionDef[]) => void;
  triggerName?: string;
}

/**
 *
 */
export default function FiltersStep({
  value,
  onChange,
  triggerName,
}: FiltersStepProps) {
  const { t } = useTranslation("automations");

  // Converte da ConditionDef legacy a ConditionsGroup
  const group: ConditionsGroup = fromConditionDefs(value || []);

  const handleChange = (newGroup: ConditionsGroup) => {
    onChange(toConditionDefs(newGroup));
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">
        {t("filtersStep.title", "Sotto quali condizioni?")}
      </h3>
      <p className="text-sm text-text3">
        {t(
          "filtersStep.description",
          "Opzionale — filtra solo i casi che corrispondono ai criteri. Esempio: solo ticket con priorità alta."
        )}
      </p>

      <div className="mt-4">
        <AutomationConditionsBuilder
          value={group}
          onChange={handleChange}
          triggerName={triggerName}
        />
      </div>
    </div>
  );
}
