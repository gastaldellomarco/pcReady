import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// AutomationBuilder is dynamically imported to avoid build-time crawling issues
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import AutomationWizard from "@/components/automations/AutomationWizard";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automazioni — PCReady" }] }),
  component: AutomationsPage,
});

interface Rule {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  active: boolean;
  version: number;
  updated_at: string | null;
  summary?: string | null;
  last_run_at?: string | null;
  flow_definition?: any;
}

const CATEGORY_OPTIONS = ["Generale", "Notifica", "Stato", "Schedulazione"];

function getShortSummary(rule: Rule) {
  return `${rule.name}${rule.category ? ` — ${rule.category}` : ""}`;
}

function RuleCard({
  rule,
  isAdmin,
  expanded,
  onToggle,
  onEdit,
  onExpandToggle,
  onDuplicate,
  onDelete,
  onArchive,
}: {
  rule: Rule;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onExpandToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="rounded-2xl border border-input bg-surface2 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              AUTOMAZIONE
            </Badge>
            <div className="text-sm font-semibold text-foreground">{rule.name}</div>
          </div>

          {rule.description && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
              {rule.description}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="secondary" className="bg-slate-100 text-slate-900 border-transparent">
              {rule.category}
            </Badge>
            <Badge
              className={
                rule.active
                  ? "bg-emerald-100 text-emerald-800 border-transparent"
                  : "bg-slate-100 text-slate-600 border-transparent"
              }
            >
              {rule.active ? "Attiva" : "Spenta"}
            </Badge>
            <span className="text-xs text-text3 font-mono">
              {rule.last_run_at ? `Ultima esecuzione ${fmtDateTime(rule.last_run_at)}` : rule.updated_at ? `Aggiornata ${fmtDateTime(rule.updated_at)}` : `Versione ${rule.version}`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-sm text-text3">
            <button
              type="button"
              onClick={onExpandToggle}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Nascondi dettagli" : "Mostra dettagli"}
            </button>
          </div>

          {expanded && rule.description && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-700">
              {rule.description}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 items-start sm:items-end">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} disabled={!isAdmin}>
              <Pencil className="h-4 w-4" />
              Apri editor
            </Button>
            <Button variant="ghost" size="sm" onClick={onDuplicate} disabled={!isAdmin}>
              Duplica
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={!isAdmin}>
              Elimina
            </Button>
            <Button variant="ghost" size="sm" onClick={onArchive} disabled={!isAdmin}>
              Archivia
            </Button>
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-slate-100 disabled:cursor-not-allowed">
            <input
              type="checkbox"
              checked={rule.active}
              disabled={!isAdmin}
              onChange={onToggle}
              className="sr-only"
            />
            <span
              className="inline-flex h-5 w-9 items-center rounded-full bg-slate-300 p-[3px] transition-all"
              style={{ background: rule.active ? "#a7f3d0" : "#e2e8f0" }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                style={{ transform: rule.active ? "translateX(14px)" : "none" }}
              />
            </span>
            {rule.active ? "Attiva" : "Spenta"}
          </label>
        </div>
      </div>
    </div>
  );
}

function AutomationsPage() {
  const { isAdmin } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [saving, setSaving] = useState(false);
  const [AutomationBuilderComp, setAutomationBuilderComp] = useState<any>(null);
  const [guidedMode, setGuidedMode] = useState(true);

  async function loadRules() {
    setLoadingRules(true);
    try {
      const { data, error } = await supabase
        .from("automation_flows")
        .select("id, name, description, category, active, version, updated_at, flow_definition")
        .order("updated_at", { ascending: false });

      if (error) throw new Error(`Regole: ${error.message}`);
      const rows = (data ?? []) as any[];
      const normalized = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        active: r.active,
        version: r.version,
        updated_at: r.updated_at,
        flow_definition: r.flow_definition,
        summary: r.flow_definition?.meta?.summary ?? null,
        last_run_at: r.flow_definition?.meta?.last_run_at ?? null,
      }));
      setRules(normalized as Rule[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel caricamento regole");
    } finally {
      setLoadingRules(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  async function toggleRule(rule: Rule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    const { error } = await supabase
      .from("automation_flows")
      .update({ active: !rule.active })
      .eq("id", rule.id);

    if (error) return toast.error(error.message);
    void loadRules();
  }

  function openCreateDialog() {
    setEditingRule(null);
    setBuilderOpen(true);
  }

  function openEditDialog(rule: Rule) {
    setEditingRule(rule);
    setBuilderOpen(true);
  }

  // dynamically import builder only when opening (prevents static crawlers from loading heavy libs)
  useEffect(() => {
    let mounted = true;
    if (builderOpen && !AutomationBuilderComp) {
      void import("@/components/pcready/automation/AutomationBuilder").then((mod) => {
        if (!mounted) return;
        setAutomationBuilderComp(() => mod.default);
      }).catch((err) => {
        console.error("Failed to load AutomationBuilder", err);
        toast.error("Errore caricamento editor");
      });
    }
    return () => { mounted = false };
  }, [builderOpen, AutomationBuilderComp]);

  // Builder save will be handled by AutomationBuilder component via callback

  async function saveWizardFlow(flow: any) {
    if (!isAdmin) return toast.error("Solo amministratori");
    setSaving(true);
    try {
      function uid(prefix = "n") {
        if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
        return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      }

      function buildFlowDefinition(flowObj: any) {
        // create trigger node with default position so advanced editor (ReactFlow) won't crash
        const triggerId = `trigger-${uid()}`;
        const actionNodes = (flowObj.actions_definition || []).map((a: any, idx: number) => ({
          id: `action-${uid()}`,
          type: 'action',
          data: { label: a.type, config: a.config },
          position: { x: 300, y: idx * 120 },
        }));
        const nodes = [
          { id: triggerId, type: 'trigger', data: { label: flowObj.trigger_definition?.type || 'trigger' }, position: { x: 0, y: 0 } },
          ...actionNodes,
        ];
        const edges = actionNodes.map((an: any) => ({ id: `e-${triggerId}-${an.id}`, source: triggerId, target: an.id }));
        const meta = {
          wizard: flowObj,
          summary: flowObj.summary,
          migrated_at: new Date().toISOString(),
        };
        return { nodes, edges, meta };
      }

      // attach current user as created_by to satisfy RLS policies that require ownership
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUserId = currentUserData?.user?.id ?? null;

      const payload = {
        name: flow.name || "Nuova automazione",
        description: flow.description || null,
        category: flow.category || null,
        active: false,
        version: (editingRule?.version ?? 0) + 1,
        flow_definition: buildFlowDefinition(flow),
        created_by: currentUserId,
        updated_by: currentUserId,
      } as any;

      if (editingRule) {
        const { data, error } = await supabase.from("automation_flows").update(payload).eq("id", editingRule.id).select("id");
        if (error) {
          console.error("Supabase update error:", error, data);
          throw error;
        }
        toast.success("Automazione aggiornata");
      } else {
        const { data, error } = await supabase.from("automation_flows").insert(payload).select("id");
        if (error) {
          console.error("Supabase insert error:", error, data);
          throw error;
        }
        toast.success("Automazione creata");
      }
      setBuilderOpen(false);
      void loadRules();
    } catch (err) {
      console.error("Save wizard flow failed:", err);
      const e = err as any;
      const userMsg = e && typeof e === "object" && (e.message || e.error || e.details)
        ? (e.message || e.error || e.details)
        : (err instanceof Error ? err.message : JSON.stringify(err));
      toast.error(userMsg || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateRule(rule: Rule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      // fetch existing flow_definition then insert a copy
      const { data: flowData, error: fetchErr } = await supabase
        .from("automation_flows")
        .select("flow_definition")
        .eq("id", rule.id)
        .single();
      if (fetchErr) throw fetchErr;

      const { data, error } = await supabase
        .from("automation_flows")
        .insert({
          name: `${rule.name} (Copia)`,
          description: rule.description,
          category: rule.category,
          active: false,
          version: 1,
          flow_definition: flowData?.flow_definition ?? {},
        })
        .select("id");
      if (error) throw error;
      toast.success("Automazione duplicata");
      void loadRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore duplicazione");
    }
  }

  async function deleteRule(rule: Rule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    const { error } = await supabase.from("automation_flows").delete().eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Automazione eliminata");
    void loadRules();
  }

  async function archiveRule(rule: Rule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    try {
      // fetch current flow_definition
      const { data: fdata, error: fetchErr } = await supabase.from("automation_flows").select("flow_definition").eq("id", rule.id).single();
      if (fetchErr) throw fetchErr;
      const fd: any = fdata?.flow_definition ?? {};
      const meta: any = fd.meta ?? {};
      meta.archived = true;
      fd.meta = meta;
      const { error } = await supabase.from("automation_flows").update({ active: false, flow_definition: fd }).eq("id", rule.id);
      if (error) throw error;
      toast.success("Automazione archiviata");
      void loadRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore archivio");
    }
  }

  // No export/logs on this page anymore

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="pc-card-title">Regole automatiche</span>
            <p className="text-sm text-text3 mt-1">
              Gestisci le condizioni, le azioni e le categorie delle regole.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-slate-100 text-slate-800 border-transparent">
              {rules.filter((r) => r.active).length}/{rules.length} attive
            </Badge>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={categoryFilter ?? ""}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
            >
              <option value="">Tutte le categorie</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-2 py-1 text-sm"
              value={statusFilter ?? ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
            >
              <option value="">Tutti gli stati</option>
              <option value="draft">Draft</option>
              <option value="validated">Validated</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
            <input
              placeholder="Cerca..."
              className="rounded-md border px-2 py-1 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={openCreateDialog} disabled={!isAdmin}>
              <Plus className="h-4 w-4" />
              Aggiungi regola
            </Button>
          </div>
        </div>

        <div className="pc-card-body space-y-3">
          {loadingRules && <div className="text-sm text-text3">Caricamento regole...</div>}
          {!loadingRules && rules.length === 0 && (
            <div className="text-sm text-text3">Nessuna regola disponibile.</div>
          )}
          {!loadingRules &&
            rules
              .filter((rule) => {
                if (categoryFilter && rule.category !== categoryFilter) return false;
                // status derivation
                const status = (() => {
                  const meta = rule.flow_definition?.meta ?? {};
                  if (meta.archived) return "archived";
                  if (meta.paused) return "paused";
                  if (rule.active) return "active";
                  if (rule.version && rule.version === 1) return "draft";
                  return "validated";
                })();
                if (statusFilter && status !== statusFilter) return false;
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!((rule.name || "").toLowerCase().includes(q) || (rule.summary || "").toLowerCase().includes(q))) return false;
                }
                return true;
              })
              .map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isAdmin={isAdmin}
                  expanded={expandedRuleId === rule.id}
                  onToggle={() => void toggleRule(rule)}
                  onEdit={() => openEditDialog(rule)}
                  onDuplicate={() => void duplicateRule(rule)}
                  onDelete={() => void deleteRule(rule)}
                  onArchive={() => void archiveRule(rule)}
                  onExpandToggle={() => setExpandedRuleId((current) => (current === rule.id ? null : rule.id))}
                />
              ))}
        </div>
      </div>

      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="pc-card-title">Automation Builder</span>
            <p className="text-sm text-text3 mt-1">
              Crea e modifica workflow visuali a blocchi. Usa blocchi predefiniti per trigger,
              condizioni e azioni.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setBuilderOpen(true)} disabled={!isAdmin}>
              <Plus className="h-4 w-4" />
              Apri builder
            </Button>
          </div>
        </div>

        <div className="pc-card-body">
          <div className="text-sm text-text3">Apri il builder per costruire automazioni a blocchi.</div>
        </div>
      </div>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Modifica automazione" : "Nuova automazione"}</DialogTitle>
          </DialogHeader>
          <div className="p-2 flex gap-2 items-center">
            <label className={`cursor-pointer px-2 py-1 rounded ${guidedMode ? 'bg-slate-100' : ''}`}>
              <input type="radio" name="builderMode" checked={guidedMode} onChange={() => setGuidedMode(true)} className="sr-only" /> Modalità guidata
            </label>
            <label className={`cursor-pointer px-2 py-1 rounded ${!guidedMode ? 'bg-slate-100' : ''}`}>
              <input type="radio" name="builderMode" checked={!guidedMode} onChange={() => setGuidedMode(false)} className="sr-only" /> Modalità avanzata
            </label>
          </div>

          {guidedMode ? (
            <div className="p-4">
              <AutomationWizard
                initial={editingRule ? { ...editingRule, ...(editingRule.flow_definition?.wizard ?? {}) } : undefined}
                onSave={saveWizardFlow}
                onCancel={() => setBuilderOpen(false)}
              />
            </div>
          ) : AutomationBuilderComp ? (
            <AutomationBuilderComp
              initialFlow={editingRule ? { id: editingRule.id } : undefined}
              onSave={() => {
                setBuilderOpen(false);
                void loadRules();
              }}
              onCancel={() => setBuilderOpen(false)}
            />
          ) : (
            <div className="p-6">Caricamento editor...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
