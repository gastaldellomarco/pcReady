import { useTranslation } from "react-i18next";
import { Printer, CheckCircle2 } from "lucide-react";
import {
  type ChecklistItemDef,
  fmtDateTime,
} from "@/lib/pcready";
import type { TicketChecklistInstanceRow } from "@/lib/queries/checklist";
import type { TechnicianOption } from "@/lib/technicians";
export function TicketChecklistPanel({
  instances,
  instancesLoading,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  onAttachTemplate,
  onSaveResponse,
  onComplete,
  technicians,
  currentUserId,
  canEdit,
  canManageChecklists,
}: {
  instances: TicketChecklistInstanceRow[];
  instancesLoading: boolean;
  templates: Array<{ id: string; name: string; is_default?: boolean }>;
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (value: string) => void;
  onAttachTemplate: () => void;
  onSaveResponse: (
    instance: TicketChecklistInstanceRow,
    sectionKey: string,
    itemId: string,
    value: string | null,
  ) => void;
  onComplete: (instance: TicketChecklistInstanceRow) => void;
  technicians: TechnicianOption[];
  currentUserId: string | null;
  canEdit: boolean;
  canManageChecklists: boolean;
}) {
  const { t } = useTranslation("tickets");
  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold">
              {t("detail.section.linkedChecklists", "Checklist collegate")}
            </h3>
            <p className="text-[11px] text-text3">
              {t(
                "detail.section.linkedChecklistsDesc",
                "Le checklist vengono istanziate come snapshot indipendente dal template.",
              )}
            </p>
          </div>
          {canEdit && (
            <div className="flex min-w-[320px] flex-1 justify-end gap-2">
              <select
                className="pc-input max-w-[320px] text-[12px]"
                value={selectedTemplateId}
                onChange={(event) => onSelectedTemplateIdChange(event.target.value)}
                aria-label={t("detail.checklistTemplateLabel", "Seleziona template checklist")}
              >
                <option value="">{t("detail.btn.attachChecklist", "— Collega checklist —")}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default ? t("createTicket.templateDefault", " (predefinito)") : ""}
                  </option>
                ))}
              </select>
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                disabled={!selectedTemplateId}
                onClick={onAttachTemplate}
              >
                {t("detail.btn.addChecklist", "Collega")}
              </button>
            </div>
          )}
        </div>
        {instancesLoading && (
          <div className="text-[12px] text-text3">
            {t("detail.section.checklistLoading", "Caricamento checklist...")}
          </div>
        )}
        {!instancesLoading && !instances.length && (
          <div
            className="rounded-lg border p-6 text-center text-[12px] text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            {t("detail.section.noChecklistsLinked", "Nessuna checklist collegata a questo ticket.")}
          </div>
        )}
        <div className="space-y-3">
          {instances.map((instance) => {
            const progress = computeInstanceProgress(instance);
            return (
              <div
                key={instance.id}
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-bold">{instance.title}</h4>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background:
                            instance.status === "completed" ? "var(--success)" : "var(--surface2)",
                          color: instance.status === "completed" ? "white" : "var(--text3)",
                        }}
                      >
                        {instance.status === "completed"
                          ? t("detail.section.completed", "Completata")
                          : instance.status === "in_progress"
                            ? t("detail.section.inProgress", "In corso")
                            : t("detail.section.toFill", "Da compilare")}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-text3">
                      {t("detail.section.itemsCount", {
                        done: progress.done,
                        total: progress.total,
                        defaultValue: "{{done}}/{{total}} elementi",
                      })}{" "}
                      · {progress.pct}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-40 overflow-hidden rounded-full"
                      style={{ background: "var(--surface2)" }}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <button
                      className="pc-btn pc-btn-ghost pc-btn-sm"
                      onClick={() => window.print()}
                    >
                      <Printer className="size-3" /> {t("detail.btn.exportPdf", "Esporta PDF")}
                    </button>
                    {canEdit && instance.status !== "completed" && (
                      <button
                        className="pc-btn pc-btn-primary pc-btn-sm"
                        disabled={progress.requiredMissing > 0}
                        title={
                          progress.requiredMissing > 0
                            ? t(
                                "detail.section.fillRequiredItems",
                                "Compila prima tutti gli elementi obbligatori",
                              )
                            : t("detail.section.completeChecklistHint", "Completa checklist")
                        }
                        onClick={() => onComplete(instance)}
                      >
                        <CheckCircle2 className="size-3" />{" "}
                        {t("detail.btn.completeChecklist", "Completa checklist")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(instance.structure as Record<string, any>).map(
                    ([groupKey, group]) => {
                      const sections = (group as any).sections;
                      if (!sections) {
                        // Old flat format: group is actually a section
                        const section = group as unknown as {
                          label: string;
                          items: ChecklistItemDef[];
                          assigned_to?: string | null;
                        };
                        const assignedTo =
                          instance.section_assignments?.[groupKey] || section.assigned_to || null;
                        const assignedTech = technicians.find((tech) => tech.id === assignedTo);
                        const sectionLocked =
                          !!assignedTo && assignedTo !== currentUserId && !canManageChecklists;
                        const responses = responseMap(instance.responses);
                        return (
                          <div
                            key={groupKey}
                            className="rounded-lg border p-3"
                            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-[12.5px] font-bold">{section.label}</div>
                                <div className="text-[11px] text-text3">
                                  {assignedTech
                                    ? t("detail.section.assignedTo", {
                                        name: assignedTech.full_name,
                                        defaultValue: "Assegnata a {{name}}",
                                      })
                                    : t(
                                        "detail.section.noTechnicianAssigned",
                                        "Nessun tecnico specifico",
                                      )}
                                  {sectionLocked
                                    ? ` · ${t("detail.section.readOnly", "sola lettura per te")}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {(section.items || []).map((item) => {
                                const key = `${groupKey}:${item.id}`;
                                const response = responses.get(key);
                                const disabled =
                                  !canEdit || sectionLocked || instance.status === "completed";
                                return (
                                  <ChecklistResponseInput
                                    key={item.id}
                                    item={item}
                                    value={response?.value ?? ""}
                                    response={response}
                                    disabled={disabled}
                                    compiledByLabel={
                                      technicians.find((tech) => tech.id === response?.compiled_by)
                                        ?.full_name
                                    }
                                    onSave={(value) =>
                                      onSaveResponse(instance, groupKey, item.id, value)
                                    }
                                  />
                                );
                              })}
                              {!section.items?.length && (
                                <div className="text-[12px] text-text3">
                                  {t("detail.section.noItems", "Nessuna voce in questa sezione")}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      // New two-level format: iterate sections within group
                      return Object.entries(sections as Record<string, any>).map(
                        ([sectionKey, section]) => {
                          const assignedTo =
                            instance.section_assignments?.[sectionKey] ||
                            section.assigned_to ||
                            null;
                          const assignedTech = technicians.find((tech) => tech.id === assignedTo);
                          const sectionLocked =
                            !!assignedTo && assignedTo !== currentUserId && !canManageChecklists;
                          const responses = responseMap(instance.responses);
                          return (
                            <div
                              key={sectionKey}
                              className="rounded-lg border p-3"
                              style={{
                                borderColor: "var(--border)",
                                background: "var(--surface2)",
                              }}
                            >
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[12.5px] font-bold">{section.label}</div>
                                  <div className="text-[11px] text-text3">
                                    {assignedTech
                                      ? t("detail.section.assignedTo", {
                                          name: assignedTech.full_name,
                                          defaultValue: "Assegnata a {{name}}",
                                        })
                                      : t(
                                          "detail.section.noTechnicianAssigned",
                                          "Nessun tecnico specifico",
                                        )}
                                    {sectionLocked
                                      ? ` · ${t("detail.section.readOnly", "sola lettura per te")}`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {(section.items || []).map((item) => {
                                  const key = `${sectionKey}:${item.id}`;
                                  const response = responses.get(key);
                                  const disabled =
                                    !canEdit || sectionLocked || instance.status === "completed";
                                  return (
                                    <ChecklistResponseInput
                                      key={item.id}
                                      item={item}
                                      value={response?.value ?? ""}
                                      response={response}
                                      disabled={disabled}
                                      compiledByLabel={
                                        technicians.find(
                                          (tech) => tech.id === response?.compiled_by,
                                        )?.full_name
                                      }
                                      onSave={(value) =>
                                        onSaveResponse(instance, sectionKey, item.id, value)
                                      }
                                    />
                                  );
                                })}
                                {!section.items?.length && (
                                  <div className="text-[12px] text-text3">
                                    {t("detail.section.noItems", "Nessuna voce in questa sezione")}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        },
                      );
                    },
                  )}
                </div>
                {instance.status === "completed" && (
                  <div
                    className="mt-3 rounded-lg border p-2 text-[11px] text-text3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {t("detail.section.completedAt", {
                      date: fmtDateTime(instance.completed_at),
                      defaultValue: "Completata {{date}}",
                    })}
                    {instance.signature_name
                      ? ` · ${t("detail.section.signedBy", { name: instance.signature_name, defaultValue: "Firma: {{name}}" })}`
                      : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function ChecklistResponseInput({
  item,
  value,
  response,
  disabled,
  compiledByLabel,
  onSave,
}: {
  item: ChecklistItemDef;
  value: string;
  response?: TicketChecklistInstanceRow["responses"][number];
  disabled: boolean;
  compiledByLabel?: string;
  onSave: (value: string | null) => void;
}) {
  const { t } = useTranslation("tickets");
  const itemType = item.type || "checkbox";
  const done = isResponseComplete(item, value);
  const commonMeta = response ? (
    <span className="text-[10.5px] text-text3">
      {t("detail.section.savedBy", {
        name: compiledByLabel || response.compiled_by || "utente",
        defaultValue: "salvato da {{name}}",
      })}{" "}
      ·{" "}
      {t("detail.section.atTime", {
        date: fmtDateTime(response.compiled_at),
        defaultValue: "{{date}}",
      })}
    </span>
  ) : null;

  if (itemType === "text" || itemType === "number") {
    return (
      <label
        className="block rounded-md border bg-background p-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-semibold">
            {item.text} {item.required && <span className="text-red-500">*</span>}
          </span>
          {commonMeta}
        </div>
        <input
          className="pc-input"
          type={itemType === "number" ? "number" : "text"}
          defaultValue={value}
          disabled={disabled}
          onChange={(event) => onSave(event.target.value)}
          placeholder={itemType === "number" ? "0" : ""}
        />
      </label>
    );
  }

  return (
    <label
      className="flex items-center gap-2 rounded-md border bg-background p-2"
      style={{ borderColor: "var(--border)", color: done ? "var(--text3)" : "var(--text)" }}
    >
      <input
        type="checkbox"
        checked={value === "checked"}
        disabled={disabled}
        onChange={(event) => onSave(event.target.checked ? "checked" : "unchecked")}
      />
      <span className="flex-1 text-[12px]">
        {item.text} {item.required && <span className="text-red-500">*</span>}
      </span>
      {commonMeta}
    </label>
  );
}

function responseMap(responses: TicketChecklistInstanceRow["responses"]) {
  return new Map(responses.map((response) => [response.item_key, response]));
}

function isResponseComplete(item: ChecklistItemDef, value?: string | null) {
  const itemType = item.type || "checkbox";
  if (itemType === "checkbox") return value === "checked";
  return !!value?.trim();
}

export function computeInstanceProgress(instance: TicketChecklistInstanceRow) {
  const responses = responseMap(instance.responses);
  let done = 0;
  let total = 0;
  let requiredMissing = 0;
  const struct = instance.structure as Record<string, any>;
  for (const [groupKey, group] of Object.entries(struct)) {
    const sections = (group as any).sections;
    if (sections) {
      // New two-level format
      for (const [sectionKey, section] of Object.entries(sections as Record<string, any>)) {
        for (const item of ((section as any).items as ChecklistItemDef[]) || []) {
          total += 1;
          const response = responses.get(`${sectionKey}:${item.id}`);
          const completed = isResponseComplete(item, response?.value);
          if (completed) done += 1;
          if (item.required && !completed) requiredMissing += 1;
        }
      }
    } else {
      // Old flat format: groupKey IS the section key
      const items = ((group as any).items as ChecklistItemDef[]) || [];
      for (const item of items) {
        total += 1;
        const response = responses.get(`${groupKey}:${item.id}`);
        const completed = isResponseComplete(item, response?.value);
        if (completed) done += 1;
        if (item.required && !completed) requiredMissing += 1;
      }
    }
  }
  return { done, total, requiredMissing, pct: total ? Math.round((done / total) * 100) : 0 };
}
