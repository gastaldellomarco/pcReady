import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_STRUCTURE, type ChecklistStructure } from "@/lib/pcready";
import { Plus, Trash2, Star, StarOff, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/checklist")({
  head: () => ({ meta: [{ title: "Checklist — PCReady" }, { name: "description", content: "Crea e gestisci checklist personalizzate per la preparazione PC." }] }),
  component: ChecklistPage,
});

interface Template {
  id: string;
  name: string;
  description: string | null;
  structure: ChecklistStructure;
  is_default: boolean;
}

function ChecklistPage() {
  const { user, canEdit, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("checklist_templates")
      .select("id, name, description, structure, is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    const arr = (data ?? []) as unknown as Template[];
    setTemplates(arr);
    if (!active && arr.length) setActive(arr[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createNew() {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const { data, error } = await supabase.from("checklist_templates").insert({
      name: "Nuovo modello",
      description: "",
      structure: DEFAULT_STRUCTURE as unknown as Json,
      created_by: user!.id,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await load();
    setActive(data.id);
  }

  async function setDefault(id: string) {
    if (!isAdmin) return toast.error("Solo amministratori");
    await supabase.from("checklist_templates").update({ is_default: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("checklist_templates").update({ is_default: true }).eq("id", id);
    toast.success("Modello impostato come predefinito");
    load();
  }

  async function remove(id: string) {
    if (!isAdmin) return toast.error("Solo amministratori");
    if (!confirm("Eliminare questo modello?")) return;
    const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Modello eliminato");
    if (active === id) setActive(null);
    load();
  }

  async function update(t: Template, patch: Partial<Template>) {
    const dbPatch: TablesUpdate<"checklist_templates"> = {
      ...patch,
      structure: patch.structure as unknown as Json | undefined,
    };
    const { error } = await supabase.from("checklist_templates").update(dbPatch).eq("id", t.id);
    if (error) return toast.error(error.message);
    setTemplates(ts => ts.map(x => x.id === t.id ? { ...x, ...patch } as Template : x));
  }

  const current = templates.find(t => t.id === active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      <div className="pc-card">
        <div className="pc-card-hd">
          <span className="pc-card-title">Modelli</span>
          {canEdit && (
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={createNew}>
              <Plus className="w-3 h-3" /> Nuovo
            </button>
          )}
        </div>
        <div className="pc-card-body flex flex-col gap-1.5">
          {loading && <div className="text-text3 text-sm py-4 text-center">Caricamento…</div>}
          {!loading && !templates.length && (
            <div className="text-text3 text-[12.5px] py-6 px-2 text-center leading-relaxed">
              Nessun modello.<br/>Creane uno per iniziare.
            </div>
          )}
          {templates.map(t => {
            const on = t.id === active;
            return (
              <button key={t.id} onClick={() => setActive(t.id)}
                className="text-left p-2.5 rounded-[7px] transition-all"
                style={{
                  background: on ? "var(--accent2)" : "var(--surface2)",
                  border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
                }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold flex-1 truncate"
                    style={{ color: on ? "var(--accent)" : "var(--text)" }}>{t.name}</span>
                  {t.is_default && <Star className="w-3 h-3 fill-current" style={{ color: "var(--warn)" }}/>}
                </div>
                {t.description && <div className="text-[11px] text-text3 truncate mt-0.5">{t.description}</div>}
                <div className="text-[10px] text-text3 font-mono mt-1">
                  {Object.values(t.structure || {}).reduce((a, c) => a + (c.items?.length || 0), 0)} voci
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {current ? (
        <TemplateEditor key={current.id} template={current} canEdit={canEdit} isAdmin={isAdmin}
          onUpdate={p => update(current, p)} onDelete={() => remove(current.id)}
          onSetDefault={() => setDefault(current.id)} />
      ) : (
        <div className="pc-card flex items-center justify-center min-h-[400px]">
          <div className="text-text3 text-sm">Seleziona o crea un modello</div>
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template, canEdit, isAdmin, onUpdate, onDelete, onSetDefault }: {
  template: Template; canEdit: boolean; isAdmin: boolean;
  onUpdate: (p: Partial<Template>) => void;
  onDelete: () => void; onSetDefault: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [desc, setDesc] = useState(template.description || "");
  const [struct, setStruct] = useState<ChecklistStructure>(template.structure || {});
  const [activeTab, setActiveTab] = useState<string>(Object.keys(template.structure || {})[0] || "");
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [tabLabel, setTabLabel] = useState("");

  useEffect(() => {
    setName(template.name); setDesc(template.description || "");
    setStruct(template.structure || {});
    setActiveTab(Object.keys(template.structure || {})[0] || "");
  }, [template.id]);

  function persist(s: ChecklistStructure) { setStruct(s); onUpdate({ structure: s }); }

  function addTab() {
    const key = "sec_" + Math.random().toString(36).slice(2, 8);
    persist({ ...struct, [key]: { label: "Nuova sezione", items: [] } });
    setActiveTab(key);
  }
  function renameTab(key: string, label: string) {
    persist({ ...struct, [key]: { ...struct[key], label } });
  }
  function removeTab(key: string) {
    if (!confirm("Eliminare questa sezione e tutte le sue voci?")) return;
    const c = { ...struct }; delete c[key];
    persist(c);
    setActiveTab(Object.keys(c)[0] || "");
  }
  function addItem() {
    const id = "i_" + Math.random().toString(36).slice(2, 8);
    const items = [...(struct[activeTab]?.items || []), { id, text: "Nuova voce" }];
    persist({ ...struct, [activeTab]: { ...struct[activeTab], items } });
  }
  function updateItem(id: string, text: string) {
    const items = struct[activeTab].items.map(i => i.id === id ? { ...i, text } : i);
    persist({ ...struct, [activeTab]: { ...struct[activeTab], items } });
  }
  function removeItem(id: string) {
    const items = struct[activeTab].items.filter(i => i.id !== id);
    persist({ ...struct, [activeTab]: { ...struct[activeTab], items } });
  }

  return (
    <div className="pc-card">
      <div className="pc-card-hd flex-wrap gap-2">
        <input className="pc-input max-w-[280px] !text-[14px] !font-semibold"
          value={name} disabled={!canEdit}
          onChange={e => setName(e.target.value)}
          onBlur={() => name !== template.name && onUpdate({ name })} />
        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onSetDefault}
              title={template.is_default ? "Già predefinito" : "Imposta come predefinito"}>
              {template.is_default ? <><Star className="w-3 h-3 fill-current" style={{ color: "var(--warn)" }}/> Predefinito</>
                : <><StarOff className="w-3 h-3"/> Imposta predefinito</>}
            </button>
          )}
          {isAdmin && (
            <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={onDelete}>
              <Trash2 className="w-3 h-3"/> Elimina
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pt-4">
        <input className="pc-input" placeholder="Descrizione (opzionale)"
          value={desc} disabled={!canEdit}
          onChange={e => setDesc(e.target.value)}
          onBlur={() => desc !== (template.description || "") && onUpdate({ description: desc })} />
      </div>

      <div className="border-b mt-4 px-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1 overflow-x-auto">
          {Object.keys(struct).map(k => {
            const on = activeTab === k;
            const isEditing = editingTab === k;
            return (
              <div key={k} className="flex items-center -mb-px">
                {isEditing ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input autoFocus className="pc-input !py-1 !text-[12px] max-w-[140px]"
                      value={tabLabel} onChange={e => setTabLabel(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { renameTab(k, tabLabel); setEditingTab(null); }}}/>
                    <button className="pc-btn-icon" onClick={() => { renameTab(k, tabLabel); setEditingTab(null); }}>
                      <Check className="w-3 h-3"/>
                    </button>
                    <button className="pc-btn-icon" onClick={() => setEditingTab(null)}>
                      <X className="w-3 h-3"/>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setActiveTab(k)}
                    onDoubleClick={() => { if (canEdit) { setEditingTab(k); setTabLabel(struct[k].label); }}}
                    className="px-3 py-2 text-[12.5px] font-semibold border-b-2 transition-colors flex items-center gap-1.5"
                    style={{ color: on ? "var(--accent)" : "var(--text3)", borderColor: on ? "var(--accent)" : "transparent" }}>
                    {struct[k].label}
                    <span className="font-mono text-[10px] opacity-60">{struct[k].items.length}</span>
                  </button>
                )}
              </div>
            );
          })}
          {canEdit && (
            <button onClick={addTab} className="px-2.5 py-2 text-text3 hover:text-accent" title="Aggiungi sezione">
              <Plus className="w-3.5 h-3.5"/>
            </button>
          )}
        </div>
      </div>

      <div className="pc-card-body flex flex-col gap-1.5">
        {activeTab && struct[activeTab] && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-text3 uppercase tracking-wider">Voci della sezione</span>
              {canEdit && (
                <button className="pc-btn pc-btn-ghost pc-btn-sm ml-auto" onClick={() => { setEditingTab(activeTab); setTabLabel(struct[activeTab].label); }}>
                  <Pencil className="w-3 h-3"/> Rinomina
                </button>
              )}
              {canEdit && Object.keys(struct).length > 1 && (
                <button className="pc-btn pc-btn-danger pc-btn-sm" onClick={() => removeTab(activeTab)}>
                  <Trash2 className="w-3 h-3"/> Sezione
                </button>
              )}
            </div>
            {struct[activeTab].items.map(it => (
              <div key={it.id} className="flex items-center gap-2 px-3 py-2 rounded-[7px]"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <span className="w-[17px] h-[17px] rounded flex-shrink-0" style={{ border: "1.5px solid var(--border2)" }}/>
                <input className="flex-1 bg-transparent outline-none text-[13px]"
                  value={it.text} disabled={!canEdit}
                  onChange={e => updateItem(it.id, e.target.value)} />
                {canEdit && (
                  <button className="pc-btn-icon" onClick={() => removeItem(it.id)} title="Rimuovi">
                    <Trash2 className="w-3 h-3"/>
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <button onClick={addItem}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[7px] text-[12px] text-text3 hover:text-accent transition-colors"
                style={{ border: "1.5px dashed var(--border2)" }}>
                <Plus className="w-3.5 h-3.5"/> Aggiungi voce
              </button>
            )}
            {!struct[activeTab].items.length && !canEdit && (
              <div className="text-center py-6 text-text3 text-[12px]">Nessuna voce</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
