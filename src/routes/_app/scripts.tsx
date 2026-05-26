import { createFileRoute } from "@tanstack/react-router";
import i18n from "@/i18n";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScriptSchema, type ScriptInput } from "@/lib/schemas/scripts";
import { supabase } from "@/integrations/supabase/client";
import queries from "@/lib/queries/scripts";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/pcready/Modal";
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { buildDownloadFileName, downloadText } from "@/lib/downloads";
import { createVersion } from "@/lib/versioning";
import { VersionHistoryDrawer } from "@/components/pcready/VersionHistoryDrawer";
import { VersionBadge } from "@/components/pcready/VersionBadge";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/_app/scripts")({
  head: () => ({
    meta: [
      { title: i18n.t("scripts:meta.title", "Script — PCReady") },
      { name: "description", content: i18n.t("scripts:meta.description", "Libreria script riutilizzabili: PowerShell, Bash e altri.") },
    ],
  }),
  component: ScriptsPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

interface ScriptRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  language: string;
  content: string;
  icon: string | null;
  color: string | null;
  updated_at: string;
}

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


function computeChangedFields(oldData: any, newData: any) {
  const changed: Record<string, { old: any; new: any }> = {};
  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changed[key] = { old: oldData[key], new: newData[key] };
    }
  }
  return Object.keys(changed).length ? changed : null;
}

