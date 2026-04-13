"use client";

import { useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  MessageCircle,
  Clock,
  GitBranch,
  Zap,
  CheckCircle2,
  Flame,
  ArrowLeft,
  X,
  Save,
  Trash2,
  AlignLeft,
  Timer,
  MessageSquare,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Node type definitions ────────────────────────────────────────────────────

const NODE_TYPES_CONFIG = {
  trigger: {
    label: "Gatilho",
    color: "bg-purple-50 border-purple-300",
    headerColor: "bg-purple-500",
    icon: <Flame className="w-4 h-4 text-white" />,
    description: "Inicia o fluxo",
  },
  message: {
    label: "Enviar Mensagem",
    color: "bg-blue-50 border-blue-300",
    headerColor: "bg-blue-500",
    icon: <MessageCircle className="w-4 h-4 text-white" />,
    description: "Envia mensagem no WhatsApp",
  },
  wait_reply: {
    label: "Aguardar Resposta",
    color: "bg-orange-50 border-orange-300",
    headerColor: "bg-orange-500",
    icon: <MessageSquare className="w-4 h-4 text-white" />,
    description: "Pausa até o cliente responder",
  },
  timer: {
    label: "Aguardar Tempo",
    color: "bg-gray-50 border-gray-300",
    headerColor: "bg-gray-500",
    icon: <Timer className="w-4 h-4 text-white" />,
    description: "Pausa por um tempo definido",
  },
  condition: {
    label: "Condição",
    color: "bg-yellow-50 border-yellow-300",
    headerColor: "bg-yellow-500",
    icon: <GitBranch className="w-4 h-4 text-white" />,
    description: "Divide o fluxo com base em critérios",
  },
  action: {
    label: "Ação",
    color: "bg-green-50 border-green-300",
    headerColor: "bg-green-500",
    icon: <Zap className="w-4 h-4 text-white" />,
    description: "Altera status, tag ou responsável",
  },
  finish: {
    label: "Finalizar",
    color: "bg-red-50 border-red-300",
    headerColor: "bg-red-400",
    icon: <CheckCircle2 className="w-4 h-4 text-white" />,
    description: "Encerra o fluxo",
  },
};

type NodeKind = keyof typeof NODE_TYPES_CONFIG;

interface FlowNodeData {
  kind: NodeKind;
  label: string;
  text?: string;
  trigger?: string;
  waitSeconds?: number;
  conditionField?: string;
  conditionOp?: string;
  conditionValue?: string;
  actionType?: string;
  actionValue?: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

// ─── Custom node component ────────────────────────────────────────────────────

function FlowNode({ id, data }: NodeProps<FlowNodeData>) {
  const cfg = NODE_TYPES_CONFIG[data.kind];
  const isStart = data.kind === "trigger";
  const isEnd = data.kind === "finish";

  let preview = "";
  if (data.kind === "message" && data.text) {
    preview = data.text.length > 50 ? data.text.substring(0, 50) + "…" : data.text;
  } else if (data.kind === "timer" && data.waitSeconds) {
    const s = data.waitSeconds;
    preview = s >= 3600 ? `${Math.floor(s / 3600)}h` : s >= 60 ? `${Math.floor(s / 60)}min` : `${s}s`;
  } else if (data.kind === "trigger" && data.trigger) {
    preview = data.trigger;
  } else if (data.kind === "condition" && data.conditionField) {
    preview = `${data.conditionField} ${data.conditionOp || "contém"} "${data.conditionValue || "…"}"`;
  } else if (data.kind === "action" && data.actionType) {
    const labels: Record<string, string> = {
      change_status: "Mudar status",
      add_tag: "Adicionar tag",
      assign_agent: "Atribuir responsável",
      remove_bot: "Remover do bot",
    };
    preview = `${labels[data.actionType] || data.actionType}${data.actionValue ? `: ${data.actionValue}` : ""}`;
  }

  return (
    <div
      onClick={() => data.onSelect?.(id)}
      className={`rounded-2xl border-2 shadow-sm cursor-pointer transition-all w-[220px] overflow-hidden ${cfg.color} ${
        data.selected ? "ring-2 ring-brand-500 ring-offset-1" : "hover:shadow-md"
      }`}
    >
      {/* Header */}
      <div className={`${cfg.headerColor} px-3 py-2 flex items-center gap-2`}>
        {cfg.icon}
        <span className="text-white text-xs font-semibold">{cfg.label}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        {preview ? (
          <p className="text-xs text-gray-600 leading-relaxed">{preview}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">{cfg.description}</p>
        )}
      </div>

      {/* Handles */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}
      {!isEnd && data.kind !== "condition" && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
        />
      )}
      {data.kind === "condition" && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: "30%" }}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: "70%" }}
            className="!w-3 !h-3 !bg-red-400 !border-2 !border-white"
          />
          <div className="flex justify-between px-6 pb-1.5">
            <span className="text-[10px] text-green-600 font-medium">Sim</span>
            <span className="text-[10px] text-red-500 font-medium">Não</span>
          </div>
        </>
      )}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

