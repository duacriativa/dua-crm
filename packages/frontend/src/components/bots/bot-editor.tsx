"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background, Controls, MiniMap, Handle, Position, MarkerType, useNodesInitialized, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import * as dagre from "@dagrejs/dagre";
import { ArrowLeft, Flame, FlaskConical, LayoutGrid, Loader2, Plus, Save, Send, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth-fetch";
import { fetchTemplates, type WaTemplate } from "@/components/whatsapp/templates";
import { Bot, BotRun, BotStep, BotStepStat, botsApi, newStepId } from "./bot-api";
import {
  BotGraph, OutKind, Output, landAt, linkKey, linkOf, outputsOf, removeButton, removeNode, toGraph, toSteps,
} from "./bot-graph";
import { NEW_STEP, RUN_STATUS, STEP_META, Stage, StepFields, StepType, inp, stepSummary, stepTitle } from "./bot-fields";

/* Editor visual dos bots (estilo Salesbot do Kommo): cada passo é um cartão e cada saída uma seta. */

const START = "__start";
const NODE_W = 280;
const ACTIVE = ["RUNNING", "WAITING_REPLY"];

const KIND_COLOR: Record<OutKind, string> = {
  next: "#9ca3af", reply: "#16a34a", timeout: "#f97316", button: "#6366f1", other: "#a855f7",
};

type Pos = { x: number; y: number };
interface NodeStat { now: number; ended: number; by: Record<string, number> }
interface StepNodeData {
  step: BotStep;
  outputs: (Output & { target: string | null })[];
  stat?: NodeStat;
  total: number;
}

/** Sessões por cartão a partir do passo atual de cada sessão (índice do array salvo). */
function statsByNode(saved: BotStep[], stats: BotStepStat[]) {
  const res: Record<string, NodeStat> = {};
  for (const g of stats) {
    if (!saved.length) break;
    let k = Math.min(g.stepIndex, saved.length - 1);
    // Numa espera de tempo a sessão já aponta para o passo seguinte
    if (g.status === "RUNNING" && g.stepIndex > 0 && saved[g.stepIndex - 1]?.type === "wait") k = g.stepIndex - 1;
    const id = saved[k]?.type === "goto" ? landAt(saved, k) : saved[k]?.id;
    if (!id) continue;
    const r = (res[id] ??= { now: 0, ended: 0, by: {} });
    if (ACTIVE.includes(g.status)) r.now += g.count; else r.ended += g.count;
    r.by[g.status] = (r.by[g.status] ?? 0) + g.count;
  }
  return res;
}

/** Altura aproximada do cartão (antes do React Flow medir). */
function estimateHeight(s: BotStep) {
  const lines = Math.min(5, Math.ceil(stepSummary(s).length / 38) + (stepSummary(s).match(/\n/g)?.length ?? 0));
  return 44 + lines * 16 + 16 + outputsOf(s).length * 26 + 28;
}

function layout(g: BotGraph, size: (s: BotStep) => { w: number; h: number }): Record<string, Pos> {
  const dg = new dagre.graphlib.Graph();
  dg.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 110, marginx: 20, marginy: 20 });
  dg.setDefaultEdgeLabel(() => ({}));
  dg.setNode(START, { width: 220, height: 70 });
  for (const n of g.nodes) { const { w, h } = size(n); dg.setNode(n.id!, { width: w, height: h }); }
  if (g.start) dg.setEdge(START, g.start);
  for (const n of g.nodes) {
    for (const o of outputsOf(n)) {
      const t = linkOf(g, n.id!, o.handle).target;
      if (t && t !== n.id) dg.setEdge(n.id!, t);
    }
  }
  dagre.layout(dg);
  const out: Record<string, Pos> = {};
  for (const n of g.nodes) {
    const d = dg.node(n.id!);
    out[n.id!] = { x: Math.round(d.x - d.width / 2), y: Math.round(d.y - d.height / 2) };
  }
  return out;
}

// ── Cartões ──────────────────────────────────────────────────────────────────

