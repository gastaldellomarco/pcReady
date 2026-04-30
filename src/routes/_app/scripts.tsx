import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Modal } from "@/components/pcready/Modal";
import { Plus, Search, Copy, Download, Pencil, Trash2, Terminal, Shield, Wrench, Network, Database, Cog, Code2, FileCode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/scripts")({
  head: () => ({ meta: [
    { title: "Script — PCReady" },
    { name: "description", content: "Libreria script riutilizzabili: PowerShell, Bash e altri." },
  ] }),
  component: ScriptsPage,
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
const CATEGORIES = ["Generale", "Setup OS", "Software", "Sicurezza", "Rete", "Manutenzione", "Diagnostica"];
const COLORS = ["#1B4FD8", "#7C3AED", "#16A34A", "#EF9827", "#DC2626", "#0891B2", "#DB2777", "#525252"];
const ICONS: Record<string, any> = {
  terminal: Terminal, shield: Shield, wrench: Wrench, network: Network,
  database: Database, cog: Cog, code: Code2, file: FileCode,
};
const ICON_KEYS = Object.keys(ICONS);

const LANG_EXT: Record<string, string> = {
  powershell: "ps1", bash: "sh", python: "py", cmd: "bat", sql: "sql", javascript: "js",
};

function ScriptsPage() {
  const { canEdit, isAdmin } = useAuth();
  const [rows, setRows] = useState<ScriptRow[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [viewer, setViewer] = useState<ScriptRow | null>(null);
  const [editor, setEditor] = useState<ScriptRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    supabase.from("scripts").select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data }) => setRows((data ?? []) as ScriptRow[]));
  }, [refresh]);

  const filtered = useMemo(() => rows.filter(r =>
    (!cat || r.category === cat) &&
    (!q || (r.name + (r.description || "") + r.category).toLowerCase().includes(q.toLowerCase()))
  ), [rows, q, cat]);

  const grouped = useMemo(() => {
    const m: Record<string, ScriptRow[]> = {};
    filtered.forEach(r => { (m[r.category] ||= []).push(r); });
    return m;
  }, [filtered]);

  const cats = Array.from(new Set(rows.map(r => r.category))).sort();

  async function remove(id: string) {
    if (!confirm("Eliminare questo script?")) return;
    const { error } = await supabase.from("scripts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Script eliminato");
    setRefresh(x => x + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* TOOLBAR */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] flex-1 min-w-[220px] max-w-[340px]"
          style={{ background: "var(--surface2)", border: "1px solid var(--border2)" }}>
          <Search className="w-3 h-3 text-text3" />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cerca script..."
            className="bg-transparent outline-none text-[13px] flex-1" />
        </div>
        <select className="pc-input max-w-[200px]" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Tutte le categorie</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-text3 font-mono">{filtered.length} script</span>
        {canEdit && (
          <button onClick={() => setCreateOpen(true)} className="pc-btn pc-btn-primary pc-btn-sm">
            <Plus className="w-3 h-3" /> Nuovo script
          </button>
        )}
      </div>

      {/* EMPTY */}
      {!rows.length && (
        <div className="pc-card p-10 text-center">
          <Terminal className="w-10 h-10 mx-auto mb-3 text-text3" />
          <div className="text-[15px] font-bold mb-1" style={{ fontFamily: "var(--font-head)" }}>
            Nessuno script ancora
          </div>
          <div className="text-[13px] text-text3 mb-4">
            Crea il tuo primo script riutilizzabile. Lo troverai sempre qui pronto da copiare.
          </div>
          {canEdit && (
            <button onClick={() => setCreateOpen(true)} className="pc-btn pc-btn-primary pc-btn-sm mx-auto">
              <Plus className="w-3 h-3" /> Nuovo script
            </button>
          )}
        </div>
      )}

      {/* GRUPPI PER CATEGORIA */}
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[12px] font-bold tracking-[1.5px] uppercase text-text3"
              style={{ fontFamily: "var(--font-mono)" }}>{category}</h2>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[10.5px] text-text3 font-mono">{items.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map(s => (
              <ScriptCard key={s.id} s={s}
                onOpen={() => setViewer(s)}
                onEdit={canEdit ? () => setEditor(s) : undefined}
                onDelete={isAdmin ? () => remove(s.id) : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {/* MODALI */}
      {viewer && <ScriptViewer script={viewer} onClose={() => setViewer(null)} />}
      {(editor || createOpen) && (
        <ScriptEditor
          initial={editor}
          onClose={() => { setEditor(null); setCreateOpen(false); }}
          onSaved={() => { setEditor(null); setCreateOpen(false); setRefresh(x => x + 1); }}
        />
      )}
    </div>
  );
}

// ------------------------- CARD -------------------------
function ScriptCard({ s, onOpen, onEdit, onDelete }:
  { s: ScriptRow; onOpen: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const Icon = ICONS[s.icon || ""] || Terminal;
  const color = s.color || "#1B4FD8";
  return (
    <button
      onClick={onOpen}
      className="pc-card group relative p-4 text-left transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-sm)" }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: color + "1A", color }}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold leading-tight truncate"
            style={{ fontFamily: "var(--font-head)" }}>{s.name}</div>
          <div className="text-[10.5px] uppercase tracking-wider text-text3 mt-0.5 font-mono">
            {s.language}
          </div>
        </div>
      </div>
      {s.description && (
        <p className="text-[12px] text-text2 mt-3 line-clamp-2 leading-snug">{s.description}</p>
      )}
      <div className="flex items-center gap-1 mt-3 pt-3 border-t opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ borderColor: "var(--border)" }}>
        <span className="text-[10.5px] text-text3 font-mono">Apri →</span>
        <div className="ml-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {onEdit && (
            <button onClick={onEdit} className="pc-btn-icon" title="Modifica">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="pc-btn-icon" title="Elimina"
              style={{ color: "var(--danger, #DC2626)" }}>
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </button>
  );
}

