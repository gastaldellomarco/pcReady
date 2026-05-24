import { useTranslation } from "react-i18next";
import type { ScheduleDef } from "@/types/automation";

export default function ScheduleStep({
  value,
  onChange,
}: {
  value: ScheduleDef | null;
  onChange: (v: ScheduleDef) => void;
}) {
  const { t } = useTranslation("automations");

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("schedule.title", "Schedule")}</h3>
      <p className="text-sm text-text3">{t("schedule.subtitle", "Set the schedule (optional).")}</p>

      <div className="mt-3">
        <label className="text-sm">{t("schedule.typeLabel", "Type")}</label>
        <select
          className="ml-2 rounded-md border px-2 py-1"
          value={value?.type ?? "none"}
          onChange={(e) => onChange({ type: e.target.value as ScheduleDef["type"] })}
        >
          <option value="none">{t("schedule.types.none", "None")}</option>
          <option value="cron">{t("schedule.types.cron", "Cron")}</option>
          <option value="interval">{t("schedule.types.interval", "Interval")}</option>
        </select>
      </div>

      {value?.type === "cron" && (
        <div className="mt-3">
          <label className="text-sm">{t("schedule.cronExpression", "Expression")}</label>
          <input
            className="block mt-1 rounded-md border px-2 py-1 w-full"
            value={value?.cron ?? ""}
            onChange={(e) => onChange({ ...value, cron: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
