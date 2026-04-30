import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import { Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automations")({
  head: () => ({ meta: [{ title: "Automazioni — PCReady" }, { name: "description", content: "Regole di automazione e log delle attività di sistema." }] }),
  component: AutomationsPage,
});

interface Rule { id: string; trigger_text: string; action_text: string; active: boolean; count: number; }
interface Log { id: string; type: string; message: string; created_at: string; }

function AutomationsPage() {
  const { isAdmin } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  async function load() {
    const [r, l] = await Promise.all([
      supabase.from("automation_rules").select("id, trigger_text, action_text, active, count").order("sort"),
      supabase.from("activity_log").select("id, type, message, created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    setRules((r.data ?? []) as any); setLogs((l.data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function toggle(rule: Rule) {
    if (!isAdmin) return toast.error("Solo amministratori");
    const { error } = await supabase.from("automation_rules").update({ active: !rule.active }).eq("id", rule.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
      <div className="pc-card">
        <div className="pc-card-hd"><span className="pc-card-title">Regole automatiche</span><span className="text-[11px] text-text3 font-mono">{rules.filter(r => r.active).length}/{rules.length} attive</span></div>
        <div className="pc-card-body flex flex-col gap-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-start gap-3 p-3.5 rounded-[7px]"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <div className="w-[38px] h-[38px] rounded-[9px] flex items-center justify-center flex-shrink-0"
                style={{ background: r.active ? "var(--accent2)" : "var(--surface3)", border: "1px solid var(--border2)", color: r.active ? "var(--accent)" : "var(--text3)" }}>
                <Zap className="w-4 h-4"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold">{r.trigger_text}</div>
                <div className="text-[11.5px] text-text3 mb-1.5">→ {r.action_text}</div>
                <span className="text-[10px] font-mono text-text3 px-1.5 py-0.5 rounded" style={{ background: "var(--surface3)" }}>{r.count} esecuzioni</span>
              </div>
              <label className="cursor-pointer">
                <input type="checkbox" checked={r.active} disabled={!isAdmin} onChange={() => toggle(r)} className="sr-only peer"/>
                <span className="block w-[34px] h-[18px] rounded-full relative transition-colors"
                  style={{ background: r.active ? "var(--accent)" : "var(--border2)" }}>
                  <span className="absolute top-[3px] w-3 h-3 rounded-full bg-white transition-transform"
                    style={{ left: "3px", transform: r.active ? "translateX(16px)" : "none", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}/>
                </span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="pc-card">
        <div className="pc-card-hd"><span className="pc-card-title">Log attività</span></div>
        <div className="pc-card-body flex flex-col gap-1.5 max-h-[600px] overflow-y-auto">
          {logs.map(l => (
            <div key={l.id} className="flex items-start gap-2.5 px-3 py-2 rounded-[7px] text-[12px]"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                style={{
                  background: l.type === "auto" ? "var(--accent2)" : l.type === "user" ? "var(--success-bg)" : "var(--surface3)",
                  color: l.type === "auto" ? "var(--accent)" : l.type === "user" ? "var(--success)" : "var(--text3)",
                }}>{l.type === "auto" ? "⚡" : l.type === "user" ? "👤" : "•"}</span>
              <span className="flex-1 text-text2">{l.message}</span>
              <span className="text-[10px] text-text3 font-mono whitespace-nowrap">{fmtDateTime(l.created_at)}</span>
            </div>
          ))}
          {!logs.length && <div className="text-center text-text3 text-sm py-6">Nessuna attività</div>}
        </div>
      </div>
    </div>
  );
}