// ------------------------- VIEWER -------------------------
function ScriptViewer({ script, onClose }: { script: ScriptRow; onClose: () => void }) {
  const Icon = ICONS[script.icon || ""] || Terminal;
  const color = script.color || "#1B4FD8";

  function copy() {
    navigator.clipboard.writeText(script.content);
    toast.success("Script copiato negli appunti");
  }

  function download() {
    const ext = LANG_EXT[script.language] || "txt";
    const blob = new Blob([script.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.name.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title=""
      footer={<>
        <button className="pc-btn pc-btn-ghost" onClick={onClose}>Chiudi</button>
        <button className="pc-btn pc-btn-ghost" onClick={download}>
          <Download className="w-3 h-3" /> Scarica
        </button>
        <button className="pc-btn pc-btn-primary" onClick={copy}>
          <Copy className="w-3 h-3" /> Copia
        </button>
      </>}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
          style={{ background: color + "1A", color }}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h2 className="text-[18px] font-bold leading-tight" style={{ fontFamily: "var(--font-head)" }}>
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
      <pre className="text-[12px] font-mono p-4 rounded-[10px] overflow-x-auto whitespace-pre-wrap break-words leading-relaxed"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)", maxHeight: "55vh" }}>
        {script.content || "// Script vuoto"}
      </pre>
    </Modal>
  );
}

// ------------------------- EDITOR -------------------------
function ScriptEditor({ initial, onClose, onSaved }:
  { initial: ScriptRow | null; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: initial?.name || "",
    category: initial?.category || CATEGORIES[0],
    description: initial?.description || "",
    language: initial?.language || "powershell",
    content: initial?.content || "",
    icon: initial?.icon || "terminal",
    color: initial?.color || COLORS[0],
  });

  async function save() {
    if (!f.name.trim()) return toast.error("Inserisci un nome");
    if (!f.content.trim()) return toast.error("Lo script è vuoto");
    setBusy(true);
    try {
      if (initial) {
        const { error } = await supabase.from("scripts").update({
          name: f.name, category: f.category, description: f.description || null,
          language: f.language, content: f.content, icon: f.icon, color: f.color,
        }).eq("id", initial.id);
        if (error) throw error;
        toast.success("Script aggiornato");
      } else {
        const { error } = await supabase.from("scripts").insert({
          name: f.name, category: f.category, description: f.description || null,
          language: f.language, content: f.content, icon: f.icon, color: f.color,
          created_by: user!.id,
        });
        if (error) throw error;
        toast.success("Script creato");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Errore salvataggio");
    } finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} size="lg"
      title={initial ? "Modifica script" : "Nuovo script"}
      footer={<>
        <button className="pc-btn pc-btn-ghost" onClick={onClose}>Annulla</button>
        <button className="pc-btn pc-btn-primary" disabled={busy} onClick={save}>
          {busy ? "Salvataggio…" : initial ? "Salva modifiche" : "Crea script"}
        </button>
      </>}>
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Nome *">
            <input className="pc-input" value={f.name}
              onChange={e => setF({ ...f, name: e.target.value })}
              placeholder="Reset Windows Update" />
          </Field>
          <Field label="Categoria">
            <input className="pc-input" list="cat-list" value={f.category}
              onChange={e => setF({ ...f, category: e.target.value })} />
            <datalist id="cat-list">
              {CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          <Field label="Linguaggio">
            <select className="pc-input" value={f.language}
              onChange={e => setF({ ...f, language: e.target.value })}>
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Icona">
            <div className="flex flex-wrap gap-1.5">
              {ICON_KEYS.map(k => {
                const I = ICONS[k];
                const active = f.icon === k;
                return (
                  <button key={k} type="button" onClick={() => setF({ ...f, icon: k })}
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center transition-all"
                    style={{
                      background: active ? f.color + "22" : "var(--surface2)",
                      border: `1px solid ${active ? f.color : "var(--border2)"}`,
                      color: active ? f.color : "var(--text2)",
                    }}>
                    <I className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
        <Field label="Colore">
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setF({ ...f, color: c })}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  background: c,
                  border: f.color === c ? "2px solid var(--text)" : "2px solid transparent",
                  transform: f.color === c ? "scale(1.1)" : "none",
                }} />
            ))}
          </div>
        </Field>
        <Field label="Descrizione">
          <textarea className="pc-input min-h-[60px]" value={f.description}
            onChange={e => setF({ ...f, description: e.target.value })}
            placeholder="Cosa fa questo script?" />
        </Field>
        <Field label="Contenuto script *">
          <textarea className="pc-input font-mono text-[12px] min-h-[260px]"
            value={f.content}
            onChange={e => setF({ ...f, content: e.target.value })}
            placeholder="# Il tuo codice qui..." spellCheck={false} />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="pc-label">{label}</label>{children}</div>;
}
