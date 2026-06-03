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
import { createLazyFileRoute } from "@tanstack/react-router";
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
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ListSkeleton,
  PageEmptyState,
  PageFetchError,
} from "@/components/page-states";
import { VersionBadge } from "@/components/pcready/VersionBadge";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/errors";
import { DEFAULT_STRUCTURE, type ChecklistItemDef, type ChecklistStructure } from "@/lib/pcready";
import {
  useChecklistTemplates,
  useTemplateCompletionStats,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useSetDefaultTemplate,
} from "@/lib/queries/checklist";
import { createVersion } from "@/lib/versioning";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";

export const Route = createLazyFileRoute("/_app/checklist")({
  component: ChecklistPage,
});

interface Template {
  id: string;
  name: string;
  description: string | null;
  structure: ChecklistStructure;
  is_default: boolean;
  tags: string[];
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
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const listQuery = useChecklistTemplates();
  const statsQuery = useTemplateCompletionStats();
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
      tags: tmpl.tags || [],
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

  // ── Tag filter ──
  const allTags = Array.from(
    new Set(templates.flatMap((tmpl) => tmpl.tags || [])),
  ).sort((a, b) => a.localeCompare(b));
  const filteredTemplates = tagFilter
    ? templates.filter((tmpl) => (tmpl.tags || []).includes(tagFilter))
    : templates;
  const completionStats = (statsQuery.data ?? {}) as Record<string, { total: number; completed: number }>;

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
              <Plus className="size-3" /> {t("actions.new", "Nuovo")}
            </button>
          )}
        </div>
        <div className="pc-card-body flex flex-col gap-1.5">
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-1">
              <button
                onClick={() => setTagFilter(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                  !tagFilter
                    ? "text-white"
                    : "text-text3 hover:text-text"
                }`}
                style={{ background: !tagFilter ? "var(--accent)" : "var(--surface2)" }}
              >
                {t("allTags", "Tutti")}
              </button>
              {allTags.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                    tagFilter === tag
                      ? "text-white"
                      : "text-text3 hover:text-text"
                  }`}
                  style={{ background: tagFilter === tag ? "var(--accent)" : "var(--surface2)" }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          {loading && <ListSkeleton rows={5} variant="app" className="gap-1.5" />}
          {!loading && !filteredTemplates.length && !tagFilter && (
            <PageEmptyState
              className="border-0 shadow-none bg-transparent p-4"
              title={t("emptyTitle", "Nessun modello checklist")}
              description={t("emptyDescription", "Creane uno con il pulsante Nuovo in alto per iniziare.")}
            />
          )}
          {!loading && !filteredTemplates.length && tagFilter && (
            <div className="text-center py-4 text-text3 text-[12px]">
              {t("noFilteredTemplates", "Nessun modello con questo tag")}
            </div>
          )}
          {filteredTemplates.map((tmpl) => {
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
                    <Star className="size-3 fill-current" style={{ color: "var(--warn)" }} />
                  )}
                </div>

                {tmpl.description && (
                  <div className="text-[11px] text-text3 truncate mt-0.5">{tmpl.description}</div>
                )}
                <div className="text-[10px] text-text3 font-mono mt-1">
                  {Object.values(tmpl.structure || {}).reduce((a, group) => {
                    const sections = (group as any).sections || {};
                    return a + Object.values(sections).reduce((b: number, sec: any) => b + ((sec as any).items?.length || 0), 0);
                  }, 0)}{" "}
                  {t("itemsCount", "voci")}
                </div>
                {/* Completion progress bar */}
                {completionStats[tmpl.id] && completionStats[tmpl.id].total > 0 && (() => {
                  const stat = completionStats[tmpl.id];
                  const pct = Math.round((stat.completed / stat.total) * 100);
                  return (
                  <div className="mt-1.5">
                    <div className="w-full h-[4px] rounded-full overflow-hidden" style={{ background: "var(--border2)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: "var(--success)",
                        }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-text3 mt-0.5">
                      {t("completionStats", {
                        completed: stat.completed,
                        total: stat.total,
                        pct,
                      })}
                    </div>
                  </div>
                  );
                })()}
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
  const groups = struct || {};
  const groupKeys = Object.keys(groups);
  const [activeGroup, setActiveGroup] = useState<string>(groupKeys[0] || "");
  const activeGroupSections = activeGroup ? (groups[activeGroup]?.sections || {}) : {};
  const sectionKeys = Object.keys(activeGroupSections);
  const [activeSection, setActiveSection] = useState<string>(sectionKeys[0] || "");
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [tabLabel, setTabLabel] = useState("");
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState("");
  const [deleteSectionKey, setDeleteSectionKey] = useState<string | null>(null);
  const [deleteGroupKey, setDeleteGroupKey] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setName(template.name);
    setDesc(template.description || "");
    const s = template.structure || {};
    setStruct(s);
    const gk = Object.keys(s);
    const g = gk[0] || "";
    setActiveGroup(g);
    const sk = g ? Object.keys(s[g]?.sections || {}) : [];
    setActiveSection(sk[0] || "");
    setPreviewMode(false);
  }, [template.description, template.id, template.name, template.structure]);

  const section = activeGroup && activeSection ? groups[activeGroup]?.sections?.[activeSection] : null;
  const activeSectionData = section;

  function persist(s: ChecklistStructure, changeNote = t("changeNotes.structureUpdated", "Struttura checklist aggiornata")) {
    setStruct(s);
    onUpdate({ structure: s }, changeNote);
  }

  // ── Group operations ──
  function addGroup() {
    const key = "grp_" + Math.random().toString(36).slice(2, 8);
    const next = {
      ...struct,
      [key]: { label: t("newGroup", "Nuovo gruppo"), sections: {} },
    };
    persist(next, t("changeNotes.groupAdded", "Gruppo checklist aggiunto"));
    setActiveGroup(key);
    setActiveSection("");
  }
  function renameGroup(key: string, label: string) {
    persist(
      { ...struct, [key]: { ...struct[key], label } },
      t("changeNotes.groupRenamed", "Gruppo checklist rinominato"),
    );
  }
  function toggleGroupCollapse(key: string) {
    const g = struct[key];
    const next = { ...struct, [key]: { ...g, collapsed: !g.collapsed } };
    setStruct(next);
    onUpdate({ structure: next });
  }

  // ── Section operations ──
  function addSection() {
    if (!activeGroup) return;
    const key = "sec_" + Math.random().toString(36).slice(2, 8);
    const next = {
      ...struct,
      [activeGroup]: {
        ...struct[activeGroup],
        sections: { ...struct[activeGroup].sections, [key]: { label: t("newSection", "Nuova sezione"), items: [] } },
      },
    };
    persist(next, t("changeNotes.sectionAdded", "Sezione checklist aggiunta"));
    setActiveSection(key);
  }
  function renameSection(key: string, label: string) {
    if (!activeGroup) return;
    const g = struct[activeGroup];
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [key]: { ...g.sections[key], label } } } },
      t("changeNotes.sectionRenamed", "Sezione checklist rinominata"),
    );
  }
  // ── Group deletion ──
  function removeGroup(key: string) {
    const s = { ...struct };
    delete s[key];
    persist(s, t("changeNotes.groupRemoved", "Gruppo checklist rimosso"));
    const gk = Object.keys(s);
    setActiveGroup(gk[0] || "");
    setActiveSection("");
  }

  function removeSection(key: string) {
    if (!activeGroup) return;
    const g = struct[activeGroup];
    const sec = { ...g.sections };
    delete sec[key];
    const next = { ...struct, [activeGroup]: { ...g, sections: sec } };
    persist(next, t("changeNotes.sectionRemoved", "Sezione checklist rimossa"));
    const sk = Object.keys(sec);
    setActiveSection(sk[0] || "");
  }
  function updateSectionAssignee(key: string, assignedTo: string) {
    if (!activeGroup) return;
    const g = struct[activeGroup];
    const sec = g.sections[key];
    if (!sec) return;
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [key]: { ...sec, assigned_to: assignedTo || null } } } },
      assignedTo ? t("changeNotes.sectionAssigned", "Tecnico assegnato alla sezione") : t("changeNotes.sectionUnassigned", "Assegnazione sezione rimossa"),
    );
  }

  // ── Item operations ──
  function addItem() {
    if (!activeGroup || !activeSection) return;
    const id = "i_" + Math.random().toString(36).slice(2, 8);
    const g = struct[activeGroup];
    const sec = g.sections[activeSection];
    const items = [...(sec?.items || []), { id, text: t("newItem", "Nuova voce") }];
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [activeSection]: { ...sec, items } } } },
      t("changeNotes.itemAdded", "Voce checklist aggiunta"),
    );
  }
  function updateItem(id: string, text: string) {
    if (!activeGroup || !activeSection) return;
    const g = struct[activeGroup];
    const sec = g.sections[activeSection];
    const items = sec.items.map((i) => (i.id === id ? { ...i, text } : i));
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [activeSection]: { ...sec, items } } } },
      t("changeNotes.itemUpdated", "Voce checklist aggiornata"),
    );
  }
  function updateItemType(id: string, type: "checkbox" | "text" | "number") {
    if (!activeGroup || !activeSection) return;
    const g = struct[activeGroup];
    const sec = g.sections[activeSection];
    const items = sec.items.map((i) => (i.id === id ? { ...i, type } : i));
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [activeSection]: { ...sec, items } } } },
      t("changeNotes.itemTypeChanged", "Tipo voce modificato"),
    );
  }
  function updateItemRequired(id: string, required: boolean) {
    if (!activeGroup || !activeSection) return;
    const g = struct[activeGroup];
    const sec = g.sections[activeSection];
    const items = sec.items.map((i) => (i.id === id ? { ...i, required } : i));
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [activeSection]: { ...sec, items } } } },
      required ? t("changeNotes.itemRequired", "Voce impostata come obbligatoria") : t("changeNotes.itemOptional", "Voce impostata come opzionale"),
    );
  }
  function removeItem(id: string) {
    if (!activeGroup || !activeSection) return;
    const g = struct[activeGroup];
    const sec = g.sections[activeSection];
    const items = sec.items.filter((i) => i.id !== id);
    persist(
      { ...struct, [activeGroup]: { ...g, sections: { ...g.sections, [activeSection]: { ...sec, items } } } },
      t("changeNotes.itemRemoved", "Voce checklist rimossa"),
    );
  }

  // -- Drag & drop (two-level: group:section:item) --------------------------
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    // Parse 3-part ID: group:section:item
    function parse3Part(id: string): [string, string, string] {
      const parts = id.split(":");
      return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
    }

    // Dropped on another item (same section reorder or cross-section move)
    const [srcGroup, srcSection, itemId] = parse3Part(activeStr);
    const [tgtGroup, tgtSection, targetItemId] = parse3Part(overStr);

    if (!srcGroup || !srcSection || !tgtGroup || !tgtSection) return;

    if (srcGroup === tgtGroup && srcSection === tgtSection) {
      // Same section — reorder
      const items = [...(struct[srcGroup]?.sections?.[srcSection]?.items ?? [])];
      const oldIdx = items.findIndex((i) => i.id === itemId);
      const newIdx = items.findIndex((i) => i.id === targetItemId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(items, oldIdx, newIdx);
      const g = struct[srcGroup];
      persist(
        { ...struct, [srcGroup]: { ...g, sections: { ...g.sections, [srcSection]: { ...g.sections[srcSection], items: reordered } } } },
        t("changeNotes.itemReordered", "Voce checklist riordinata"),
      );
    } else {
      // Different section/group — move before target
      const srcG = struct[srcGroup];
      const tgtG = struct[tgtGroup];
      if (!srcG?.sections?.[srcSection] || !tgtG?.sections?.[tgtSection]) return;

      const srcItems = [...srcG.sections[srcSection].items];
      const srcIdx = srcItems.findIndex((i) => i.id === itemId);
      if (srcIdx === -1) return;
      const [moved] = srcItems.splice(srcIdx, 1);
      const tgtItems = [...tgtG.sections[tgtSection].items];
      const tgtIdx = tgtItems.findIndex((i) => i.id === targetItemId);
      if (tgtIdx >= 0) tgtItems.splice(tgtIdx, 0, moved);
      else tgtItems.push(moved);

      const updated = { ...struct };
      updated[srcGroup] = { ...srcG, sections: { ...srcG.sections, [srcSection]: { ...srcG.sections[srcSection], items: srcItems } } };
      updated[tgtGroup] = { ...tgtG, sections: { ...tgtG.sections, [tgtSection]: { ...tgtG.sections[tgtSection], items: tgtItems } } };
      persist(updated, t("changeNotes.itemMovedSection", "Voce spostata tra sezioni"));
    }
  }

  const itemIds =
    activeGroup && activeSection && groups[activeGroup]?.sections?.[activeSection]
      ? groups[activeGroup].sections[activeSection].items.map((it) => `${activeGroup}:${activeSection}:${it.id}`)
      : [];

  return (
    <>
      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-2">
          {/* Row 1: title + default badge */}
          <div className="flex items-center gap-2">
            <input
              aria-label={t("templateName", "Nome modello")}
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
                <Star className="size-3 fill-current" /> {t("default", "Predefinito")}
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
                    <EyeOff className="size-3" /> {t("actions.edit", "Modifica")}
                  </>
                ) : (
                  <>
                    <Eye className="size-3" /> {t("actions.preview", "Anteprima")}
                  </>
                )}
              </button>
            )}

            {/* Duplicate */}
            {canEdit && (
              <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onDuplicate}>
                <Copy className="size-3" /> {t("actions.duplicate", "Duplica")}
              </button>
            )}

            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onOpenVersions}>
              <History className="size-3" /> {t("actions.versions", "Versioni")}
            </button>

            {isAdmin && !template.is_default && (
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={onSetDefault}
                title={t("setAsDefault", "Imposta come predefinito")}
              >
                <StarOff className="size-3" /> {t("setDefault", "Imposta predefinito")}
              </button>
            )}
            {isAdmin && (
              <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={onDelete}>
                <Trash2 className="size-3" /> {t("delete", "Elimina")}
              </button>
            )}
          </div>
        </div>

        <div className="px-5 pt-4 flex flex-col gap-3">
          <input
            aria-label={t("descriptionLabel", "Descrizione")}
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
          {/* Tags input */}
          <TagInput
            tags={template.tags || []}
            canEdit={canEdit}
            onChange={(newTags) => onUpdate({ tags: newTags }, t("changeNotes.tagsUpdated", "Tag checklist aggiornati"))}
          />
        </div>

        <div className="border-b mt-4 px-3" style={{ borderColor: "var(--border)" }}>
          {/* Groups accordion */}
          <div className="flex flex-col gap-0.5">
            {groupKeys.map((gk) => {
              const group = groups[gk];
              const isCollapsed = group.collapsed || false;
              const isActive = gk === activeGroup;
              const secKeys = Object.keys(group.sections || {});
              return (
                <div key={gk}>
                  {/* Group header */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (isCollapsed) {
                          // Expand and activate
                          toggleGroupCollapse(gk);
                          setActiveGroup(gk);
                          const sk = Object.keys(group.sections || {});
                          setActiveSection(sk[0] || "");
                        } else if (isActive) {
                          toggleGroupCollapse(gk);
                        } else {
                          setActiveGroup(gk);
                          const sk = Object.keys(group.sections || {});
                          setActiveSection(sk[0] || "");
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1.5 text-[12.5px] font-semibold transition-colors rounded ${
                        isActive && !isCollapsed ? "" : ""
                      }`}
                      style={{
                        color: isActive && !isCollapsed ? "var(--accent)" : "var(--text3)",
                      }}
                    >
                      <span className="text-[10px]">{isCollapsed ? "▶" : "▼"}</span>
                      {editingGroupKey === gk ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            className="pc-input !py-0.5 !text-[12px] max-w-[140px]"
                            value={groupLabel}
                            onChange={(e) => setGroupLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                renameGroup(gk, groupLabel);
                                setEditingGroupKey(null);
                              }
                            }}
                          />
                          <button className="pc-btn-icon touch-target" onClick={() => { renameGroup(gk, groupLabel); setEditingGroupKey(null); }}>
                            <Check className="size-3" />
                          </button>
                          <button className="pc-btn-icon touch-target" onClick={() => setEditingGroupKey(null)}>
                            <X className="size-3" />
                          </button>
                        </div>
                      ) : (
                        <span
                          onDoubleClick={() => {
                            if (canEdit && !previewMode) {
                              setEditingGroupKey(gk);
                              setGroupLabel(group.label);
                            }
                          }}
                        >
                          {group.label}
                        </span>
                      )}
                      <span className="font-mono text-[10px] opacity-60">
                        {secKeys.length} sez
                      </span>
                    </button>
                    {canEdit && !previewMode && groupKeys.length > 1 && (
                      <button
                        className="pc-btn-icon touch-target ml-auto"
                        onClick={() => setDeleteGroupKey(gk)}
                        title={t("deleteGroup", "Elimina gruppo")}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Sections (inside expanded group) */}
                  {!isCollapsed && isActive && (
                    <div className="ml-4">
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {secKeys.map((sk) => {
                          const on = activeSection === sk;
                          const isEditing = editingTab === sk;
                          return (
                            <div key={sk} className="flex items-center -mb-px">
                              {isEditing ? (
                                <div className="flex items-center gap-1 px-2 py-1.5">
                                  <input
                                    autoFocus
                                    className="pc-input !py-1 !text-[12px] max-w-[140px]"
                                    value={tabLabel}
                                    onChange={(e) => setTabLabel(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        renameSection(sk, tabLabel);
                                        setEditingTab(null);
                                      }
                                    }}
                                  />
                                  <button className="pc-btn-icon touch-target" onClick={() => { renameSection(sk, tabLabel); setEditingTab(null); }}>
                                    <Check className="size-3" />
                                  </button>
                                  <button className="pc-btn-icon touch-target" onClick={() => setEditingTab(null)}>
                                    <X className="size-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActiveSection(sk)}
                                  onDoubleClick={() => {
                                    if (canEdit && !previewMode) {
                                      setEditingTab(sk);
                                      setTabLabel(group.sections[sk].label);
                                    }
                                  }}
                                  className="px-3 py-2 text-[12.5px] font-semibold border-b-2 transition-colors flex items-center gap-1.5"
                                  style={{
                                    color: on ? "var(--accent)" : "var(--text3)",
                                    borderColor: on ? "var(--accent)" : "transparent",
                                  }}
                                >
                                  {group.sections[sk].label}
                                  <span className="font-mono text-[10px] opacity-60">
                                    {group.sections[sk].items.length}
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {canEdit && !previewMode && (
                          <button
                            onClick={addSection}
                            className="px-2.5 py-2 text-text3 hover:text-accent"
                            title={t("addSectionTitle", "Aggiungi sezione")}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && !previewMode && (
              <button
                onClick={addGroup}
                className="px-2.5 py-2 text-text3 hover:text-accent flex items-center gap-1"
                title={t("addGroupTitle", "Aggiungi gruppo")}
              >
                <Plus className="size-3.5" /> {t("addGroup", "Aggiungi gruppo")}
              </button>
            )}
          </div>
        </div>

        <div className="pc-card-body flex flex-col gap-1.5">
          {activeSection && activeSectionData && (
            <>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-text3 uppercase tracking-wider">
                  {t("sectionItems", "Voci della sezione")}
                </span>
                {canEdit && !previewMode && (
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm ml-auto"
                    onClick={() => {
                      setEditingTab(activeSection);
                      setTabLabel(activeSectionData.label);
                    }}
                  >
                    <Pencil className="size-3" /> {t("rename", "Rinomina")}
                  </button>
                )}
                {canEdit && !previewMode && sectionKeys.length > 1 && (
                  <button
                    className="pc-btn pc-btn-danger pc-btn-sm"
                    onClick={() => setDeleteSectionKey(activeSection)}
                  >
                    <Trash2 className="size-3" /> {t("section", "Sezione")}
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
                    aria-label={t("assignTech", "Assegna sezione a tecnico")}
                    className="pc-input h-8 max-w-[260px] py-0 text-[12px] leading-normal"
                    value={(activeSectionData as any)?.assigned_to ?? ""}
                    onChange={(event) => updateSectionAssignee(activeSection, event.target.value)}
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
                    {technicians.find((tech) => tech.id === (activeSectionData as any)?.assigned_to)
                      ?.full_name || t("noSpecificTech", "Nessun tecnico specifico")}
                  </span>
                )}
              </div>

              {/* DnD for sortable items */}
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  {(activeSectionData.items || []).map((it) => (
                    <SortableChecklistItem
                      key={it.id}
                      item={it}
                      groupKey={activeGroup}
                      sectionKey={activeSection}
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
                      <GripVertical className="size-3 text-text3" />
                      <span className="text-[13px]">
                        {(() => {
                          const parts = activeDragId.split(":");
                          const grp = parts[0];
                          const sec = parts[1];
                          const itId = parts[2];
                          const found = groups[grp]?.sections?.[sec]?.items?.find((i: ChecklistItemDef) => i.id === itId);
                          return (found as ChecklistItemDef)?.text || t("item", "Voce");
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
                  <Plus className="size-3.5" /> {t("addItem", "Aggiungi voce")}
                </button>
              )}
              {!activeSectionData.items.length && (
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
          deleteSectionKey && activeGroup && groups[activeGroup]?.sections?.[deleteSectionKey]
            ? t("deleteSectionDialog.description", { label: groups[activeGroup].sections[deleteSectionKey].label, defaultValue: "La sezione verra' rimossa." })
            : t("deleteSectionDialog.descriptionGeneric", "La sezione e tutte le sue voci verranno rimosse dal modello. L'azione non puo' essere annullata.")
        }
        confirmLabel={t("deleteSectionDialog.confirm", "Elimina sezione")}
        loadingLabel={t("deleteDialog.loading", "Eliminazione...")}
        onOpenChange={(open) => !open && setDeleteSectionKey(null)}
        onConfirm={async () => {
          if (deleteSectionKey) removeSection(deleteSectionKey);
        }}
      />
      <DestructiveConfirmDialog
        open={!!deleteGroupKey}
        title={t("deleteGroupDialog.title", "Eliminare questo gruppo?")}
        description={
          deleteGroupKey && groups[deleteGroupKey]
            ? t("deleteGroupDialog.description", { label: groups[deleteGroupKey].label, defaultValue: "Il gruppo verra' rimosso con tutte le sue sezioni." })
            : t("deleteGroupDialog.descriptionGeneric", "Il gruppo e tutte le sue sezioni verranno rimossi dal modello. L'azione non puo' essere annullata.")
        }
        confirmLabel={t("deleteGroupDialog.confirm", "Elimina gruppo")}
        loadingLabel={t("deleteDialog.loading", "Eliminazione...")}
        onOpenChange={(open) => !open && setDeleteGroupKey(null)}
        onConfirm={async () => {
          if (deleteGroupKey) removeGroup(deleteGroupKey);
        }}
      />
    </>
  );
}

// --- Sortable checklist item row ------------------------------------------
function SortableChecklistItem({
  item,
  sectionKey,
  groupKey,
  canEdit,
  previewMode,
  onUpdate,
  onRemove,
  onTypeChange,
  onRequiredChange,
}: {
  item: ChecklistItemDef;
  sectionKey: string;
  groupKey: string;
  canEdit: boolean;
  previewMode: boolean;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onTypeChange: (id: string, type: "checkbox" | "text" | "number") => void;
  onRequiredChange: (id: string, required: boolean) => void;
}) {
  const { t } = useTranslation("checklist");
  const dndId = `${groupKey}:${sectionKey}:${item.id}`;
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
          <GripVertical className="size-3" />
        </button>
      )}

      {/* Type icon */}
      {itemType === "checkbox" && (
        <span
          className="w-[17px] h-[17px] rounded flex-shrink-0"
          style={{ border: "1.5px solid var(--border2)" }}
        />
      )}
      {itemType === "text" && <Type className="size-3.5 text-text3 flex-shrink-0" />}
      {itemType === "number" && <Hash className="size-3.5 text-text3 flex-shrink-0" />}

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
          <Asterisk className="size-3" />
        </button>
      )}

      {/* Type selector (edit) */}
      {inEdit && (
        <select
          aria-label={t("itemType", "Tipo voce")}
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
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}

// --- Tag input component ---------------------------------------------------
function TagInput({
  tags,
  canEdit,
  onChange,
}: {
  tags: string[];
  canEdit: boolean;
  onChange: (tags: string[]) => void;
}) {
  const { t } = useTranslation("checklist");
  const [input, setInput] = useState("");

  function addTag() {
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  if (!canEdit && !tags.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{
              background: "var(--accent2)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border, #3b82f640)",
            }}
          >
            {tag}
            {canEdit && (
              <button
                className="pc-btn-icon touch-target"
                onClick={() => removeTag(tag)}
                title={t("remove", "Rimuovi")}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1">
          <input
            className="pc-input !py-1 !text-[12px] flex-1"
            placeholder={t("tagsPlaceholder", "Aggiungi tag...")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={addTag}
            disabled={!input.trim()}
          >
            <Plus className="size-3" />
          </button>
        </div>
      )}
    </div>
  );
}