// ─── Config panel ─────────────────────────────────────────────────────────────

function ConfigPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: {
  node: Node<FlowNodeData>;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const cfg = NODE_TYPES_CONFIG[node.data.kind];

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className={`${cfg.headerColor} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {cfg.icon}
          <span className="text-white text-sm font-semibold">{cfg.label}</span>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {node.data.kind === "trigger" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Quando o bot inicia</label>
            <select
              value={node.data.trigger || ""}
              onChange={(e) => onUpdate(node.id, { trigger: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Selecione...</option>
              <option value="Primeira mensagem recebida">Primeira mensagem recebida</option>
              <option value="Tag adicionada">Tag adicionada</option>
              <option value="Status alterado">Status alterado</option>
              <option value="Palavra-chave recebida">Palavra-chave recebida</option>
            </select>
          </div>
        )}

        {node.data.kind === "message" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Texto da mensagem</label>
            <textarea
              value={node.data.text || ""}
              onChange={(e) => onUpdate(node.id, { text: e.target.value })}
              placeholder={"Olá, {{lead.name}}! Como posso ajudar?"}
              rows={5}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">Use {"{{"} lead.name {"}}"}  para o nome do contato</p>
          </div>
        )}

        {node.data.kind === "timer" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Aguardar por</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={(() => {
                  const s = node.data.waitSeconds;
                  if (!s) return "";
                  if (s >= 3600) return Math.floor(s / 3600);
                  if (s >= 60) return Math.floor(s / 60);
                  return s;
                })()}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  const s = node.data.waitSeconds;
                  const unit = s && s >= 3600 ? "h" : s && s >= 60 ? "m" : "s";
                  onUpdate(node.id, {
                    waitSeconds: unit === "h" ? val * 3600 : unit === "m" ? val * 60 : val,
                  });
                }}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <select
                value={(() => {
                  const s = node.data.waitSeconds;
                  if (!s) return "s";
                  if (s >= 3600) return "h";
                  if (s >= 60) return "m";
                  return "s";
                })()}
                onChange={(e) => {
                  const s = node.data.waitSeconds || 1;
                  const cur = s >= 3600 ? s / 3600 : s >= 60 ? s / 60 : s;
                  onUpdate(node.id, {
                    waitSeconds: e.target.value === "h" ? cur * 3600 : e.target.value === "m" ? cur * 60 : cur,
                  });
                }}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="s">segundos</option>
                <option value="m">minutos</option>
                <option value="h">horas</option>
              </select>
            </div>
          </div>
        )}

        {node.data.kind === "wait_reply" && (
          <div className="bg-orange-50 rounded-xl p-3">
            <p className="text-xs text-orange-700">O fluxo pausará até o contato enviar qualquer mensagem antes de continuar.</p>
          </div>
        )}

        {node.data.kind === "condition" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Campo</label>
              <select
                value={node.data.conditionField || ""}
                onChange={(e) => onUpdate(node.id, { conditionField: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Selecione...</option>
                <option value="Mensagem recebida">Mensagem recebida</option>
                <option value="Tag do contato">Tag do contato</option>
                <option value="Status da conversa">Status da conversa</option>
                <option value="Nome do contato">Nome do contato</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Condição</label>
              <select
                value={node.data.conditionOp || "contém"}
                onChange={(e) => onUpdate(node.id, { conditionOp: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="contém">contém</option>
                <option value="não contém">não contém</option>
                <option value="é igual a">é igual a</option>
                <option value="começa com">começa com</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valor</label>
              <input
                type="text"
                value={node.data.conditionValue || ""}
                onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })}
                placeholder="ex: sim, preço, oi..."
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Esquerda = Sim</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Direita = Não</span>
            </div>
          </div>
        )}

        {node.data.kind === "action" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de ação</label>
              <select
                value={node.data.actionType || ""}
                onChange={(e) => onUpdate(node.id, { actionType: e.target.value, actionValue: "" })}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Selecione...</option>
                <option value="change_status">Mudar status da conversa</option>
                <option value="add_tag">Adicionar tag</option>
                <option value="assign_agent">Atribuir responsável</option>
                <option value="remove_bot">Remover do bot</option>
              </select>
            </div>
            {(node.data.actionType === "change_status" ||
              node.data.actionType === "add_tag" ||
              node.data.actionType === "assign_agent") && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {node.data.actionType === "change_status"
                    ? "Novo status"
                    : node.data.actionType === "add_tag"
                    ? "Tag"
                    : "Responsável"}
                </label>
                {node.data.actionType === "change_status" ? (
                  <select
                    value={node.data.actionValue || ""}
                    onChange={(e) => onUpdate(node.id, { actionValue: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="Novo">Novo</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Qualificado">Qualificado</option>
                    <option value="Fechado (ganho)">Fechado (ganho)</option>
                    <option value="Fechado (perdido)">Fechado (perdido)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={node.data.actionValue || ""}
                    onChange={(e) => onUpdate(node.id, { actionValue: e.target.value })}
                    placeholder={node.data.actionType === "add_tag" ? "ex: lead_qualificado" : "ex: Ana Silva"}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {node.data.kind === "finish" && (
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-red-700">Nenhuma ação adicional. O bot encerra aqui.</p>
          </div>
        )}
      </div>

      {node.data.kind !== "trigger" && (
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => onDelete(node.id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remover nó
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Node palette ─────────────────────────────────────────────────────────────

function NodePalette({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  const items: NodeKind[] = ["message", "wait_reply", "timer", "condition", "action", "finish"];

  return (
    <div className="w-52 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nós disponíveis</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((kind) => {
          const cfg = NODE_TYPES_CONFIG[kind];
          return (
            <button
              key={kind}
              onClick={() => onAdd(kind)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left hover:shadow-sm transition-all ${cfg.color}`}
            >
              <div className={`${cfg.headerColor} p-1.5 rounded-lg`}>{cfg.icon}</div>
              <div>
                <p className="text-xs font-semibold text-gray-800">{cfg.label}</p>
                <p className="text-[10px] text-gray-500 leading-tight">{cfg.description}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="p-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 text-center">Clique para adicionar ao canvas</p>
      </div>
    </div>
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialNodes: Node<FlowNodeData>[] = [
  {
    id: "1",
    type: "flowNode",
    position: { x: 150, y: 50 },
    data: { kind: "trigger", label: "Gatilho", trigger: "Primeira mensagem recebida" },
  },
  {
    id: "2",
    type: "flowNode",
    position: { x: 150, y: 220 },
    data: { kind: "message", label: "Enviar Mensagem", text: "Olá, {{lead.name}}! 👋 Bem-vindo(a)! Como posso ajudar?" },
  },
];

const initialEdges: Edge[] = [
  {
    id: "e1-2",
    source: "1",
    target: "2",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
    style: { stroke: "#94a3b8", strokeWidth: 2 },
  },
];

// ─── Main editor ──────────────────────────────────────────────────────────────

export default function BotEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const botName = searchParams?.get("name") || "Novo Bot";

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(botName);
  const [editingName, setEditingName] = useState(false);
  const [saved, setSaved] = useState(false);
  const nodeCount = { current: 10 };

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId((prev) => (prev === id ? null : id));
    },
    []
  );

  const handleUpdate = useCallback(
    (id: string, data: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
    [setNodes]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
    },
    [setNodes, setEdges]
  );

  const handleAdd = useCallback(
    (kind: NodeKind) => {
      nodeCount.current += 1;
      const id = String(nodeCount.current);
      const lastNode = nodes[nodes.length - 1];
      const x = lastNode ? lastNode.position.x : 150;
      const y = lastNode ? lastNode.position.y + 170 : 50;

      const newNode: Node<FlowNodeData> = {
        id,
        type: "flowNode",
        position: { x, y },
        data: { kind, label: NODE_TYPES_CONFIG[kind].label },
      };

      setNodes((nds) => [...nds, newNode]);

      if (lastNode && lastNode.data.kind !== "finish" && lastNode.data.kind !== "condition") {
        setEdges((eds) => [
          ...eds,
          {
            id: `e${lastNode.id}-${id}`,
            source: lastNode.id,
            target: id,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
            style: { stroke: "#94a3b8", strokeWidth: 2 },
          },
        ]);
      }
    },
    [nodes, setNodes, setEdges]
  );

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Inject fresh handlers into all nodes on each render
  const nodesWithHandlers = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onSelect: handleSelect, selected: n.id === selectedId },
  }));

  return (
    <div className="flex h-screen bg-gray-50">
      <NodePalette onAdd={handleAdd} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            {editingName ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                className="text-sm font-semibold text-gray-900 border-b-2 border-brand-500 outline-none bg-transparent px-1"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-semibold text-gray-900 hover:text-brand-600 transition-colors flex items-center gap-1.5"
              >
                {name}
                <AlignLeft className="w-3 h-3 opacity-40" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{nodes.length} nós · {edges.length} conexões</span>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                saved ? "bg-green-500 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
              }`}
            >
              {saved ? (
                <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
              ) : (
                <><Save className="w-4 h-4" /> Salvar</>
              )}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            deleteKeyCode="Delete"
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!bottom-4 !left-4" />
          </ReactFlow>
        </div>
      </div>

      {selectedNode && (
        <ConfigPanel
          node={selectedNode}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
