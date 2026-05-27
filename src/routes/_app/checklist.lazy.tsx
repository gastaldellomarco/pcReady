import { createLazyFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  ListSkeleton,
  PageEmptyState,
  PageFetchError,
} from "@/components/page-states";
import { errorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import queries from "@/lib/queries/checklist";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_STRUCTURE, type ChecklistItemDef, type ChecklistStructure } from "@/lib/pcready";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  Star,
  StarOff,
  Check,
  X,
  Pencil,
  History,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Asterisk,
  Type,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { VersionBadge } from "@/components/pcready/VersionBadge";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { createVersion } from "@/lib/versioning";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";

export const Route = createLazyFileRoute("/_app/checklist")({
  component: ChecklistPage,
});

interface Template {
  id: string;
  name: string;
  description: string | null;
  structure: ChecklistStructure;
  is_default: boolean;
}

interface TechnicianOption {
  id: string;
  full_name: string;
}

function ChecklistPage() {
  const { t } = useTranslation("checklist");
  const { user, canEdit, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<Template | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const {
    useChecklistTemplates,
    useCreateTemplate,
    useUpdateTemplate,
    useDeleteTemplate,
    useSetDefaultTemplate,
  } = queries as any;
  const listQuery = useChecklistTemplates();
  const createMut = useCreateTemplate();
  const updateMut = useUpdateTemplate();
  const deleteMut = useDeleteTemplate();
  const setDefaultMut = useSetDefaultTemplate();

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
        setTechnicians((data ?? []) as TechnicianOption[]);
      } catch {
        setTechnicians([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (listQuery.isLoading) setLoading(true);
    else setLoading(false);
    if (listQuery.data) {
      const arr = listQuery.data as Template[];
      setTemplates(arr);
      if (!active && arr.length) setActive(arr[0].id);
    }
  }, [active, listQuery.isLoading, listQuery.data]);

  async function createNew() {
    if (!canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    const payload = {
      name: t("defaultName", "Nuovo modello"),
      description: "",
      structure: DEFAULT_STRUCTURE as unknown as Json,
      created_by: user!.id,
    };
    const data = await createMut.mutateAsync(payload);
    await createVersion(
      "checklist_templates",
      data.id,
      data as unknown as Record<string, unknown>,
      undefined,
      t("changeNotes.created", "Modello checklist creato"),
      "create",
    );
    setActive(data.id);
  }

  async function setDefault(id: string) {
    if (!isAdmin) return toast.error(t("toasts.adminOnly", "Solo amministratori"));
    const template = templates.find((item) => item.id === id);
    await setDefaultMut.mutateAsync(id);
    if (template) {
      await createVersion(
        "checklist_templates",
        id,
        { ...template, is_default: true } as unknown as Record<string, unknown>,
        { is_default: { from: template.is_default, to: true } },
        t("changeNotes.setDefault", "Impostato come modello predefinito"),
        "update",
      );
    }
    toast.success(t("toasts.setDefault", "Modello impostato come predefinito"));
  }

  async function duplicate(tmpl: Template) {
    if (!canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    const payload = {
      name: t("copyOf", "Copia di ") + tmpl.name,
      description: tmpl.description || "",
      structure: tmpl.structure as unknown as Json,
      created_by: user!.id,
    };
    const data = await createMut.mutateAsync(payload);
    await createVersion(
      "checklist_templates",
      data.id,
      data as unknown as Record<string, unknown>,
      undefined,
      t("changeNotes.duplicated", "Modello checklist duplicato"),
      "create",
    );
    setActive(data.id);
    toast.success(t("toasts.duplicated", "Modello duplicato"));
  }

  async function remove(id: string) {
    if (!isAdmin) return toast.error(t("toasts.adminOnly", "Solo amministratori"));
    const template = templates.find((item) => item.id === id);
    if (template) {
      await createVersion(
        "checklist_templates",
        id,
        template as unknown as Record<string, unknown>,
        undefined,
        t("changeNotes.deleted", "Modello checklist eliminato"),
        "delete",
      );
    }
    await deleteMut.mutateAsync(id);
    toast.success(t("toasts.deleted", "Modello eliminato"));
    if (active === id) setActive(null);
  }

  async function update(
    tmpl: Template,
    patch: Partial<Template>,
    changeNote = t("changeNotes.updated", "Modello checklist aggiornato"),
  ) {
    const dbPatch: TablesUpdate<"checklist_templates"> = {
      ...patch,
      structure: patch.structure as unknown as Json | undefined,
    };
    await updateMut.mutateAsync({ id: tmpl.id, patch: dbPatch });
    const next = { ...tmpl, ...patch } as Template;
    await createVersion(
      "checklist_templates",
      tmpl.id,
      next as unknown as Record<string, unknown>,
      Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [
          key,
          { from: (tmpl as unknown as Record<string, unknown>)[key], to: value },
        ]),
      ) as Record<string, { from: unknown; to: unknown }>,
      changeNote,
      "update",
    );
    setTemplates((ts) => ts.map((x) => (x.id === tmpl.id ? ({ ...x, ...patch } as Template) : x)));
  }

  const current = templates.find((t) => t.id === active);

  if (listQuery.isError) {
    return (
      <PageFetchError
        message={errorMessage(listQuery.error, t("toasts.loadChecklists", "Impossibile caricare le checklist"))}
        onRetry={() => void listQuery.refetch()}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className="pc-card">
        <div className="pc-card-hd">
          <span className="pc-card-title">{t("sidebar.templates", "Modelli")}</span>
          {canEdit && (
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={createNew}>
              <Plus className="w-3 h-3" /> {t("actions.new", "Nuovo")}
            </button>
          )}
        </div>
        <div className="pc-card-body flex flex-col gap-1.5">
          {loading && <ListSkeleton rows={5} variant="app" className="gap-1.5" />}
          {!loading && !templates.length && (
            <PageEmptyState
              className="border-0 shadow-none bg-transparent p-4"
              title={t("emptyTitle", "Nessun modello checklist")}
              description={t("emptyDescription", "Creane uno con il pulsante Nuovo in alto per iniziare.")}
            />
          )}
          {templates.map((tmpl) => {
            const on = tmpl.id === active;
            return (
              <button
                key={tmpl.id}
                onClick={() => setActive(tmpl.id)}
                className="text-left p-2.5 rounded-[7px] transition-all"
                style={{
                  background: on ? "var(--accent2)" : "var(--surface2)",
                  border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[13px] font-semibold flex-1 truncate"
                    style={{ color: on ? "var(--accent)" : "var(--text)" }}
                  >
                    {tmpl.name}
                  </span>
                  <VersionBadge entityType="checklist_templates" entityId={tmpl.id} />
                  {tmpl.is_default && (
                    <Star className="w-3 h-3 fill-current" style={{ color: "var(--warn)" }} />
                  )}
                </div>

                {tmpl.description && (
                  <div className="text-[11px] text-text3 truncate mt-0.5">{tmpl.description}</div>
                )}
                <div className="text-[10px] text-text3 font-mono mt-1">
                  {Object.values(tmpl.structure || {}).reduce((a, c) => a + (c.items?.length || 0), 0)}{" "}
                  {t("itemsCount", "voci")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {current ? (
        <TemplateEditor
          key={current.id}
          template={current}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onUpdate={(p, n) => update(current, p, n)}
          onDelete={() => setDeleteTemplateTarget(current)}
          onOpenVersions={() => setVersionHistoryOpen(true)}
          onSetDefault={() => setDefault(current.id)}
          onDuplicate={() => duplicate(current)}
          technicians={technicians}
        />
      ) : (
        <div className="pc-card flex items-center justify-center min-h-[400px]">
          <div className="text-text3 text-sm">{t("selectPrompt", "Seleziona o crea un modello")}</div>
        </div>
      )}
      <VersionHistoryDrawer
        entityType="checklist_templates"
        entityId={active || ""}
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        onRestored={() => void listQuery.refetch()}
      />
      <DestructiveConfirmDialog
        open={!!deleteTemplateTarget}
        title={t("deleteDialog.title", "Eliminare questo modello?")}
        description={
          deleteTemplateTarget
            ? t("deleteDialog.description", { name: deleteTemplateTarget.name, defaultValue: "Il modello verra' rimosso." })
            : t("deleteDialog.descriptionGeneric", "Il modello e tutta la sua struttura verranno rimossi. L'azione non puo' essere annullata.")
        }
        confirmLabel={t("deleteDialog.confirm", "Elimina modello")}
        loadingLabel={t("deleteDialog.loading", "Eliminazione...")}
        onOpenChange={(open) => !open && setDeleteTemplateTarget(null)}
        onConfirm={async () => {
          if (deleteTemplateTarget) await remove(deleteTemplateTarget.id);
        }}
      />
    </div>
  );
}

function TemplateEditor({
  template,
  canEdit,
  isAdmin,
  onUpdate,
  onDelete,
  onSetDefault,
  onOpenVersions,
  onDuplicate,
  technicians,
}: {
  template: Template;
  canEdit: boolean;
  isAdmin: boolean;
  onUpdate: (p: Partial<Template>, changeNote?: string) => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onOpenVersions: () => void;
  onDuplicate: () => void;
  technicians: TechnicianOption[];
}) {
  const { t } = useTranslation("checklist");
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description || "");
  const [struct, setStruct] = useState<ChecklistStructure>(template.structure || {});
  const [activeTab, setActiveTab] = useState<string>(
    Object.keys(template.structure || {})[0] || "",
  );
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [tabLabel, setTabLabel] = useState("");
  const [deleteSectionKey, setDeleteSectionKey] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setName(template.name);
    setDesc(template.description || "");
    setStruct(template.structure || {});
    setActiveTab(Object.keys(template.structure || {})[0] || "");
    setPreviewMode(false);
  }, [template.description, template.id, template.name, template.structure]);

  function persist(s: ChecklistStructure, changeNote = t("changeNotes.structureUpdated", "Struttura checklist aggiornata")) {
    setStruct(s);
    onUpdate({ structure: s }, changeNote);
  }

  function addTab() {
    const key = "sec_" + Math.random().toString(36).slice(2, 8);
    persist(
      { ...struct, [key]: { label: t("newSection", "Nuova sezione"), items: [] } },
      t("changeNotes.sectionAdded", "Sezione checklist aggiunta"),
    );
    setActiveTab(key);
  }
  function renameTab(key: string, label: string) {
    persist({ ...struct, [key]: { ...struct[key], label } }, t("changeNotes.sectionRenamed", "Sezione checklist rinominata"));
  }
  function removeTab(key: string) {
    const c = { ...struct };
    delete c[key];
    persist(c, t("changeNotes.sectionRemoved", "Sezione checklist rimossa"));
    setActiveTab(Object.keys(c)[0] || "");
  }
  function addItem() {
    const id = "i_" + Math.random().toString(36).slice(2, 8);
    const items = [...(struct[activeTab]?.items || []), { id, text: t("newItem", "Nuova voce") }];
    persist({ ...struct, [activeTab]: { ...struct[activeTab], items } }, t("changeNotes.itemAdded", "Voce checklist aggiunta"));
  }
  function updateItem(id: string, text: string) {
    const items = struct[activeTab].items.map((i) => (i.id === id ? { ...i, text } : i));
    persist(
      { ...struct, [activeTab]: { ...struct[activeTab], items } },
      t("changeNotes.itemUpdated", "Voce checklist aggiornata"),
    );
  }
  function updateItemType(id: string, type: "checkbox" | "text" | "number") {
    const items = struct[activeTab].items.map((i) => (i.id === id ? { ...i, type } : i));
    persist({ ...struct, [activeTab]: { ...struct[activeTab], items } }, t("changeNotes.itemTypeChanged", "Tipo voce modificato"));
  }
  function updateSectionAssignee(key: string, assignedTo: string) {
    persist(
      { ...struct, [key]: { ...struct[key], assigned_to: assignedTo || null } },
      assignedTo ? t("changeNotes.sectionAssigned", "Tecnico assegnato alla sezione") : t("changeNotes.sectionUnassigned", "Assegnazione sezione rimossa"),
    );
  }

  function updateItemRequired(id: string, required: boolean) {
    const items = struct[activeTab].items.map((i) => (i.id === id ? { ...i, required } : i));
    persist(
      { ...struct, [activeTab]: { ...struct[activeTab], items } },
      required ? t("changeNotes.itemRequired", "Voce impostata come obbligatoria") : t("changeNotes.itemOptional", "Voce impostata come opzionale"),
    );
  }
  function removeItem(id: string) {
    const items = struct[activeTab].items.filter((i) => i.id !== id);
    persist({ ...struct, [activeTab]: { ...struct[activeTab], items } }, t("changeNotes.itemRemoved", "Voce checklist rimossa"));
  }

  // -- Drag & drop -----------------------------------------------------------
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    function parseDragId(id: string): [string, string] {
      const idx = id.indexOf(":");
      return [id.slice(0, idx), id.slice(idx + 1)];
    }

    // Dropped on a section tab (cross-section move to end)
    if (overStr.startsWith("section:")) {
      const targetSection = overStr.slice(8);
      const [srcSec, itemId] = parseDragId(activeStr);
      if (!struct[srcSec] || !struct[targetSection] || srcSec === targetSection) return;
      const srcItems = [...struct[srcSec].items];
      const idx = srcItems.findIndex((i) => i.id === itemId);
      if (idx === -1) return;
      const [moved] = srcItems.splice(idx, 1);
      const tgtItems = [...struct[targetSection].items];
      tgtItems.push(moved);
      persist(
        {
          ...struct,
          [srcSec]: { ...struct[srcSec], items: srcItems },
          [targetSection]: { ...struct[targetSection], items: tgtItems },
        },
        t("changeNotes.itemMovedSection", "Voce spostata tra sezioni"),
      );
      return;
    }

    // Dropped on another item
    const [srcSec, itemId] = parseDragId(activeStr);
    const [tgtSec, targetItemId] = parseDragId(overStr);

    if (srcSec === tgtSec) {
      // Same section - reorder
      const items = [...struct[srcSec].items];
      const oldIdx = items.findIndex((i) => i.id === itemId);
      const newIdx = items.findIndex((i) => i.id === targetItemId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(items, oldIdx, newIdx);
      persist(
        { ...struct, [srcSec]: { ...struct[srcSec], items: reordered } },
        t("changeNotes.itemReordered", "Voce checklist riordinata"),
      );
    } else {
      // Different section - move before target
      const srcItems = [...struct[srcSec].items];
      const srcIdx = srcItems.findIndex((i) => i.id === itemId);
      if (srcIdx === -1) return;
      const [moved] = srcItems.splice(srcIdx, 1);
      const tgtItems = [...struct[tgtSec].items];
      const tgtIdx = tgtItems.findIndex((i) => i.id === targetItemId);
      if (tgtIdx >= 0) tgtItems.splice(tgtIdx, 0, moved);
      else tgtItems.push(moved);
      persist(
        {
          ...struct,
          [srcSec]: { ...struct[srcSec], items: srcItems },
          [tgtSec]: { ...struct[tgtSec], items: tgtItems },
        },
        t("changeNotes.itemMovedSection", "Voce spostata tra sezioni"),
      );
    }
  }

  const itemIds =
    activeTab && struct[activeTab]
      ? struct[activeTab].items.map((it) => `${activeTab}:${it.id}`)
      : [];

  return (
    <>
      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-2">
          {/* Row 1: title + default badge */}
          <div className="flex items-center gap-2">
            <input
              className="pc-input max-w-[280px] !text-[14px] !font-semibold"
              value={name}
              disabled={!canEdit}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== template.name && onUpdate({ name }, t("changeNotes.nameUpdated", "Nome checklist aggiornato"))}
            />
            {template.is_default && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0"
                style={{ background: "var(--warn-bg, #fef9e7)", color: "var(--warn)", border: "1px solid var(--warn-border, #f59e0b40)" }}
              >
                <Star className="w-3 h-3 fill-current" /> {t("default", "Predefinito")}
              </span>
            )}
          </div>
          {/* Row 2: action buttons */}
          <div className="flex items-center gap-2">
            {/* Preview toggle */}
            {canEdit && (
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={() => setPreviewMode((p) => !p)}
                title={previewMode ? t("editToggle", "Torna a modifica") : t("previewToggle", "Anteprima")}
              >
                {previewMode ? (
                  <>
                    <EyeOff className="w-3 h-3" /> {t("actions.edit", "Modifica")}
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" /> {t("actions.preview", "Anteprima")}
                  </>
                )}
              </button>
            )}

            {/* Duplicate */}
            {canEdit && (
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onDuplicate}>
                <Copy className="w-3 h-3" /> {t("actions.duplicate", "Duplica")}
              </button>
            )}

            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onOpenVersions}>
              <History className="w-3 h-3" /> {t("actions.versions", "Versioni")}
            </button>

            {isAdmin && !template.is_default && (
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={onSetDefault}
                title={t("setAsDefault", "Imposta come predefinito")}
              >
                <StarOff className="w-3 h-3" /> {t("setDefault", "Imposta predefinito")}
              </button>
            )}
            {isAdmin && (
              <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={onDelete}>
                <Trash2 className="w-3 h-3" /> {t("delete", "Elimina")}
              </button>
            )}
          </div>
        </div>

        <div className="px-5 pt-4">
          <input
            className="pc-input"
            placeholder={t("descriptionPlaceholder", "Descrizione (opzionale)")}
            value={desc}
            disabled={!canEdit}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() =>
              desc !== (template.description || "") &&
              onUpdate({ description: desc }, t("changeNotes.descriptionUpdated", "Descrizione checklist aggiornata"))
            }
          />
        </div>

        <div className="border-b mt-4 px-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1 overflow-x-auto">
            {Object.keys(struct).map((k) => {
              const on = activeTab === k;
              const isEditing = editingTab === k;
              return (
                <div key={k} className="flex items-center -mb-px">
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        autoFocus
                        className="pc-input !py-1 !text-[12px] max-w-[140px]"
                        value={tabLabel}
                        onChange={(e) => setTabLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            renameTab(k, tabLabel);
                            setEditingTab(null);
                          }
                        }}
                      />
                      <button
                        className="pc-btn-icon touch-target"
                        onClick={() => {
                          renameTab(k, tabLabel);
                          setEditingTab(null);
                        }}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button className="pc-btn-icon touch-target" onClick={() => setEditingTab(null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveTab(k)}
                      onDoubleClick={() => {
                        if (canEdit && !previewMode) {
                          setEditingTab(k);
                          setTabLabel(struct[k].label);
                        }
                      }}
                      className="px-3 py-2 text-[12.5px] font-semibold border-b-2 transition-colors flex items-center gap-1.5"
                      style={{
                        color: on ? "var(--accent)" : "var(--text3)",
                        borderColor: on ? "var(--accent)" : "transparent",
                      }}
                    >
                      {struct[k].label}
                      <span className="font-mono text-[10px] opacity-60">
                        {struct[k].items.length}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
              {canEdit && !previewMode && (
                <button
                  onClick={addTab}
                  className="px-2.5 py-2 text-text3 hover:text-accent"
                  title={t("addSectionTitle", "Aggiungi sezione")}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
          </div>
        </div>

        <div className="pc-card-body flex flex-col gap-1.5">
          {activeTab && struct[activeTab] && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-text3 uppercase tracking-wider">
                  {t("sectionItems", "Voci della sezione")}
                </span>
                {canEdit && !previewMode && (
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm ml-auto"
                    onClick={() => {
                      setEditingTab(activeTab);
                      setTabLabel(struct[activeTab].label);
                    }}
                  >
                    <Pencil className="w-3 h-3" /> {t("rename", "Rinomina")}
                  </button>
                )}
                {canEdit && !previewMode && Object.keys(struct).length > 1 && (
                  <button
                    className="pc-btn pc-btn-danger pc-btn-sm"
                    onClick={() => setDeleteSectionKey(activeTab)}
                  >
                    <Trash2 className="w-3 h-3" /> {t("section", "Sezione")}
                  </button>
                )}
              </div>

              <div
                className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border p-2"
                style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
              >
                <span className="text-[12px] font-semibold">{t("assignTech", "Assegna sezione a tecnico")}</span>
                {canEdit && !previewMode ? (
                  <select
                    className="pc-input h-8 max-w-[260px] py-0 text-[12px] leading-normal"
                    value={struct[activeTab].assigned_to ?? ""}
                    onChange={(event) => updateSectionAssignee(activeTab, event.target.value)}
                  >
                    <option value="">{t("noSpecificTechShort", "\u2014 Nessun tecnico specifico \u2014")}</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[12px] text-text3">
                    {technicians.find((tech) => tech.id === struct[activeTab].assigned_to)
                      ?.full_name || t("noSpecificTech", "Nessun tecnico specifico")}
                  </span>
                )}
              </div>

              {/* DnD Context for sortable items */}
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  {struct[activeTab].items.map((it) => (
                    <SortableChecklistItem
                      key={it.id}
                      item={it}
                      sectionKey={activeTab}
                      canEdit={canEdit}
                      previewMode={previewMode}
                      onUpdate={updateItem}
                      onRemove={removeItem}
                      onTypeChange={updateItemType}
                      onRequiredChange={updateItemRequired}
                    />
                  ))}
                </SortableContext>

                <DragOverlay>
                  {activeDragId ? (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-[7px] opacity-80"
                      style={{
                        background: "var(--surface2)",
                        border: "1px solid var(--accent)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      }}
                    >
                      <GripVertical className="w-3 h-3 text-text3" />
                      <span className="text-[13px]">
                        {(() => {
                          const [sec, itId] = activeDragId.includes(":")
                            ? [activeDragId.split(":")[0], activeDragId.split(":")[1]]
                            : [activeTab, activeDragId];
                          const found = struct[sec]?.items.find((i) => i.id === itId);
                          return found?.text || t("item", "Voce");
                        })()}
                      </span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>

              {canEdit && !previewMode && (
                <button
                  onClick={addItem}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[7px] text-[12px] text-text3 hover:text-accent transition-colors"
                  style={{ border: "1.5px dashed var(--border2)" }}
                >
                  <Plus className="w-3.5 h-3.5" /> {t("addItem", "Aggiungi voce")}
                </button>
              )}
              {!struct[activeTab].items.length && (
                <div className="text-center py-6 text-text3 text-[12px]">
                  {previewMode
                    ? t("noItems", "Nessuna voce")
                    : t("noItemsHint", "Nessuna voce. Aggiungine una con il pulsante sopra.")}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <DestructiveConfirmDialog
        open={!!deleteSectionKey}
        title={t("deleteSectionDialog.title", "Eliminare questa sezione?")}
        description={
          deleteSectionKey && struct[deleteSectionKey]
            ? t("deleteSectionDialog.description", { label: struct[deleteSectionKey].label, defaultValue: "La sezione verra' rimossa." })
            : t("deleteSectionDialog.descriptionGeneric", "La sezione e tutte le sue voci verranno rimosse dal modello. L'azione non puo' essere annullata.")
        }
        confirmLabel={t("deleteSectionDialog.confirm", "Elimina sezione")}
        loadingLabel={t("deleteDialog.loading", "Eliminazione...")}
        onOpenChange={(open) => !open && setDeleteSectionKey(null)}
        onConfirm={async () => {
          if (deleteSectionKey) removeTab(deleteSectionKey);
        }}
      />
    </>
  );
}

// --- Sortable checklist item row ------------------------------------------
function SortableChecklistItem({
  item,
  sectionKey,
  canEdit,
  previewMode,
  onUpdate,
  onRemove,
  onTypeChange,
  onRequiredChange,
}: {
  item: ChecklistItemDef;
  sectionKey: string;
  canEdit: boolean;
  previewMode: boolean;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onTypeChange: (id: string, type: "checkbox" | "text" | "number") => void;
  onRequiredChange: (id: string, required: boolean) => void;
}) {
  const { t } = useTranslation("checklist");
  const dndId = `${sectionKey}:${item.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dndId,
  });

  const inEdit = canEdit && !previewMode;
  const itemType = item.type || "checkbox";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: "var(--surface2)",
        border: "1px solid var(--border)",
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-[7px]"
    >
      {/* Drag handle */}
      {inEdit && (
        <button
          className="pc-btn-icon touch-target cursor-grab"
          {...attributes}
          {...listeners}
          title={t("dragReorder", "Trascina per riordinare")}
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}

      {/* Type icon */}
      {itemType === "checkbox" && (
        <span
          className="w-[17px] h-[17px] rounded flex-shrink-0"
          style={{ border: "1.5px solid var(--border2)" }}
        />
      )}
      {itemType === "text" && <Type className="w-3.5 h-3.5 text-text3 flex-shrink-0" />}
      {itemType === "number" && <Hash className="w-3.5 h-3.5 text-text3 flex-shrink-0" />}

      {/* Item text or preview input */}
      {inEdit ? (
        <input
          className="flex-1 bg-transparent outline-none text-[13px]"
          value={item.text}
          onChange={(e) => onUpdate(item.id, e.target.value)}
        />
      ) : itemType === "checkbox" ? (
        <span className="flex-1 text-[13px]">{item.text}</span>
      ) : itemType === "text" ? (
        <div className="flex-1 flex items-center">
          <input
            className="w-full bg-transparent outline-none text-[13px] border-b border-dashed border-border2 px-1 pb-0.5"
            placeholder={t("textPlaceholder", "Inserisci testo...")}
            disabled
            value=""
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center">
          <input
            className="bg-transparent outline-none text-[13px] border-b border-dashed border-border2 px-1 pb-0.5 max-w-[100px]"
            placeholder="0"
            disabled
            value=""
          />
        </div>
      )}

      {/* Required badge (preview) */}
      {!inEdit && item.required && (
        <span className="text-[10px] text-red-500 font-bold flex-shrink-0" title={t("requiredLabel", "Obbligatoria")}>
          *
        </span>
      )}

      {/* Required toggle (edit) */}
      {inEdit && (
        <button
          className={`pc-btn-icon touch-target ${item.required ? "text-red-500" : "opacity-30"}`}
          onClick={() => onRequiredChange(item.id, !item.required)}
          title={item.required ? t("requiredLabel", "Obbligatoria") : t("notRequired", "Non obbligatoria")}
        >
          <Asterisk className="w-3 h-3" />
        </button>
      )}

      {/* Type selector (edit) */}
      {inEdit && (
        <select
          className="pc-input !py-0 !text-[11px] w-[90px] flex-shrink-0"
          value={itemType}
          onChange={(e) => onTypeChange(item.id, e.target.value as "checkbox" | "text" | "number")}
        >
          <option value="checkbox">{t("typeCheckbox", "Checkbox")}</option>
          <option value="text">{t("typeText", "Testo")}</option>
          <option value="number">{t("typeNumber", "Numero")}</option>
        </select>
      )}

      {/* Remove button */}
      {inEdit && (
        <button
          className="pc-btn-icon touch-target flex-shrink-0"
          onClick={() => onRemove(item.id)}
          title={t("remove", "Rimuovi")}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
