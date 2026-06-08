import "reactflow/dist/style.css";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  validateFlowGraph,
  summarizeErrors,
  groupErrorsBySection,
  getSectionLabel,
} from "@/lib/automations/flow-validation";
import automationsQueries from "@/lib/queries/automations";
import type { Json } from "@/integrations/supabase/types";

type Props = {
  initialFlow?: { id: string } | undefined;
  onSave?: () => void;
  onCancel?: () => void;
};

/**
 *
 */
export default function AutomationBuilder({ initialFlow, onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ path: string; message: string }>
  >([]);
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
      const def = (data.flow_definition ?? { nodes: [], edges: [] }) as {
        nodes?: Node[];
        edges?: Edge[];
      };
      setNodes(def.nodes ?? []);
      setEdges(def.edges ?? []);
      // ensure idRef is greater than existing ids
      const maxId = (def.nodes ?? []).reduce(
        (m: number, n: Node) => Math.max(m, Number(n.id) || 0),
        0,
      );
      idRef.current = Math.max(idRef.current, maxId + 1);
    })();
    return () => {
      mounted = false;
    };
  }, [initialFlow]);

  const createAutomationMut = (automationsQueries as any).useCreateAutomation();
  const updateAutomationMut = (automationsQueries as any).useUpdateAutomation();

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [],
  );

  const addNode = (
    type: "trigger" | "condition" | "action",
    label: string,
    config: Record<string, unknown> = {},
    actionType?: string,
  ) => {
    const id = `${idRef.current++}`;
    const newNode: Node = {
      id,
      position: { x: 200 + nodes.length * 10, y: 100 + nodes.length * 80 },
      data: { label, type, config, actionType },
      style: { padding: 10, borderRadius: 8 },
    };
    setNodes((n) => n.concat(newNode));
  };

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedId(null);
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

      // Validate graph structure
      const validation = validateFlowGraph(nodes, edges);
      setValidationErrors(validation.errors.map((e) => ({ path: e.path, message: e.message })));
      if (!validation.valid) {
        const sections = groupErrorsBySection(validation.errors);
        const lines: string[] = [];
        for (const [section, errs] of Object.entries(sections)) {
          const label = getSectionLabel(section);
          for (const err of errs) {
            lines.push(`- ${label}: ${err.message}`);
          }
        }
        const summary = summarizeErrors(validation.errors);
        toast.error(`Validazione fallita (${summary}):\n${lines.join("\n")}`, {
          duration: 8000,
          richColors: true,
        });
        setLoading(false);
        return;
      }

      const flowDef = JSON.parse(JSON.stringify({ nodes, edges })) as Json;
      if (initialFlow && initialFlow.id) {
        await updateAutomationMut.mutateAsync({
          id: initialFlow.id,
          payload: { name, description, category, active, flow_definition: flowDef },
        });
        toast.success("Automazione aggiornata");
      } else {
        await createAutomationMut.mutateAsync({
          name,
          description,
          category,
          active,
          version: 1,
          flow_definition: flowDef,
        });
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
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  function updateSelectedNodeData(patch: Record<string, unknown>) {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }

  function updateSelectedNodeConfig(patch: Record<string, unknown>) {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, config: { ...(n.data?.config ?? {}), ...patch } } }
          : n,
      ),
    );
  }

  function updateSelectedEdgeData(patch: Record<string, unknown>) {
    if (!selectedEdge) return;
    setEdges((eds) =>
      eds.map((edge) =>
        edge.id === selectedEdge.id
          ? {
              ...edge,
              label: patch.branch === "true" ? "True" : patch.branch === "false" ? "False" : "",
              data: { ...(edge.data ?? {}), ...patch },
            }
          : edge,
      ),
    );
  }

  return (
    <ReactFlowProvider>
      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-3 p-3 border rounded-md">
          <div className="mb-3 font-semibold">Palette blocchi</div>
          <div className="text-sm text-text3">Trigger</div>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => !loading && addNode("trigger", "Quando viene creato un ticket")}
              disabled={loading}
            >
              Quando viene creato un ticket
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => !loading && addNode("trigger", "Quando cambia stato ticket")}
              disabled={loading}
            >
              Quando cambia stato ticket
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => !loading && addNode("trigger", "Esecuzione pianificata")}
              disabled={loading}
            >
              Esecuzione pianificata
            </button>
          </div>
          <div className="mt-4 text-sm text-text3">Condizioni</div>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() =>
                !loading &&
                addNode("condition", "Condizione", {
                  field: "priority",
                  operator: "equals",
                  value: "high",
                })
              }
              disabled={loading}
            >
              Se campo / operatore / valore
            </button>
          </div>
          <div className="mt-4 text-sm text-text3">Azioni</div>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => !loading && addNode("action", "Assegna tecnico")}
              disabled={loading}
            >
              Assegna tecnico
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => !loading && addNode("action", "Invia notifica")}
              disabled={loading}
            >
              Invia notifica
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => !loading && addNode("action", "Crea ticket")}
              disabled={loading}
            >
              Crea ticket
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() =>
                !loading && addNode("action", "Aspetta", { amount: 1, unit: "hours" }, "delay")
              }
              disabled={loading}
            >
              Aspetta / Delay
            </button>
            <button
              type="button"
              className={`rounded border px-2 py-1 text-left w-full ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() =>
                !loading &&
                addNode(
                  "action",
                  "Webhook",
                  { url: "", payload: '{\n  "event": "{{trigger}}"\n}' },
                  "send_webhook",
                )
              }
              disabled={loading}
            >
              Webhook HTTP POST
            </button>
          </div>
        </aside>

        <main className="col-span-6 p-3 border rounded-md">
          <div className="mb-3 font-semibold">Canvas</div>
          <div className="h-96 rounded bg-background/50 p-0 relative">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70">
                <svg
                  className="h-8 w-8 animate-spin text-slate-700"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="opacity-75"
                  />
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
              onEdgeClick={onEdgeClick}
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
              <Input
                value={name}
                onChange={(e: any) => setName(e.target.value)}
                disabled={loading}
                aria-invalid={attemptedSave && !name.trim()}
              />
              {attemptedSave && !name.trim() && (
                <div className="text-sm text-destructive mt-1">Il nome è obbligatorio.</div>
              )}
            </div>

            <div>
              <Label>Categoria</Label>
              <Input
                value={category ?? ""}
                onChange={(e: any) => setCategory(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label>Descrizione</Label>
              <Input
                value={description ?? ""}
                onChange={(e: any) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={loading}
                />
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
                    <Input
                      value={selectedNode.data?.label ?? ""}
                      onChange={(e: any) => updateSelectedNodeData({ label: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                  {selectedNode.data?.type === "condition" && (
                    <div className="space-y-2 rounded-md border p-2">
                      <div className="text-xs font-semibold text-text3">Condizione</div>
                      <Label>Campo payload</Label>
                      <Input
                        value={selectedNode.data?.config?.field ?? ""}
                        onChange={(e: any) => updateSelectedNodeConfig({ field: e.target.value })}
                        placeholder="priority"
                        disabled={loading}
                      />
                      <Label>Operatore</Label>
                      <select
                        className="pc-input"
                        value={selectedNode.data?.config?.operator ?? "equals"}
                        onChange={(e) => updateSelectedNodeConfig({ operator: e.target.value })}
                        disabled={loading}
                        aria-label="Operatore condizione"
                      >
                        <option value="equals">uguale a</option>
                        <option value="not_equals">diverso da</option>
                        <option value="contains">contiene</option>
                        <option value="exists">esiste</option>
                        <option value="gt">maggiore di</option>
                        <option value="lt">minore di</option>
                      </select>
                      <Label>Valore</Label>
                      <Input
                        value={selectedNode.data?.config?.value ?? ""}
                        onChange={(e: any) => updateSelectedNodeConfig({ value: e.target.value })}
                        placeholder="high"
                        disabled={loading}
                      />
                      <div className="text-xs text-text3">
                        Collega due edge in uscita e seleziona ogni edge per marcarlo True o False.
                      </div>
                    </div>
                  )}
                  {selectedNode.data?.actionType === "delay" && (
                    <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
                      <label className="text-xs">
                        Quantita
                        <Input
                          type="number"
                          min={1}
                          value={selectedNode.data?.config?.amount ?? 1}
                          onChange={(e: any) =>
                            updateSelectedNodeConfig({ amount: Number(e.target.value) })
                          }
                          disabled={loading}
                        />
                      </label>
                      <label className="text-xs">
                        Unita
                        <select
                          className="pc-input mt-1"
                          value={selectedNode.data?.config?.unit ?? "hours"}
                          onChange={(e) => updateSelectedNodeConfig({ unit: e.target.value })}
                          disabled={loading}
                          aria-label="Unità delay"
                        >
                          <option value="hours">ore</option>
                          <option value="days">giorni</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {selectedNode.data?.actionType === "send_webhook" && (
                    <div className="space-y-2 rounded-md border p-2">
                      <Label>URL webhook</Label>
                      <Input
                        value={selectedNode.data?.config?.url ?? ""}
                        onChange={(e: any) => updateSelectedNodeConfig({ url: e.target.value })}
                        placeholder="https://..."
                        disabled={loading}
                      />
                      <Label>Payload JSON</Label>
                      <textarea
                        className="pc-input min-h-24 font-mono text-xs"
                        value={selectedNode.data?.config?.payload ?? ""}
                        onChange={(e) => updateSelectedNodeConfig({ payload: e.target.value })}
                        disabled={loading}
                        aria-label="Payload JSON"
                      />
                    </div>
                  )}
                </div>
              ) : selectedEdge ? (
                <div className="space-y-2">
                  <div>ID edge: {selectedEdge.id}</div>
                  <Label>Ramo condizione</Label>
                  <select
                    className="pc-input"
                    value={(selectedEdge.data?.branch as string) ?? ""}
                    onChange={(e) => updateSelectedEdgeData({ branch: e.target.value || null })}
                    disabled={loading}
                    aria-label="Ramo condizione"
                  >
                    <option value="">Sequenziale</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                  <div className="text-xs text-text3">
                    Usa True/False sugli edge che partono da un blocco Condizione.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-text3">Nessun blocco selezionato</div>
              )}
            </div>

            <div className="pt-4 flex gap-2">
              {validationErrors.length > 0 && (
                <div className="mb-3 w-full space-y-1">
                  <p className="text-xs font-semibold text-red-600">Errori di validazione:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {validationErrors.map((err) => (
                      <li key={err.path || err.message} className="text-xs text-red-500">
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button variant="outline" onClick={onCancel} disabled={loading}>
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={loading || !name.trim()}>
                {loading ? (
                  <>
                    <svg className="mr-2 size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-75"
                      />
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
