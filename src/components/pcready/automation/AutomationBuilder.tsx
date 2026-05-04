import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";

type Props = {
  initialFlow?: { id: string } | undefined;
  onSave?: () => void;
  onCancel?: () => void;
};

export default function AutomationBuilder({ initialFlow, onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const idRef = useRef(1);

  useEffect(() => {
    if (!initialFlow) return;
    let mounted = true;
    void (async () => {
      const { data, error } = await supabase
        .from("automation_flows")
        .select("id, name, description, category, active, flow_definition, version")
        .eq("id", initialFlow.id)
        .single();
      if (error) return toast.error(error.message);
      if (!mounted) return;
      setName(data.name ?? "");
      setDescription(data.description ?? null);
      setCategory(data.category ?? null);
      setActive(!!data.active);
      const def = (data.flow_definition ?? { nodes: [], edges: [] }) as { nodes?: Node[]; edges?: Edge[] };
      setNodes(def.nodes ?? []);
      setEdges(def.edges ?? []);
      // ensure idRef is greater than existing ids
      const maxId = (def.nodes ?? []).reduce((m: number, n: Node) => Math.max(m, Number(n.id) || 0), 0);
      idRef.current = Math.max(idRef.current, maxId + 1);
    })();
    return () => {
      mounted = false;
    };
  }, [initialFlow]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), []);

  const addNode = (type: "trigger" | "condition" | "action", label: string) => {
    const id = `${idRef.current++}`;
    const newNode: Node = {
      id,
      position: { x: 200 + nodes.length * 10, y: 100 + nodes.length * 80 },
      data: { label, type },
      style: { padding: 10, borderRadius: 8 },
    };
    setNodes((n) => n.concat(newNode));
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedId(node.id);
  }, []);

  async function handleSave() {
    setAttemptedSave(true);
    setLoading(true);
    try {
      if (!name || name.trim() === "") {
        toast.error("Il nome dell'automazione è obbligatorio");
        setLoading(false);
        return;
      }
      const flowDef = JSON.parse(JSON.stringify({ nodes, edges })) as Json;
      if (initialFlow && initialFlow.id) {
        const { error } = await supabase
          .from("automation_flows")
          .update({ name, description, category, active, flow_definition: flowDef })
          .eq("id", initialFlow.id);
        if (error) throw error;
        toast.success("Automazione aggiornata");
      } else {
        const { error } = await supabase.from("automation_flows").insert({
          name,
          description,
          category,
          active,
          version: 1,
          flow_definition: flowDef,
        });
        if (error) throw error;
        toast.success("Automazione creata");
      }
      onSave?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setLoading(false);
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  return (
    <ReactFlowProvider>
      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-3 p-3 border rounded-md">
          <div className="mb-3 font-semibold">Palette blocchi</div>
          <div className="text-sm text-text3">Trigger</div>
          <ul className="mt-2 space-y-2">
            <li className={`rounded border px-2 py-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !loading && addNode("trigger", "Quando viene creato un ticket")}>Quando viene creato un ticket</li>
            <li className={`rounded border px-2 py-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !loading && addNode("trigger", "Quando cambia stato ticket")}>Quando cambia stato ticket</li>
            <li className={`rounded border px-2 py-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !loading && addNode("trigger", "Esecuzione pianificata")}>Esecuzione pianificata</li>
          </ul>
          <div className="mt-4 text-sm text-text3">Azioni</div>
          <ul className="mt-2 space-y-2">
            <li className={`rounded border px-2 py-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !loading && addNode("action", "Assegna tecnico")}>Assegna tecnico</li>
            <li className={`rounded border px-2 py-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !loading && addNode("action", "Invia notifica")}>Invia notifica</li>
            <li className={`rounded border px-2 py-1 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => !loading && addNode("action", "Crea ticket")}>Crea ticket</li>
          </ul>
        </aside>

        <main className="col-span-6 p-3 border rounded-md">
          <div className="mb-3 font-semibold">Canvas</div>
          <div className="h-96 rounded bg-white/50 p-0 relative">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
                <svg className="h-8 w-8 animate-spin text-slate-700" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" className="opacity-75" />
                </svg>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodesDraggable={!loading}
              nodesConnectable={!loading}
              elementsSelectable={!loading}
              fitView
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </main>

        <section className="col-span-3 p-3 border rounded-md">
          <div className="mb-3 font-semibold">Proprietà</div>
          <div className="space-y-3">
            <div>
              <Label>Nome automazione</Label>
              <Input value={name} onChange={(e: any) => setName(e.target.value)} disabled={loading} aria-invalid={attemptedSave && !name.trim()} />
              {attemptedSave && !name.trim() && (
                <div className="text-sm text-destructive mt-1">Il nome è obbligatorio.</div>
              )}
            </div>

            <div>
              <Label>Categoria</Label>
              <Input value={category ?? ""} onChange={(e: any) => setCategory(e.target.value)} disabled={loading} />
            </div>

            <div>
              <Label>Descrizione</Label>
              <Input value={description ?? ""} onChange={(e: any) => setDescription(e.target.value)} disabled={loading} />
            </div>

            <div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={loading} />
                Attiva
              </label>
            </div>

            <div>
              <div className="mb-2 font-medium">Selezionato</div>
              {selectedNode ? (
                <div className="space-y-2">
                  <div>ID: {selectedNode.id}</div>
                  <div>Tipo: {selectedNode.data?.type}</div>
                  <div>
                    <Label>Label</Label>
                    <Input value={selectedNode.data?.label ?? ""} onChange={(e: any) => {
                      setNodes((nds) => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n));
                    }} disabled={loading} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text3">Nessun blocco selezionato</div>
              )}
            </div>

            <div className="pt-4 flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={loading || !name.trim()}>
                {loading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-75" />
                    </svg>
                    Salvataggio...
                  </>
                ) : (
                  "Salva automazione"
                )}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </ReactFlowProvider>
  );
}