const StepNode = memo(function StepNode({ data, selected }: NodeProps<StepNodeData>) {
  const { step, outputs, stat, total } = data;
  const meta = STEP_META[step.type];
  const summary = stepSummary(step);
  const pct = (n: number) => (total ? ` · ${Math.round((n / total) * 100)}%` : "");
  return (
    <div className={`bg-white rounded-xl border shadow-sm text-gray-900 ${selected ? "border-brand-500 ring-2 ring-brand-200" : "border-gray-200"}`} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Left} style={{ top: 20, width: 10, height: 10, background: "#64748b" }} />
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl text-white ${meta.head}`}>
        {meta.icon("w-3.5 h-3.5 shrink-0")}
        <span className="text-xs font-semibold truncate">{step.name || meta.label}</span>
        {step.name && <span className="ml-auto text-[10px] opacity-80 shrink-0">{meta.label}</span>}
      </div>
      {step.type !== "end" && (
        <p className={`px-3 pt-2 text-xs whitespace-pre-wrap line-clamp-5 ${/não escolhid|vazia/.test(summary) ? "text-red-500" : "text-gray-600"}`}>{summary}</p>
      )}
      <div className="pt-1.5 pb-1">
        {outputs.map((o) => (
          <div key={o.handle} className="relative flex items-center justify-end gap-1.5 pl-3 pr-4 py-1 text-[11px]">
            {o.kind === "button" && <span className="px-1.5 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 truncate">{o.label}</span>}
            {o.kind !== "button" && <span className="text-gray-500">{o.label}</span>}
            {!o.target && <span className="text-[10px] text-red-400">→ encerra</span>}
            <Handle type="source" id={o.handle} position={Position.Right} style={{ right: -6, width: 10, height: 10, background: KIND_COLOR[o.kind] }} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-gray-100 text-[10px] text-gray-400"
        title={stat ? Object.entries(stat.by).map(([s, n]) => `${RUN_STATUS[s]?.label ?? s}: ${n}`).join("\n") : "Nenhuma sessão parou aqui"}>
        <span className={stat?.now ? "text-blue-600 font-semibold" : ""}>{stat?.now ?? 0} aqui agora</span>
        <span>·</span>
        <span className={stat?.ended ? "text-gray-600 font-semibold" : ""}>{stat?.ended ?? 0} terminaram aqui{stat?.ended ? pct(stat.ended) : ""}</span>
      </div>
    </div>
  );
});

const StartNode = memo(function StartNode({ data }: NodeProps<{ label: string; total: number }>) {
  return (
    <div className="bg-white rounded-xl border-2 border-purple-300 shadow-sm px-3 py-2 text-gray-900" style={{ width: 220 }}>
      <div className="flex items-center gap-2 text-xs font-semibold text-purple-700"><Flame className="w-3.5 h-3.5" /> Início</div>
      <p className="text-xs text-gray-600 mt-1">{data.label}</p>
      <p className="text-[10px] text-gray-400 mt-1">{data.total} sessões (sem testes)</p>
      <Handle type="source" id="start" position={Position.Right} style={{ width: 10, height: 10, background: "#a855f7" }} />
    </div>
  );
});

const nodeTypes = { step: StepNode, start: StartNode };

// ── Editor ───────────────────────────────────────────────────────────────────

function listLabel(s: BotStep) {
  if (s.name) return s.name;
  const sum = stepSummary(s).replace(/\s+/g, " ");
  return `${STEP_META[s.type].label}: ${sum.length > 40 ? `${sum.slice(0, 40)}…` : sum}`;
}

export function BotEditor({ bot, onSaved }: { bot: Bot; onSaved: () => Promise<Bot | null> }) {
  const router = useRouter();
  const rf = useReactFlow();
  const initialized = useNodesInitialized();

  const [saved, setSaved] = useState<BotStep[]>(bot.actions);
  const [graph, setGraph] = useState<BotGraph>(() => toGraph(bot.actions));
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const posRef = useRef(pos);
  posRef.current = pos;
  const needsLayout = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [name, setName] = useState(bot.name);
  const [description, setDescription] = useState(bot.description ?? "");
  const [onlyPhones, setOnlyPhones] = useState((bot.conditions?.onlyPhones ?? []).join("\n"));
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [tplError, setTplError] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [stepStats, setStepStats] = useState<BotStepStat[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // Posições salvas; quem não tem passa pelo auto-layout
  const reset = useCallback((actions: BotStep[]) => {
    const g = toGraph(actions);
    const auto = layout(g, (s) => ({ w: NODE_W, h: estimateHeight(s) }));
    const p: Record<string, Pos> = {};
    for (const n of g.nodes) p[n.id!] = n.pos ?? auto[n.id!];
    needsLayout.current = g.nodes.some((n) => !n.pos);
    setSaved(actions);
    setGraph(g);
    setPos(p);
    setDirty(false);
  }, []);

  useEffect(() => { reset(bot.actions); }, [bot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRuns = useCallback(() => {
    botsApi.runs(bot.id).then(setRuns).catch(() => {});
    botsApi.stepStats(bot.id).then(setStepStats).catch(() => {});
  }, [bot.id]);

  useEffect(() => {
    fetchTemplates().then((all) => setTemplates(all.filter((t) => t.status === "APPROVED"))).catch((e) => setTplError(e.message));
    authFetch("/api/v1/pipelines", { headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((pipes: any[]) => setStages((pipes[0]?.stages ?? []).map((s: any) => ({ id: s.id, name: s.name, position: s.position }))))
      .catch(() => {});
    loadRuns();
    const t = setInterval(loadRuns, 30000);
    return () => clearInterval(t);
  }, [loadRuns]);

  // Depois que o React Flow mede os cartões: refaz o layout com as alturas reais (se faltava posição)
  // e abre mostrando o começo do fluxo num zoom legível
  const opened = useRef(false);
  useEffect(() => {
    if (!initialized || opened.current) return;
    opened.current = true;
    let p = pos;
    if (needsLayout.current) {
      needsLayout.current = false;
      const measured = Object.fromEntries(rf.getNodes().map((n) => [n.id, n.height ?? 0]));
      const auto = layout(graph, (s) => ({ w: NODE_W, h: measured[s.id!] || estimateHeight(s) }));
      p = { ...pos };
      for (const n of graph.nodes) if (!n.pos) p[n.id!] = auto[n.id!];
      setPos(p);
    }
    setTimeout(() => focusStart(p), 50);
  }, [initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Enquadra o início e os primeiros cartões à esquerda, num zoom em que dá para ler. */
  const focusStart = (p: Record<string, Pos>) => {
    const pts = Object.entries(p).sort((a, b) => a[1].x - b[1].x).slice(0, 5);
    const box = document.querySelector(".react-flow")?.getBoundingClientRect();
    if (!pts.length || !box) return;
    const h = (id: string) => rf.getNode(id)?.height ?? 200;
    const minX = pts[0][1].x - 300;
    const maxX = Math.max(...pts.map(([, q]) => q.x + NODE_W));
    const minY = Math.min(...pts.map(([, q]) => q.y));
    const maxY = Math.max(...pts.map(([id, q]) => q.y + h(id)));
    const zoom = Math.max(0.7, Math.min(1, (box.width - 40) / (maxX - minX), (box.height - 40) / (maxY - minY)));
    rf.setViewport({ x: 20 - minX * zoom, y: box.height / 2 - ((minY + maxY) / 2) * zoom, zoom });
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const change = (fn: (g: BotGraph) => BotGraph) => { setGraph(fn); setDirty(true); };
  const setStep = (id: string, patch: Partial<BotStep>) =>
    change((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as BotStep) : n)) }));
  const setLink = (id: string, handle: string, target: string | null) =>
    change((g) => (id === START ? { ...g, start: target } : { ...g, links: { ...g.links, [linkKey(id, handle)]: { target, implicit: false } } }));

  const nodeStats = useMemo(() => statsByNode(saved, stepStats), [saved, stepStats]);
  const total = useMemo(() => stepStats.reduce((a, s) => a + s.count, 0), [stepStats]);

  const nodes: Node[] = useMemo(() => {
    const startPos = graph.start && pos[graph.start] ? pos[graph.start] : { x: 0, y: 0 };
    return [
      { id: START, type: "start", position: { x: startPos.x - 300, y: startPos.y }, data: { label: bot.triggerLabel, total }, draggable: false, selectable: false },
      ...graph.nodes.map((s) => ({
        id: s.id!,
        type: "step",
        position: pos[s.id!] ?? { x: 0, y: 0 },
        selected: selected === s.id,
        deletable: false, // Delete só tira setas (excluir passo fica no painel)
        data: {
          step: s,
          outputs: outputsOf(s).map((o) => ({ ...o, target: linkOf(graph, s.id!, o.handle).target })),
          stat: nodeStats[s.id!],
          total,
        } satisfies StepNodeData,
      })),
    ];
  }, [graph, pos, selected, nodeStats, total, bot.triggerLabel]);

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = [];
    const mk = (id: string, source: string, sourceHandle: string, target: string, color: string): Edge => ({
      id, source, sourceHandle, target, type: "smoothstep", style: { stroke: color, strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 }, pathOptions: { borderRadius: 12 },
    } as Edge);
    if (graph.start) out.push(mk(`${START}|start`, START, "start", graph.start, KIND_COLOR.other));
    for (const n of graph.nodes) {
      for (const o of outputsOf(n)) {
        const t = linkOf(graph, n.id!, o.handle).target;
        if (t) out.push(mk(linkKey(n.id!, o.handle), n.id!, o.handle, t, KIND_COLOR[o.kind]));
      }
    }
    return out;
  }, [graph]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === "position" && c.position && c.id !== START) {
        const prev = posRef.current[c.id];
        if (prev && prev.x === c.position.x && prev.y === c.position.y) continue; // clique sem arrastar
        setPos((p) => ({ ...p, [c.id]: c.position! }));
        if (c.dragging) setDirty(true);
      }
      if (c.type === "select" && c.id !== START) setSelected((cur) => (c.selected ? c.id : cur === c.id ? null : cur));
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type !== "remove") continue;
      const [src, handle] = c.id.split("|");
      setLink(src, handle, null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target || c.target === START) return;
    setLink(c.source, c.source === START ? "start" : c.sourceHandle ?? "next", c.target);
  };
  const onEdgeUpdate = (old: Edge, c: Connection) => {
    if (!c.target || c.target === START || c.target === old.source) return;
    setLink(old.source, old.source === START ? "start" : old.sourceHandle ?? "next", c.target);
  };

  const addStep = (type: StepType) => {
    setAddOpen(false);
    const id = newStepId();
    const step = { ...NEW_STEP[type](), id } as BotStep;
    const from = selected ? graph.nodes.find((n) => n.id === selected) : undefined;
    const base = from && pos[from.id!]
      ? { x: pos[from.id!].x + NODE_W + 110, y: pos[from.id!].y }
      : rf.screenToFlowPosition({ x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 100 });
    // Desce até achar espaço livre
    while (Object.values(pos).some((q) => Math.abs(q.x - base.x) < NODE_W && Math.abs(q.y - base.y) < 140)) base.y += 160;
    change((g) => {
      const next: BotGraph = { ...g, nodes: [...g.nodes, step], start: g.start ?? id };
      // Liga a primeira saída livre do cartão selecionado ao novo
      const free = from && outputsOf(from).find((o) => !linkOf(g, from.id!, o.handle).target);
      if (from && free) next.links = { ...g.links, [linkKey(from.id!, free.handle)]: { target: id, implicit: false } };
      return next;
    });
    setPos((p) => ({ ...p, [id]: base }));
    setSelected(id);
  };

  const deleteStep = (id: string) => {
    if (!confirm("Excluir este passo? As setas que chegavam nele passam a encerrar o bot.")) return;
    change((g) => removeNode(g, id));
    setSelected(null);
  };

  const relayout = () => {
    const measured = Object.fromEntries(rf.getNodes().map((n) => [n.id, n.height ?? 0]));
    const p = layout(graph, (s) => ({ w: NODE_W, h: measured[s.id!] || estimateHeight(s) }));
    setPos(p);
    setDirty(true);
    setTimeout(() => focusStart(p), 50);
  };

  const save = async () => {
    setError("");
    let actions: BotStep[];
    try {
      actions = toSteps(graph, (id) => pos[id]);
    } catch (e: any) {
      setError(e.message);
      return;
    }
    // Sessões em andamento guardam o índice do passo: mudar a ordem as faria pular de passo
    const oldIdx = new Map(saved.map((s, i) => [s.id, i]));
    const moved = actions.some((s, i) => oldIdx.has(s.id) && oldIdx.get(s.id) !== i) || actions.length < saved.length;
    if (moved && bot.stats.active > 0 &&
      !confirm(`Esta mudança reordena os passos e há ${bot.stats.active} sessão(ões) em andamento, que podem pular para outro passo. Salvar mesmo assim?`)) return;
    setSaving(true);
    try {
      await botsApi.update(bot.id, {
        name, description, actions,
        conditions: { onlyPhones: onlyPhones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean) },
      });
      const fresh = await onSaved();
      reset(fresh?.actions ?? actions);
      loadRuns();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTestMsg("");
    if (dirty) { setTestMsg("Salve antes de testar: o teste roda os passos salvos."); return; }
    try {
      await botsApi.test(bot.id, testPhone);
      setTestMsg("Teste iniciado: acompanhe a conversa no WhatsApp do CRM.");
      setTimeout(loadRuns, 1500);
    } catch (e: any) {
      setTestMsg(e.message);
    }
  };

  const back = () => {
    if (dirty && !confirm("Sair sem salvar as mudanças?")) return;
    router.push("/dashboard/bots");
  };

  const sel = selected ? graph.nodes.find((n) => n.id === selected) : undefined;
  const others = (self?: string) => graph.nodes.filter((n) => n.id !== self);

  return (
    <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col text-gray-900">
      {/* Barra do topo */}
      <div className="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center gap-3 px-4">
        <button onClick={back} className="p-2 rounded-xl hover:bg-gray-100" title="Voltar para os bots"><ArrowLeft className="w-4 h-4" /></button>
        <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }}
          className="text-sm font-semibold text-gray-900 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-lg px-2 py-1 min-w-0 w-80 focus:outline-none" />
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${bot.active ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
          {bot.active ? "Ativo" : "Pausado"}
        </span>
        {bot.stats.active > 0 && <span className="text-[11px] text-blue-600">{bot.stats.active} em andamento</span>}
        <div className="ml-auto flex items-center gap-2">
          {error && <p className="text-xs text-red-600 max-w-md truncate" title={error}>{error}</p>}
          {dirty && !error && <span className="text-xs text-amber-600 whitespace-nowrap">Mudanças não salvas</span>}
          <div className="relative">
            <button onClick={() => setAddOpen((v) => !v)} className="flex items-center gap-1.5 text-sm text-brand-600 font-medium px-3 py-2 rounded-xl hover:bg-brand-50">
              <Plus className="w-4 h-4" /> Passo
            </button>
            {addOpen && (
              <div className="absolute right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[230px]">
                {(Object.keys(STEP_META) as StepType[]).filter((t) => t !== "goto").map((t) => (
                  <button key={t} onClick={() => addStep(t)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {STEP_META[t].icon()}{STEP_META[t].label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={relayout} className="flex items-center gap-1.5 text-sm text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-100" title="Reorganizar os cartões automaticamente">
            <LayoutGrid className="w-4 h-4" /> Organizar
          </button>
          <button onClick={save} disabled={saving || !dirty} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={connect}
            onEdgeUpdate={onEdgeUpdate}
            onPaneClick={() => setSelected(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            minZoom={0.1}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color="#e5e7eb" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => (n.type === "start" ? "#a855f7" : "#cbd5e1")} />
          </ReactFlow>
        </div>

        {/* Painel lateral */}
        <aside className="w-[400px] shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
          {sel ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${STEP_META[sel.type].color}`}>{STEP_META[sel.type].icon()}{STEP_META[sel.type].label}</span>
                <button onClick={() => setSelected(null)} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100" title="Fechar"><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <input value={sel.name ?? ""} onChange={(e) => setStep(sel.id!, { name: e.target.value })} placeholder="Nome do passo (opcional)" className={inp} />
              <StepFields
                step={sel}
                set={(patch) => setStep(sel.id!, patch)}
                templates={templates}
                tplError={tplError}
                stages={stages}
                onAddButton={() => sel.type === "send_buttons" && setStep(sel.id!, { buttons: [...sel.buttons, { title: "" }] })}
                onRemoveButton={(k) => change((g) => removeButton(g, sel.id!, k))}
              />

              {outputsOf(sel).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saídas</p>
                  <p className="text-[11px] text-gray-400">Também dá para arrastar as setas no canvas. Sem seta, o bot encerra.</p>
                  {outputsOf(sel).map((o) => (
                    <label key={o.handle} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: KIND_COLOR[o.kind] }} />
                      <span className="w-32 shrink-0 truncate" title={o.label}>{o.label}</span>
                      <select value={linkOf(graph, sel.id!, o.handle).target ?? ""} onChange={(e) => setLink(sel.id!, o.handle, e.target.value || null)}
                        className="flex-1 min-w-0 px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white">
                        <option value="">Encerrar o bot</option>
                        {others(sel.id).map((n) => <option key={n.id} value={n.id}>{listLabel(n)}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              {nodeStats[sel.id!] && (
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p className="font-semibold text-gray-500 uppercase tracking-wide">Sessões neste passo</p>
                  {Object.entries(nodeStats[sel.id!].by).map(([s, n]) => <p key={s}>{RUN_STATUS[s]?.label ?? s}: {n}</p>)}
                </div>
              )}

              <button onClick={() => deleteStep(sel.id!)} className="flex items-center gap-1.5 text-sm text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Excluir passo
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              <div>
                <p className="text-xs text-gray-400">Gatilho: {bot.triggerLabel}</p>
                <input value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} placeholder="Descrição (opcional)" className={`${inp} mt-2`} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Começa em</p>
                <select value={graph.start ?? ""} onChange={(e) => setLink(START, "start", e.target.value || null)} className={inp}>
                  <option value="">Escolha o primeiro passo…</option>
                  {graph.nodes.map((n) => <option key={n.id} value={n.id}>{listLabel(n)}</option>)}
                </select>
                <p className="text-[11px] text-gray-400">
                  Clique num cartão para editar. Arraste de uma bolinha à direita até outro cartão para ligar; selecione uma seta e aperte Delete para tirar.
                  Se alguém do time escrever na conversa, o bot para.
                </p>
              </div>

              {/* Modo teste */}
              <div className="border border-amber-100 bg-amber-50/50 rounded-xl p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><FlaskConical className="w-3.5 h-3.5" /> Teste</p>
                <p className="text-[11px] text-gray-500">Só disparar para estes números (um por linha). Vazio = todos os leads do gatilho.</p>
                <textarea rows={2} value={onlyPhones} onChange={(e) => { setOnlyPhones(e.target.value); setDirty(true); }} placeholder="+55 85 99999-0000" className={inp} />
                <div className="flex items-center gap-2">
                  <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Rodar agora para o número…" className={inp} />
                  <button onClick={runTest} disabled={!testPhone.trim()} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-40 shrink-0">
                    <Send className="w-3.5 h-3.5" /> Testar
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">O teste roda os passos salvos, mesmo com o bot pausado.</p>
                {testMsg && <p className="text-xs text-gray-700">{testMsg}</p>}
              </div>

              {/* Últimas sessões */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Últimas sessões</p>
                {runs.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma ainda.</p>
                ) : (
                  <ul className="divide-y divide-gray-50 text-xs">
                    {runs.map((r) => {
                      const st = RUN_STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-600" };
                      const atId = saved[r.stepIndex]?.type === "goto" ? landAt(saved, r.stepIndex) : saved[r.stepIndex]?.id;
                      const at = graph.nodes.find((n) => n.id === atId);
                      return (
                        <li key={r.id} className="py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50" onClick={() => at && setSelected(at.id!)}
                          title={r.lastError ?? (at ? `Passo: ${stepTitle(at)}` : "")}>
                          <span className="font-medium text-gray-800 truncate">{r.contact?.name ?? "Contato removido"}</span>
                          {r.isTest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">teste</span>}
                          <span className="ml-auto text-gray-400 shrink-0">{new Date(r.startedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                          <span className={`px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
