import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Download, Pencil, Settings, User, Zap, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({
    meta: [
      { title: "Automazioni — PCReady" },
      { name: "description", content: "Regole di automazione e log delle attività di sistema." },
    ],
  }),
  component: AutomationsPage,
});

interface Rule {
  id: string;
  trigger_text: string;
  action_text: string;
  active: boolean;
  count: number;
  description: string | null;
  category: string;
  last_run_at: string | null;
}

interface Log {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

type LogFilter = "all" | "auto" | "user" | "sys";

const LOG_PAGE_SIZE = 20;
const CATEGORY_OPTIONS = ["Generale", "Notifica", "Stato", "Schedulazione"];

function getLogLabel(type: string) {
  return type === "auto" ? "Auto" : type === "user" ? "Utente" : "Sistema";
}

function getLogIcon(type: string) {
  if (type === "auto") return <Zap className="h-4 w-4" />;
  if (type === "user") return <User className="h-4 w-4" />;
  return <Settings className="h-4 w-4" />;
}

function RuleCard({
  rule,
  isAdmin,
  expanded,
  onToggle,
  onEdit,
  onExpandToggle,
}: {
  rule: Rule;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onExpandToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-input bg-surface2 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              TRIGGER
            </Badge>
            <div className="text-sm font-semibold text-foreground">{rule.trigger_text}</div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              AZIONE
            </Badge>
            <div className="text-sm font-semibold text-foreground">{rule.action_text}</div>
          </div>
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
              {rule.active ? "Attiva" : "Disattiva"}
            </Badge>
            <span className="text-xs text-text3 font-mono">
              {rule.last_run_at
                ? `Ultima esecuzione ${fmtDateTime(rule.last_run_at)}`
                : "Mai eseguita"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 items-center text-sm text-text3">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{rule.count} esecuzioni</span>
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
              Modifica
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
  const [logs, setLogs] = useState<Log[]>([]);
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [logPage, setLogPage] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [form, setForm] = useState({
    trigger_text: "",
    action_text: "",
    description: "",
    category: "Generale",
    active: true,
  });
  const [saving, setSaving] = useState(false);

  async function loadRules() {
    setLoadingRules(true);
    try {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("id, trigger_text, action_text, active, count, description, category, last_run_at")
        .order("sort");

      if (error) throw new Error(`Regole: ${error.message}`);
      setRules((data ?? []) as Rule[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel caricamento regole");
    } finally {
      setLoadingRules(false);
    }
  }

  async function loadLogs(filter: LogFilter, page = 0, reset = false) {
    setLoadingLogs(true);
    try {
      const query = supabase
        .from("activity_log")
        .select("id, type, message, created_at")
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query.eq("type", filter);
      }

      const from = page * LOG_PAGE_SIZE;
      const to = from + LOG_PAGE_SIZE - 1;
      const { data, error } = await query.range(from, to);

      if (error) throw new Error(`Log: ${error.message}`);

      const items = data ?? [];
      setLogs((current) => (reset ? items : [...current, ...items]));
      setLogPage(page);
      setHasMoreLogs(items.length === LOG_PAGE_SIZE);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel caricamento log");
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, []);

  useEffect(() => {
    void loadLogs(logFilter, 0, true);
  }, [logFilter]);

  async function toggleRule(rule: Rule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    const { error } = await supabase
      .from("automation_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);

    if (error) return toast.error(error.message);
    void loadRules();
  }

  function openCreateDialog() {
    setEditingRule(null);
    setForm({
      trigger_text: "",
      action_text: "",
      description: "",
      category: "Generale",
      active: true,
    });
    setDialogOpen(true);
  }

  function openEditDialog(rule: Rule) {
    setEditingRule(rule);
    setForm({
      trigger_text: rule.trigger_text,
      action_text: rule.action_text,
      description: rule.description ?? "",
      category: rule.category,
      active: rule.active,
    });
    setDialogOpen(true);
  }

  async function saveRule() {
    if (!form.trigger_text.trim() || !form.action_text.trim()) {
      return toast.error("Trigger e azione sono obbligatori");
    }

    setSaving(true);
    const payload = {
      trigger_text: form.trigger_text.trim(),
      action_text: form.action_text.trim(),
      description: form.description.trim() || null,
      category: form.category,
      active: form.active,
    };

    const result = editingRule
      ? await supabase.from("automation_rules").update(payload).eq("id", editingRule.id)
      : await supabase.from("automation_rules").insert(payload);

    setSaving(false);

    if (result.error) {
      return toast.error(result.error.message);
    }

    toast.success(editingRule ? "Regola aggiornata" : "Regola creata");
    setDialogOpen(false);
    void loadRules();
  }

  function exportCsv() {
    if (!logs.length) return toast.error("Nessun log da esportare");
    const rows = [
      ["Timestamp", "Tipo", "Messaggio"],
      ...logs.map((log) => [fmtDateTime(log.created_at), getLogLabel(log.type), log.message]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `log-automazioni-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

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
            rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                isAdmin={isAdmin}
                expanded={expandedRuleId === rule.id}
                onToggle={() => void toggleRule(rule)}
                onEdit={() => openEditDialog(rule)}
                onExpandToggle={() =>
                  setExpandedRuleId((current) => (current === rule.id ? null : rule.id))
                }
              />
            ))}
        </div>
      </div>

      <div className="pc-card">
        <div className="pc-card-hd flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="pc-card-title">Log attività</span>
            <p className="text-sm text-text3 mt-1">
              Filtra per tipo e scarica il log delle azioni.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Esporta CSV
            </Button>
          </div>
        </div>

        <div className="pc-card-body space-y-4">
          <Tabs value={logFilter} onValueChange={(value) => setLogFilter(value as LogFilter)}>
            <TabsList>
              <TabsTrigger value="all">Tutte</TabsTrigger>
              <TabsTrigger value="auto">Auto</TabsTrigger>
              <TabsTrigger value="user">Utente</TabsTrigger>
              <TabsTrigger value="sys">Sistema</TabsTrigger>
            </TabsList>
            <TabsContent value={logFilter}>
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-input bg-surface2 p-3">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        {getLogIcon(log.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground">
                          {getLogLabel(log.type)}
                        </div>
                        <div className="text-sm text-text2">{log.message}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text3">
                      <span>{fmtDateTime(log.created_at)}</span>
                      <span>
                        {log.type === "sys" ? "Sistema" : log.type === "user" ? "Utente" : "Auto"}
                      </span>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && !loadingLogs && (
                  <div className="text-center text-text3 py-6">Nessuna attività</div>
                )}
                {loadingLogs && <div className="text-sm text-text3">Caricamento log...</div>}
                {hasMoreLogs && (
                  <div className="flex justify-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void loadLogs(logFilter, logPage + 1, false)}
                    >
                      Mostra altro
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Modifica regola" : "Nuova regola"}</DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Aggiorna i dettagli della regola selezionata."
                : "Crea una nuova regola automatica con trigger, azione e descrizione."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="triggerText">Trigger</Label>
              <Input
                id="triggerText"
                value={form.trigger_text}
                onChange={(event) =>
                  setForm((current) => ({ ...current, trigger_text: event.target.value }))
                }
                placeholder="Quando..."
              />
            </div>
            <div>
              <Label htmlFor="actionText">Azione</Label>
              <Input
                id="actionText"
                value={form.action_text}
                onChange={(event) =>
                  setForm((current) => ({ ...current, action_text: event.target.value }))
                }
                placeholder="Allora..."
              />
            </div>
            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Descrivi cosa fa questa regola"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Seleziona categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {CATEGORY_OPTIONS.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="active">Stato</Label>
                <div className="mt-2 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      id="active"
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, active: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    Attiva
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={saveRule} disabled={saving}>
              {saving ? "Salvataggio..." : editingRule ? "Salva regola" : "Crea regola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
