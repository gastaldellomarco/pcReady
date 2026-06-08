import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { StreamLanguage } from "@codemirror/language";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import CodeMirror from "@uiw/react-codemirror";
import {
  Plus,
  Search,
  Copy,
  Download,
  Pencil,
  Trash2,
  Terminal,
  Shield,
  Wrench,
  Network,
  Database,
  Cog,
  Code2,
  FileCode,
  History,
  Check,
  X,
  Link2,
  Play,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Modal } from "@/components/pcready/Modal";
import { VersionBadge } from "@/components/pcready/VersionBadge";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { ScriptFavoriteButton } from "@/components/scripts/ScriptFavoriteButton";
import { ScriptParametersEditor } from "@/components/scripts/ScriptParametersEditor";
import { ScriptParametersRunner } from "@/components/scripts/ScriptParametersRunner";
import { ScriptShareDialog } from "@/components/scripts/ScriptShareDialog";
import { ScriptTagInput } from "@/components/scripts/ScriptTagInput";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { Field } from "@/components/ui/form-field";
import { useTheme } from "@/hooks/use-theme";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { buildDownloadFileName, downloadText } from "@/lib/downloads";
import { copyToClipboard } from "@/lib/clipboard";
import { errorMessage } from "@/lib/errors";
import queries, { fetchScriptById, fetchScriptTags, useScriptFavorites, useToggleFavorite } from "@/lib/queries/scripts";
import { ScriptSchema, type ScriptInput, type ScriptParameter } from "@/lib/schemas/scripts";
import { substituteParams } from "@/lib/template-params";
import { computeChangedFields, createVersion } from "@/lib/versioning";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { Extension } from "@codemirror/state";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_app/scripts")({
  head: () => ({
    meta: [
      { title: i18n.t("scripts:meta.title", "Script — PCReady") },
      {
        name: "description",
        content: i18n.t(
          "scripts:meta.description",
          "Libreria script riutilizzabili: PowerShell, Bash e altri.",
        ),
      },
    ],
  }),
  component: ScriptsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

type ScriptRow = Omit<Tables<"scripts">, "parameters" | "tags"> & {
  parameters: ScriptParameter[];
  tags: string[];
};

const LANGUAGES = ["powershell", "bash", "python", "cmd", "sql", "javascript"] as const;
const CATEGORIES = [
  "Generale",
  "Setup OS",
  "Software",
  "Sicurezza",
  "Rete",
  "Manutenzione",
  "Diagnostica",
];
const COLORS = [
  "#1B4FD8",
  "#7C3AED",
  "#16A34A",
  "#EF9827",
  "#DC2626",
  "#0891B2",
  "#DB2777",
  "#525252",
];
const ICONS: Record<string, LucideIcon> = {
  terminal: Terminal,
  shield: Shield,
  wrench: Wrench,
  network: Network,
  database: Database,
  cog: Cog,
  code: Code2,
  file: FileCode,
};
const ICON_KEYS = Object.keys(ICONS);

const LANG_EXT: Record<string, string> = {
  powershell: "ps1",
  bash: "sh",
  python: "py",
  cmd: "bat",
  sql: "sql",
  javascript: "js",
};

/** Returns the CodeMirror language extension for a given script language. */
function getLangExtension(language: string): Extension {
  switch (language) {
    case "powershell":
      return StreamLanguage.define(powerShell as any);
    case "bash":
      return StreamLanguage.define(shell as any);
    case "cmd":
      return StreamLanguage.define(shell as any);
    case "python":
      return python();
    case "sql":
      return sql();
    case "javascript":
      return javascript();
    default:
      return python();
  }
}

