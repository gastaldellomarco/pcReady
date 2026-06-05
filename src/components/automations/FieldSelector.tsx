import { useTranslation } from "react-i18next";
import { AUTOMATION_CONDITION_FIELDS } from "@/domain/automation";

interface FieldSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 *
 */
export function FieldSelector({ value, onChange }: FieldSelectorProps) {
  const { t } = useTranslation("automations");

  // Group fields by entity
  const ticketFields = AUTOMATION_CONDITION_FIELDS.filter((f) => f.entity === "ticket");
  const deviceFields = AUTOMATION_CONDITION_FIELDS.filter((f) => f.entity === "device");

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border px-2 py-1.5 text-sm bg-background"
    >
      <option value="">{t("conditionsBuilder.field.placeholder", "Seleziona campo")}</option>

      <optgroup label={t("conditionsBuilder.field.groups.ticket", "Ticket")}>
        {ticketFields.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </optgroup>

      <optgroup label={t("conditionsBuilder.field.groups.device", "Dispositivo")}>
        {deviceFields.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