function ScriptsPage() {
  const { t } = useTranslation("scripts");
  const { canEdit, isAdmin } = useAuth();
  const [rows, setRows] = useState<ScriptRow[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [viewer, setViewer] = useState<ScriptRow | null>(null);
  const [editor, setEditor] = useState<ScriptRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScriptRow | null>(null);

  const { useScriptsList, useDeleteScript } = queries as any;
  const listQuery = useScriptsList();
  const deleteMut = useDeleteScript();

  useEffect(() => {
    if (listQuery.data) setRows(listQuery.data as ScriptRow[]);
  }, [listQuery.data]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!cat || r.category === cat) &&
          (!q ||
            (r.name + (r.description || "") + r.category).toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, q, cat],
  );

  const grouped = useMemo(() => {
    const m: Record<string, ScriptRow[]> = {};
    filtered.forEach((r) => {
      (m[r.category] ||= []).push(r);
    });
    return m;
  }, [filtered]);

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
          <Search className="w-3 h-3 text-text3" />
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
        >
          <option value="">{t("allCategories", "Tutte le categorie")}</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span className="ml-auto self-center text-xs text-text3 font-mono">
          {t("scriptCount", "{{count}} script", { count: filtered.length })}
        </span>
        {canEdit && (
          <button onClick={() => setCreateOpen(true)} className="pc-btn pc-btn-primary pc-btn-sm">
            <Plus className="w-3 h-3" /> {t("newScript", "Nuovo script")}
          </button>
        )}
      </div>

      {/* EMPTY */}
      {!rows.length && (
        <div className="pc-card p-10 text-center">
          <Terminal className="w-10 h-10 mx-auto mb-3 text-text3" />
          <div className="text-[15px] font-bold mb-1" style={{ fontFamily: "var(--font-head)" }}>
            {t("emptyTitle", "Nessuno script ancora")}
          </div>
          <div className="text-[13px] text-text3 mb-4">
            {t("emptyDescription", "Crea il tuo primo script riutilizzabile. Lo troverai sempre qui pronto da copiare.")}
          </div>
          {canEdit && (
            <button
              onClick={() => setCreateOpen(true)}
              className="pc-btn pc-btn-primary pc-btn-sm mx-auto"
            >
              <Plus className="w-3 h-3" /> {t("newScript", "Nuovo script")}
            </button>
          )}
        </div>
      )}

      {/* GRUPPI PER CATEGORIA */}
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2
              className="text-[12px] font-bold tracking-[1.5px] uppercase text-text3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {category}
            </h2>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[10.5px] text-text3 font-mono">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((s) => (
              <ScriptCard
                key={s.id}
                s={s}
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
                onDelete={isAdmin ? () => setDeleteTarget(s) : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {/* MODALI */}
      {viewer && (
        <ScriptViewer
          script={viewer}
          onClose={() => setViewer(null)}
          onOpenVersions={() => {
            setViewer(null);
            setVersionHistoryOpen(true);
          }}
        />
      )}
      {(editor || createOpen) && (
        <ScriptEditor
          initial={editor}
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
      <DestructiveConfirmDialog
        open={!!deleteTarget}
        title={t("delete.title", "Eliminare questo script?")}
        description={
          deleteTarget
            ? t("delete.description", 'Lo script "{{name}}" verrà rimosso dalla libreria. L\'azione non può essere annullata.', { name: deleteTarget.name })
            : t("delete.descriptionGeneric", "Lo script verrà rimosso dalla libreria. L'azione non può essere annullata.")
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
}: {
  s: ScriptRow;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation("scripts");
  const Icon = ICONS[s.icon || ""] || Terminal;
  const color = s.color || "#1B4FD8";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="pc-card group relative p-4 text-left transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-sm)", cursor: "pointer" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: color + "1A", color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div
              className="text-[13.5px] font-bold leading-tight truncate"
              style={{ fontFamily: "var(--font-head)" }}
            >
              {s.name}
            </div>
            <VersionBadge entityType="scripts" entityId={s.id} />
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-text3 mt-0.5 font-mono">
            {s.language}
          </div>
        </div>
      </div>
      {s.description && (
        <p className="text-[12px] text-text2 mt-3 line-clamp-2 leading-snug">{s.description}</p>
      )}
      <div
        className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-[10.5px] text-text3 font-mono">{t("card.open", "Apri →")}</span>
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button onClick={onEdit} className="pc-btn-icon touch-target" title={t("card.edit", "Modifica")}>
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="pc-btn-icon touch-target"
              title={t("card.delete", "Elimina")}
              style={{ color: "var(--danger, #DC2626)" }}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------- VIEWER -------------------------
function ScriptViewer({
  script,
  onClose,
  onOpenVersions,
}: {
  script: ScriptRow;
  onClose: () => void;
  onOpenVersions: () => void;
}) {
  const { t } = useTranslation("scripts");
  const Icon = ICONS[script.icon || ""] || Terminal;
  const color = script.color || "#1B4FD8";

  function copy() {
    navigator.clipboard.writeText(script.content);
    toast.success(t("viewer.copied", "Script copiato negli appunti"));
  }

  function download() {
    const ext = LANG_EXT[script.language] || "txt";
    downloadText(script.content, buildDownloadFileName(script.name, ext));
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title=""
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose}>
            {t("viewer.close", "Chiudi")}
          </button>
          <button className="pc-btn pc-btn-ghost" onClick={onOpenVersions}>
            <History className="w-3 h-3" /> {t("viewer.versions", "Versioni")}
          </button>
          <button className="pc-btn pc-btn-ghost" onClick={download}>
            <Download className="w-3 h-3" /> {t("viewer.download", "Scarica")}
          </button>
          <button className="pc-btn pc-btn-primary" onClick={copy}>
            <Copy className="w-3 h-3" /> {t("viewer.copy", "Copia")}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
          style={{ background: color + "1A", color }}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2
            className="text-[18px] font-bold leading-tight"
            style={{ fontFamily: "var(--font-head)" }}
          >
            {script.name}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-text3 font-mono uppercase tracking-wider">
            <span>{script.category}</span>
            <span>·</span>
            <span>{script.language}</span>
          </div>
          {script.description && (
            <p className="text-[13px] text-text2 mt-2 leading-snug">{script.description}</p>
          )}
        </div>
      </div>
      <pre
        className="text-[12px] font-mono p-4 rounded-[10px] overflow-x-auto whitespace-pre-wrap break-words leading-relaxed"
        style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          color: "var(--text)",
          maxHeight: "55vh",
        }}
      >
        {script.content || t("viewer.emptyScript", "// Script vuoto")}
      </pre>
    </Modal>
  );
}

// ------------------------- EDITOR -------------------------
function ScriptEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: ScriptRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("scripts");
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const form = useForm<ScriptInput>({
    resolver: zodResolver(ScriptSchema),
    mode: "onChange",
    defaultValues: {
      name: initial?.name || "",
      category: initial?.category || CATEGORIES[0],
      description: initial?.description || null,
      language: initial?.language || "powershell",
      content: initial?.content || "",
      icon: initial?.icon || "terminal",
      color: initial?.color || COLORS[0],
      changeNote: null,
    },
  });

  const save = form.handleSubmit(async (values) => {
    if (!values.name.trim()) return toast.error(t("editor.errors.nameRequired", "Inserisci un nome"));
    if (!values.content.trim()) return toast.error(t("editor.errors.contentRequired", "Lo script è vuoto"));
    setBusy(true);
    try {
      const newData: any = {
        name: values.name,
        category: values.category,
        description: values.description || null,
        language: values.language,
        content: values.content,
        icon: values.icon,
        color: values.color,
      };

      let oldData: any = null;
      if (initial) {
        // Fetch current data for diff
        const { data } = await supabase
          .from("scripts")
          .select("id, name, category, description, language, content, icon, color, created_by, created_at, updated_at")
          .eq("id", initial.id)
          .single();
        oldData = data as any;
      }

      if (initial) {
        const { error } = await supabase.from("scripts").update(newData).eq("id", initial.id);
        if (error) throw error;
        toast.success(t("success.updated", "Script aggiornato"));
      } else {
        const { data: inserted, error } = await supabase
          .from("scripts")
          .insert({ ...newData, created_by: user!.id })
          .select("id")
          .single();
        if (error) throw error;
        newData.id = (inserted as any).id; // For versioning
        toast.success(t("success.created", "Script creato"));
      }

      // Create version
      const rawChanged = oldData ? computeChangedFields(oldData, newData) : null;
      const changedFields = rawChanged
        ? (Object.fromEntries(
            Object.entries(rawChanged).map(([k, v]) => [
              k,
              { from: (v as any).old, to: (v as any).new },
            ]),
          ) as Record<string, { from: unknown; to: unknown }>)
        : undefined;

      await createVersion(
        "scripts",
        initial?.id || newData.id,
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
      title={initial ? t("editor.editTitle", "Modifica script") : t("editor.newTitle", "Nuovo script")}
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
            {busy ? t("editor.saving", "Salvataggio…") : initial ? t("editor.saveChanges", "Salva modifiche") : t("editor.createScript", "Crea script")}
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
            <select className="pc-input" {...form.register("language")}>
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
                    <I className="w-4 h-4" />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="pc-label">{label}</label>
      {children}
    </div>
  );
}