function ScriptsPage() {
  const { t } = useTranslation("scripts");
  const { canEdit, hasPermission, user } = useAuth();
  const [rows, setRows] = useState<ScriptRow[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tag, setTag] = useState("");
  const [viewer, setViewer] = useState<ScriptRow | null>(null);
  const [editor, setEditor] = useState<ScriptRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScriptRow | null>(null);
  const [shareDialogScript, setShareDialogScript] = useState<ScriptRow | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);

  const { useScriptsList, useDeleteScript } = queries;
  const listQuery = useScriptsList();
  const deleteMut = useDeleteScript();
  const favoritesQuery = useScriptFavorites(user?.id);
  const favorites = useMemo(() => new Set(favoritesQuery.data ?? []), [favoritesQuery.data]);
  const toggleFavorite = useToggleFavorite();

  const handleToggleFavorite = useCallback(
    (scriptId: string, favored: boolean) => {
      if (!user?.id) return;
      toggleFavorite.mutate({ userId: user.id, scriptId, favored }, {
        onError: () => {
          toast.error(t("favorites.toggleError", "Errore aggiornamento preferiti"));
        },
      });
    },
    [user?.id, toggleFavorite, t],
  );

  useEffect(() => {
    if (listQuery.data) setRows(listQuery.data as ScriptRow[]);
  }, [listQuery.data]);

  useEffect(() => {
    fetchScriptTags()
      .then(setAllTags)
      .catch(() => {});
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!cat || r.category === cat) &&
          (!tag || (r.tags ?? []).includes(tag)) &&
          (!q ||
            (r.name + (r.description || "") + r.category + (r.tags ?? []).join(" "))
              .toLowerCase()
              .includes(q.toLowerCase())),
      ),
    [rows, q, cat, tag],
  );

  const sorted = useMemo(() => {
    const fav = filtered.filter((r) => favorites.has(r.id));
    const rest = filtered.filter((r) => !favorites.has(r.id));
    return [...fav, ...rest];
  }, [filtered, favorites]);

  const grouped = useMemo(() => {
    const m: Record<string, ScriptRow[]> = {};
    sorted.forEach((r) => {
      (m[r.category] ||= []).push(r);
    });
    return m;
  }, [sorted]);

  const hasFavorites = sorted.some((r) => favorites.has(r.id));

  const cats = Array.from(new Set(rows.map((r) => r.category))).sort();

  async function remove(script: ScriptRow) {
    await deleteMut.mutateAsync(script.id);
    toast.success(t("success.deleted", "Script eliminato"));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* TOOLBAR */}
      <div className="flex flex-wrap gap-2 items-center">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] flex-1 min-w-[220px] max-w-[340px]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}
        >
          <Search className="size-3 text-text3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search.placeholder", "Cerca script...")}
            className="bg-transparent outline-none text-[13px] flex-1"
          />
        </div>
        <select
          className="pc-input max-w-[200px]"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label={t("filter.categoryLabel", "Filtra per categoria")}
        >
          <option value="">{t("allCategories", "Tutte le categorie")}</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            className="pc-input max-w-[180px]"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            aria-label={t("tags.filterLabel", "Filtra per tag")}
          >
            <option value="">{t("allCategories", "Tutti i tag")}</option>
            {allTags.map((tTag) => (
              <option key={tTag}>{tTag}</option>
            ))}
          </select>
        )}
        <span className="ml-auto self-center text-xs text-text3 font-mono">
          {t("scriptCount", "{{count}} script", { count: filtered.length })}
        </span>
        {canEdit && (
          <button onClick={() => setCreateOpen(true)} className="pc-btn pc-btn-primary pc-btn-sm">
            <Plus className="size-3" /> {t("newScript", "Nuovo script")}
          </button>
        )}
      </div>

      {/* EMPTY */}
      {!rows.length && (
        <div className="pc-card p-10 text-center">
          <Terminal className="size-10 mx-auto mb-3 text-text3" />
          <div className="text-[15px] font-bold mb-1 font-head">
            {t("emptyTitle", "Nessuno script ancora")}
          </div>
          <div className="text-[13px] text-text3 mb-4">
            {t(
              "emptyDescription",
              "Crea il tuo primo script riutilizzabile. Lo troverai sempre qui pronto da copiare.",
            )}
          </div>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="pc-btn pc-btn-primary pc-btn-sm mx-auto"
            >
              <Plus className="size-3" /> {t("newScript", "Nuovo script")}
            </button>
          )}
        </div>
      )}

      {/* FAVORITES SECTION */}
      {hasFavorites && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2
              className="text-[12px] font-bold tracking-[1.5px] uppercase text-amber-600 font-mono"
            >
              ★ {t("favorites.section", "Preferiti")}
            </h2>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted
              .filter((s) => favorites.has(s.id))
              .map((s) => (
                <ScriptCard
                  key={s.id}
                  s={s}
                  favored={true}
                  onToggleFavorite={handleToggleFavorite}
                  onOpen={() => {
                    setViewer(s);
                    setSelectedScriptId(s.id);
                  }}
                  onEdit={
                    canEdit
                      ? () => {
                          setEditor(s);
                          setSelectedScriptId(s.id);
                        }
                      : undefined
                  }
                  onDelete={hasPermission("can_manage_automations") ? () => setDeleteTarget(s) : undefined}
                />
              ))}
          </div>
        </section>
      )}

      {/* GRUPPI PER CATEGORIA */}
      {Object.entries(grouped).map(([category, items]) => {
        const nonFavItems = items.filter((s) => !favorites.has(s.id));
        if (nonFavItems.length === 0) return null;
        return (
        <section key={category} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2
              className="text-[12px] font-bold tracking-[1.5px] uppercase text-text3 font-mono"
            >
              {category}
            </h2>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[10.5px] text-text3 font-mono">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {nonFavItems.map((s) => (
              <ScriptCard
                key={s.id}
                s={s}
                favored={favorites.has(s.id)}
                onToggleFavorite={handleToggleFavorite}
                onOpen={() => {
                  setViewer(s);
                  setSelectedScriptId(s.id);
                }}
                onEdit={
                  canEdit
                    ? () => {
                        setEditor(s);
                        setSelectedScriptId(s.id);
                      }
                    : undefined
                }
                onDelete={hasPermission("can_manage_automations") ? () => setDeleteTarget(s) : undefined}
              />
            ))}
          </div>
        </section>
        );
      })}

      {/* MODALI */}
      {viewer && (
        <ScriptViewer
          script={viewer}
          onClose={() => setViewer(null)}
          onOpenVersions={() => {
            setViewer(null);
            setVersionHistoryOpen(true);
          }}
          onSaved={() => {
            void listQuery.refetch();
          }}
          onShare={() => setShareDialogScript(viewer)}
        />
      )}
      {(editor || createOpen) && (
        <ScriptEditor
          initial={editor}
          allTags={allTags}
          onClose={() => {
            setEditor(null);
            setCreateOpen(false);
          }}
          onSaved={() => {
            setEditor(null);
            setCreateOpen(false);
            void listQuery.refetch();
          }}
        />
      )}

      <VersionHistoryDrawer
        entityType="scripts"
        entityId={selectedScriptId || ""}
        open={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        onRestored={() => void listQuery.refetch()}
      />
      {shareDialogScript && (
        <ScriptShareDialog
          scriptId={shareDialogScript.id}
          open={!!shareDialogScript}
          onClose={() => setShareDialogScript(null)}
        />
      )}
      <DestructiveConfirmDialog
        open={!!deleteTarget}
        title={t("delete.title", "Eliminare questo script?")}
        description={
          deleteTarget
            ? t(
                "delete.description",
                'Lo script "{{name}}" verrà rimosso dalla libreria. L\'azione non può essere annullata.',
                { name: deleteTarget.name },
              )
            : t(
                "delete.descriptionGeneric",
                "Lo script verrà rimosso dalla libreria. L'azione non può essere annullata.",
              )
        }
        confirmLabel={t("delete.confirm", "Elimina script")}
        loadingLabel={t("delete.loading", "Eliminazione...")}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await remove(deleteTarget);
        }}
      />
    </div>
  );
}

