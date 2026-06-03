import {
  Mail,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Timer,
  BarChart3,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AUTOMATION_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type AutomationTemplate,
} from "@/lib/automations/templates";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Mail,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Timer,
  BarChart3,
};

interface TemplateStepProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string | null) => void;
}

/**
 *
 */
export default function TemplateStep({
  selectedTemplateId,
  onSelectTemplate,
}: TemplateStepProps) {
  const { t } = useTranslation("automations");

  return (
    <div>
      <h3 className="text-lg font-semibold">
        {t("templateStep.title", "Scegli un modello")}
      </h3>
      <p className="text-sm text-text3">
        {t(
          "templateStep.description",
          "Seleziona un template preconfigurato o inizia da zero. Puoi modificare tutto nei prossimi passaggi."
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {AUTOMATION_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onClick={() => onSelectTemplate(template.id)}
          />
        ))}

        {/* Start from scratch card */}
        <button
          type="button"
          onClick={() => onSelectTemplate(null)}
          className={cn(
            "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
            selectedTemplateId === null
              ? "border-accent bg-accent/5 text-accent"
              : "border-dashed border-border bg-background hover:border-accent/40 hover:bg-accent/5"
          )}
        >
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              selectedTemplateId === null ? "bg-accent/10" : "bg-surface2"
            )}
          >
            <Plus
              className={cn(
                "size-5",
                selectedTemplateId === null ? "text-accent" : "text-text3"
              )}
            />
          </div>
          <div className="min-w-0">
            <div
              className={cn(
                "text-sm font-semibold",
                selectedTemplateId === null ? "text-accent" : "text-foreground"
              )}
            >
              {t("templateStep.startFromScratch", "Inizia da zero")}
            </div>
            <div className="mt-0.5 text-xs text-text3 leading-relaxed">
              {t(
                "templateStep.startFromScratchDesc",
                "Crea un'automazione personalizzata senza template"
              )}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: AutomationTemplate;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  const Icon = ICON_MAP[template.icon] || Mail;
  const categoryStyle = TEMPLATE_CATEGORIES[template.category];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
        isSelected
          ? "border-accent bg-accent/5"
          : "border-border bg-background hover:border-accent/40 hover:bg-accent/5"
      )}
    >
      {/* Category badge */}
      <span
        className={cn(
          "absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          categoryStyle.color
        )}
      >
        {categoryStyle.label}
      </span>

      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          isSelected ? "bg-accent/10" : "bg-surface2"
        )}
      >
        <Icon
          className={cn("size-5", isSelected ? "text-accent" : "text-text3")}
        />
      </div>
      <div className="min-w-0 pr-16">
        <div
          className={cn(
            "text-sm font-semibold",
            isSelected ? "text-accent" : "text-foreground"
          )}
        >
          {template.name}
        </div>
        <div className="mt-0.5 text-xs text-text3 leading-relaxed">
          {template.description}
        </div>
      </div>
    </button>
  );
}