// ------------------------- CARD -------------------------
function ScriptCard({
  s,
  onOpen,
  onEdit,
  onDelete,
  favored = false,
  onToggleFavorite,
}: {
  s: ScriptRow;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  favored?: boolean;
  onToggleFavorite?: (scriptId: string, favored: boolean) => void;
}) {
  const { t } = useTranslation("scripts");
  const Icon = ICONS[s.icon || ""] || Terminal;
  const color = s.color || "#1B4FD8";
  const tags: string[] = s.tags ?? [];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pc-card group relative p-4 text-left transition-all hover:-translate-y-0.5 border-0"
      style={{ boxShadow: "var(--shadow-sm)", cursor: "pointer" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="size-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: color + "1A", color }}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="text-[13.5px] font-bold leading-tight truncate font-head"
            >
              {s.name}
            </div>
            <VersionBadge entityType="scripts" entityId={s.id} />
            <div className="ml-auto flex items-center" onClick={(e) => e.stopPropagation()}>
              <ScriptFavoriteButton scriptId={s.id} favored={favored} onToggle={onToggleFavorite || (() => {})} size="sm" />
            </div>
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-text3 mt-0.5 font-mono">
            {s.language}
          </div>
        </div>
      </div>
      {s.description && (
        <p className="text-[12px] text-text2 mt-3 line-clamp-2 leading-snug">{s.description}</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.slice(0, 3).map((tagName) => (
            <span
              key={tagName}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
              style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text3)" }}
            >
              {tagName}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] text-text3 font-bold">
              {t("card.moreTags", "+{{count}}", { count: tags.length - 3 })}
            </span>
          )}
        </div>
      )}
      <div
        className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-[10.5px] text-text3 font-mono">{t("card.open", "Apri →")}</span>
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button
              onClick={onEdit}
              className="pc-btn-icon touch-target"
              title={t("card.edit", "Modifica")}
            >
              <Pencil className="size-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="pc-btn-icon touch-target"
              title={t("card.delete", "Elimina")}
              style={{ color: "var(--danger, #DC2626)" }}
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ------------------------- VIEWER -------------------------
function ScriptViewer({
  script,
  onClose,
  onOpenVersions,
  onSaved,
  onShare,
}: {
  script: ScriptRow;
  onClose: () => void;
  onOpenVersions: () => void;
  onSaved: () => void;
  onShare?: () => void;
}) {
  const { t } = useTranslation("scripts");
  const { canEdit } = useAuth();
  const { isDark } = useTheme();
  const langExtension = useMemo(() => getLangExtension(script.language), [script.language]);
  const Icon = ICONS[script.icon || ""] || Terminal;
  const color = script.color || "#1B4FD8";
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(script.name);
  const [editDescription, setEditDescription] = useState(script.description || "");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirtyConfirm, setDirtyConfirm] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [appliedParamValues, setAppliedParamValues] = useState<Record<string, string> | null>(null);
  const params: ScriptParameter[] = script.parameters ?? [];

  const fetchContent = useCallback(async () => {
    setLoadingContent(true);
    setLoadError(false);
    try {
      const full = await fetchScriptById(script.id);
      const raw = full?.content ?? null;
      setContent(raw);
      setEditContent(raw || "");
    } catch {
      setLoadError(true);
    } finally {
      setLoadingContent(false);
    }
  }, [script.id]);

  useEffect(() => {
    void fetchContent();
  }, [fetchContent]);

  const hasContent = content && content.trim().length > 0;
  const dirty =
    editName !== script.name ||
    editDescription !== (script.description || "") ||
    editContent !== (content ?? "");

  function enterEdit() {
    setEditName(script.name);
    setEditDescription(script.description || "");
    setEditContent(content ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    if (dirty) {
      setDirtyConfirm(true);
      return;
    }
    setEditing(false);
  }

  function forceCancelEdit() {
    setDirtyConfirm(false);
    setEditing(false);
  }

  async function copy() {
    const finalContent = appliedParamValues
      ? substituteParams(content ?? "", appliedParamValues)
      : (content ?? "");
    const ok = await copyToClipboard(finalContent);
    if (ok) {
      toast.success(t("viewer.copied", "Script copiato negli appunti"));
    } else {
      toast.error(t("viewer.copyError", "Seleziona e copia il contenuto manualmente"));
    }
  }

  function download() {
    const ext = LANG_EXT[script.language] || "txt";
    const finalContent = appliedParamValues
      ? substituteParams(content ?? "", appliedParamValues)
      : (content ?? "");
    downloadText(finalContent, buildDownloadFileName(script.name, ext));
  }

  async function save() {
    if (!editName.trim()) return toast.error(t("editor.errors.nameRequired", "Inserisci un nome"));
    if (!editContent.trim())
      return toast.error(t("editor.errors.contentRequired", "Lo script è vuoto"));
    setSaving(true);
    try {
      const newData: Record<string, unknown> = {
        name: editName,
        description: editDescription || null,
        content: editContent,
      };

      // Fetch current data for diff
      const { data: oldData } = await supabase
        .from("scripts")
        .select(
          "id, name, category, description, language, content, icon, color, created_by, created_at, updated_at",
        )
        .eq("id", script.id)
        .single();

      const { error } = await supabase.from("scripts").update(newData as any).eq("id", script.id);
      if (error) throw error;

      // Versioning
      const rawChanged = computeChangedFields(
        (oldData as Record<string, unknown>) ?? {},
        newData,
      );
      const changedFields = Object.keys(rawChanged).length > 0 ? rawChanged : undefined;

      await createVersion(
        "scripts",
        script.id,
        newData,
        changedFields,
        t("viewer.changeNote", "Modificato dal visualizzatore"),
        "update",
      );

      // Update local state (onSaved refetch will sync the list)
      setContent(editContent);

      toast.success(t("success.updated", "Script aggiornato"));
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      toast.error(errorMessage(e, t("editor.errors.saveFailed", "Errore salvataggio")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={editing && dirty ? cancelEdit : onClose}
        size="lg"
        title=""
        footer={
          <>
            {editing ? (
              <>
                <button className="pc-btn pc-btn-ghost" onClick={cancelEdit} disabled={saving}>
                  <X className="size-3" /> {t("viewer.cancel", "Annulla")}
                </button>
                <button
                  className="pc-btn pc-btn-primary"
                  onClick={save}
                  disabled={saving || !dirty}
                >
                  {saving ? (
                    t("editor.saving", "Salvataggio…")
                  ) : (
                    <>
                      <Check className="size-3" /> {t("viewer.save", "Salva")}
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button className="pc-btn pc-btn-ghost" onClick={onClose}>
                  {t("viewer.close", "Chiudi")}
                </button>
                <button className="pc-btn pc-btn-ghost" onClick={onOpenVersions}>
                  <History className="size-3" /> {t("viewer.versions", "Versioni")}
                </button>
                {canEdit && onShare && (
                  <button className="pc-btn pc-btn-ghost" onClick={onShare}>
                    <Link2 className="size-3" /> {t("viewer.share", "Condividi")}
                  </button>
                )}
                {canEdit && (
                  <button
                    className="pc-btn pc-btn-ghost"
                    onClick={enterEdit}
                    disabled={loadingContent}
                  >
                    <Pencil className="size-3" /> {t("viewer.edit", "Modifica")}
                  </button>
                )}
                {params.length > 0 && !showParams && (
                  <button className="pc-btn pc-btn-ghost" onClick={() => setShowParams(true)}>
                    <Play className="size-3" /> {t("viewer.runWithParams", "Esegui con parametri")}
                  </button>
                )}
                <button className="pc-btn pc-btn-ghost" onClick={download} disabled={!hasContent}>
                  <Download className="size-3" /> {t("viewer.download", "Scarica")}
                </button>
                <button className="pc-btn pc-btn-primary" onClick={copy} disabled={!hasContent}>
                  <Copy className="size-3" /> {t("viewer.copy", "Copia")}
                </button>
              </>
            )}
          </>
        }
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
            style={{ background: color + "1A", color }}
          >
            <Icon className="size-6" />
          </div>
          <div className="flex-1">
            {editing ? (
              <input
                className="pc-input !text-[18px] !font-bold max-w-[420px] font-head"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("editor.namePlaceholder", "Nome script")}
                aria-label={t("editor.fieldName", "Nome")}
              />
            ) : (
              <h2
                className="text-[18px] font-bold leading-tight font-head"
              >
                {script.name}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1 text-[11px] text-text3 font-mono uppercase tracking-wider">
              <span>{script.category}</span>
              <span>·</span>
              <span>{script.language}</span>
            </div>
            {editing ? (
              <textarea
                className="pc-input min-h-[44px] mt-2 text-[13px]"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t("editor.descriptionPlaceholder", "Cosa fa questo script?")}
                aria-label={t("editor.fieldDescription", "Descrizione")}
              />
            ) : (
              script.description && (
                <p className="text-[13px] text-text2 mt-2 leading-snug">{script.description}</p>
              )
            )}
            {params.length > 0 && !editing && (
              <div className="mt-2 flex flex-wrap gap-1">
                {params.map((p) => (
                  <span
                    key={p.name}
                    className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono"
                    style={{ borderColor: "var(--border)", background: "var(--surface2)", color: "var(--text2)" }}
                  >
                    {`{{${p.name}}}`}{p.required ? " *" : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {showParams && params.length > 0 && !editing && (
          <ScriptParametersRunner
            parameters={params}
            onApply={(values) => {
              setAppliedParamValues(values);
              setShowParams(false);
            }}
            onCancel={() => setShowParams(false)}
          />
        )}
        {appliedParamValues && !editing && (
          <div
            className="rounded-md border px-3 py-2 text-xs mb-4"
            style={{ borderColor: "var(--accent)", background: "var(--surface2)" }}
          >
            <span className="font-bold text-accent">
              {t("runner.title", "Parametri applicati")}
            </span>
            {" — "}
            {Object.entries(appliedParamValues).map(([k, v]) => `${k}=${v}`).join(", ")}
          </div>
        )}
        {editing ? (
          <div className="flex flex-col gap-2">
            <label className="pc-label">{t("editor.fieldContent", "Contenuto script *")}</label>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius, 8px)",
                overflow: "hidden",
              }}
            >
              <CodeMirror
                value={editContent}
                onChange={(val) => setEditContent(val)}
                extensions={[langExtension]}
                theme={isDark ? "dark" : "light"}
                height="360px"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  autocompletion: false,
                  highlightActiveLine: true,
                }}
              />
            </div>
          </div>
        ) : (
          <pre
            className="text-[12px] font-mono p-4 rounded-[10px] overflow-x-auto whitespace-pre-wrap break-words leading-relaxed"
            style={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              maxHeight: "55vh",
            }}
          >
            {loadingContent ? (
              <span className="text-text3">{t("viewer.loading", "Caricamento...")}</span>
            ) : loadError ? (
              <span className="text-destructive">
                {t("viewer.loadError", "Errore nel caricamento del contenuto.")}
              </span>
            ) : hasContent ? (
              content
            ) : (
              <span className="text-text3 italic">
                {t(
                  "viewer.emptyHint",
                  "Nessun codice inserito. Clicca su Modifica per aggiungere il contenuto dello script.",
                )}
              </span>
            )}
          </pre>
        )}
      </Modal>
      <DestructiveConfirmDialog
        open={dirtyConfirm}
        title={t("viewer.discardTitle", "Modifiche non salvate")}
        description={t(
          "viewer.discardDescription",
          "Hai modifiche non salvate. Vuoi davvero annullare?",
        )}
        confirmLabel={t("viewer.discardConfirm", "Annulla modifiche")}
        loadingLabel={t("viewer.discarding", "Annullamento...")}
        onOpenChange={(open) => !open && setDirtyConfirm(false)}
        onConfirm={async () => forceCancelEdit()}
      />
    </>
  );
}

// ------------------------- EDITOR -------------------------
function ScriptEditor({
  initial,
  allTags,
  onClose,
  onSaved,
}: {
  initial: ScriptRow | null;
  allTags?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("scripts");
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const form = useForm<ScriptInput>({
    resolver: zodResolver(ScriptSchema as any),
    mode: "onChange",
    defaultValues: {
      name: initial?.name || "",
      category: initial?.category || CATEGORIES[0],
      description: initial?.description || null,
      language: initial?.language || "powershell",
      content: initial?.content || "",
      icon: initial?.icon || "terminal",
      color: initial?.color || COLORS[0],
      parameters: initial?.parameters ?? [],
      tags: initial?.tags ?? [],
      changeNote: null,
    },
  });
  const [editorParams, setEditorParams] = useState<ScriptParameter[]>(initial?.parameters ?? []);
  const [editorTags, setEditorTags] = useState<string[]>(initial?.tags ?? []);

  const save = form.handleSubmit(async (values) => {
    if (!values.name.trim())
      return toast.error(t("editor.errors.nameRequired", "Inserisci un nome"));
    if (!values.content.trim())
      return toast.error(t("editor.errors.contentRequired", "Lo script è vuoto"));
    setBusy(true);
    try {
      const newData: Record<string, unknown> = {
        name: values.name,
        category: values.category,
        description: values.description || null,
        language: values.language,
        content: values.content,
        icon: values.icon,
        color: values.color,
        parameters: editorParams as unknown as Json,
        tags: editorTags,
      };

      let oldData: Record<string, unknown> | null = null;
      if (initial) {
        // Fetch current data for diff
        const { data } = await supabase
          .from("scripts")
          .select(
            "id, name, category, description, language, content, icon, color, created_by, created_at, updated_at",
          )
          .eq("id", initial.id)
          .single();
        oldData = (data as Record<string, unknown>) ?? null;
      }

      if (initial) {
        const { error } = await supabase.from("scripts").update(newData as any).eq("id", initial.id);
        if (error) throw error;
        toast.success(t("success.updated", "Script aggiornato"));
      } else {
        const { data: inserted, error } = await supabase
          .from("scripts")
          .insert({ ...newData, created_by: user!.id } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (inserted) newData.id = (inserted as Record<string, unknown>).id; // For versioning
        toast.success(t("success.created", "Script creato"));
      }

      // Create version
      const rawChanged = oldData ? computeChangedFields(oldData, newData) : null;
      const changedFields = rawChanged && Object.keys(rawChanged).length > 0 ? rawChanged : undefined;

      await createVersion(
        "scripts",
        initial?.id || (newData as any).id,
        newData,
        changedFields,
        values.changeNote || undefined,
        initial ? "update" : "create",
      );

      onSaved();
    } catch (e: unknown) {
      toast.error(errorMessage(e, t("editor.errors.saveFailed", "Errore salvataggio")));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        initial ? t("editor.editTitle", "Modifica script") : t("editor.newTitle", "Nuovo script")
      }
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose}>
            {t("editor.cancel", "Annulla")}
          </button>
          <button
            className="pc-btn pc-btn-primary"
            disabled={busy || !form.formState.isValid}
            onClick={save}
          >
            {busy
              ? t("editor.saving", "Salvataggio…")
              : initial
                ? t("editor.saveChanges", "Salva modifiche")
                : t("editor.createScript", "Crea script")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("editor.fieldName", "Nome *")}>
            <input
              className="pc-input"
              {...form.register("name")}
              placeholder={t("editor.namePlaceholder", "Reset Windows Update")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </Field>
          <Field label={t("editor.fieldCategory", "Categoria")}>
            <input className="pc-input" list="cat-list" {...form.register("category")} />
            <datalist id="cat-list">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label={t("editor.fieldLanguage", "Linguaggio")}>
            <select
              className="pc-input"
              {...form.register("language")}
              aria-label={t("editor.fieldLanguage", "Linguaggio")}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {form.formState.errors.language && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.language.message}
              </p>
            )}
          </Field>
          <Field label={t("editor.fieldIcon", "Icona")}>
            <div className="flex flex-wrap gap-1.5">
              {ICON_KEYS.map((k) => {
                const I = ICONS[k];
                const active = form.getValues().icon === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => form.setValue("icon", k)}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-all"
                    style={{
                      background: active
                        ? (form.getValues().color || COLORS[0]) + "22"
                        : "var(--surface2)",
                      border: `1px solid ${active ? form.getValues().color || COLORS[0] : "var(--border2)"}`,
                      color: active ? form.getValues().color || COLORS[0] : "var(--text2)",
                    }}
                  >
                    <I className="size-4" />
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <Field label={t("editor.fieldColor", "Colore")}>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => form.setValue("color", c)}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  background: c,
                  border:
                    (form.getValues().color || COLORS[0]) === c
                      ? "2px solid var(--text)"
                      : "2px solid transparent",
                  transform: (form.getValues().color || COLORS[0]) === c ? "scale(1.1)" : "none",
                }}
              />
            ))}
          </div>
        </Field>
        <Field label={t("editor.fieldDescription", "Descrizione")}>
          <textarea
            className="pc-input min-h-[60px]"
            {...form.register("description")}
            placeholder={t("editor.descriptionPlaceholder", "Cosa fa questo script?")}
          />
        </Field>
        <Field label={t("editor.fieldTags", "Tag")}>
          <ScriptTagInput
            value={editorTags}
            onChange={setEditorTags}
            suggestions={allTags}
            disabled={busy}
          />
        </Field>
        <ScriptParametersEditor
          value={editorParams}
          onChange={setEditorParams}
          disabled={busy}
        />
        <Field label={t("editor.fieldContent", "Contenuto script *")}>
          <textarea
            className="pc-input font-mono text-[12px] min-h-[260px]"
            {...form.register("content")}
            placeholder={t("editor.contentPlaceholder", "# Il tuo codice qui...")}
            spellCheck={false}
          />
          {form.formState.errors.content && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.content.message}</p>
          )}
        </Field>
        <Field label={t("editor.fieldChangeNote", "Nota modifica (opzionale)")}>
          <textarea
            className="pc-input min-h-[60px]"
            {...form.register("changeNote")}
            placeholder={t("editor.changeNotePlaceholder", "Descrivi le modifiche apportate...")}
          />
        </Field>
      </div>
    </Modal>
  );
}
