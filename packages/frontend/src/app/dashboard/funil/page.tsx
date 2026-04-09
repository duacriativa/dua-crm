"use client";

import { useState } from "react";
import {
  Plus,
  MoreVertical,
  ChevronRight,
  Kanban,
  TrendingUp,
  DollarSign,
  Users,
  GripVertical,
  X,
  Edit,
  Trash2,
} from "lucide-react";

interface Stage {
  id: string;
  name: string;
  color: string;
  leads: Lead[];
}

interface Lead {
  id: string;
  name: string;
  contact: string;
  value?: number;
  tag?: string;
  daysInStage: number;
}

interface Pipeline {
  id: string;
  name: string;
  totalLeads: number;
  totalValue: number;
  stages: Stage[];
}

const COLORS = [
  "#6366F1", "#E8501F", "#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444",
];

const PIPELINES: Pipeline[] = [
  {
    id: "1",
    name: "Vendas Varejo",
    totalLeads: 24,
    totalValue: 38500,
    stages: [
      {
        id: "s1", name: "Novo Lead", color: "#6366F1",
        leads: [
          { id: "l1", name: "Ana Lima", contact: "+55 11 99999-0001", value: 1200, tag: "Instagram", daysInStage: 1 },
          { id: "l2", name: "Isabela Ferreira", contact: "+55 11 93333-0008", daysInStage: 0 },
        ],
      },
      {
        id: "s2", name: "Qualificado", color: "#3B82F6",
        leads: [
          { id: "l3", name: "Beatriz Souza", contact: "+55 21 98888-0002", value: 850, tag: "Atacado", daysInStage: 3 },
          { id: "l4", name: "Helena Martins", contact: "+55 47 94444-0007", value: 1750, daysInStage: 2 },
        ],
      },
      {
        id: "s3", name: "Proposta", color: "#F59E0B",
        leads: [
          { id: "l5", name: "Fernanda Costa", contact: "+55 85 95555-0005", value: 2500, daysInStage: 5 },
        ],
      },
      {
        id: "s4", name: "Negociação", color: "#E8501F",
        leads: [
          { id: "l6", name: "Gabriela Alves", contact: "gabi@email.com", value: 5800, tag: "VIP", daysInStage: 7 },
        ],
      },
      {
        id: "s5", name: "Fechado", color: "#10B981",
        leads: [],
      },
    ],
  },
  {
    id: "2",
    name: "Atacado Premium",
    totalLeads: 11,
    totalValue: 87200,
    stages: [
      { id: "a1", name: "Prospecção", color: "#8B5CF6", leads: [] },
      { id: "a2", name: "Apresentação", color: "#3B82F6", leads: [] },
      { id: "a3", name: "Proposta", color: "#F59E0B", leads: [] },
      { id: "a4", name: "Contrato", color: "#10B981", leads: [] },
    ],
  },
];

export default function FunilPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(PIPELINES);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [showNewLead, setShowNewLead] = useState<string | null>(null); // stageId
  const [newLead, setNewLead] = useState({ name: "", contact: "", value: "" });
  const [draggingLead, setDraggingLead] = useState<{ lead: Lead; fromStageId: string } | null>(null);

  const createPipeline = () => {
    if (!newPipelineName.trim()) return;
    const p: Pipeline = {
      id: `p-${Date.now()}`,
      name: newPipelineName.trim(),
      totalLeads: 0,
      totalValue: 0,
      stages: [
        { id: `s-${Date.now()}-1`, name: "Novo Lead", color: "#6366F1", leads: [] },
        { id: `s-${Date.now()}-2`, name: "Em Andamento", color: "#F59E0B", leads: [] },
        { id: `s-${Date.now()}-3`, name: "Fechado", color: "#10B981", leads: [] },
      ],
    };
    setPipelines((prev) => [...prev, p]);
    setNewPipelineName("");
    setShowNewPipeline(false);
  };

  const addLead = (stageId: string) => {
    if (!newLead.name.trim() || !activePipeline) return;
    const lead: Lead = {
      id: `l-${Date.now()}`,
      name: newLead.name.trim(),
      contact: newLead.contact,
      value: newLead.value ? parseFloat(newLead.value) : undefined,
      daysInStage: 0,
    };
    const updated = {
      ...activePipeline,
      stages: activePipeline.stages.map((s) =>
        s.id === stageId ? { ...s, leads: [...s.leads, lead] } : s
      ),
      totalLeads: activePipeline.totalLeads + 1,
      totalValue: activePipeline.totalValue + (lead.value || 0),
    };
    setActivePipeline(updated);
    setPipelines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setNewLead({ name: "", contact: "", value: "" });
    setShowNewLead(null);
  };

  const onDragStart = (lead: Lead, fromStageId: string) => {
    setDraggingLead({ lead, fromStageId });
  };

  const onDrop = (toStageId: string) => {
    if (!draggingLead || !activePipeline || draggingLead.fromStageId === toStageId) {
      setDraggingLead(null);
      return;
    }
    const updated = {
      ...activePipeline,
      stages: activePipeline.stages.map((s) => {
        if (s.id === draggingLead.fromStageId) {
          return { ...s, leads: s.leads.filter((l) => l.id !== draggingLead.lead.id) };
        }
        if (s.id === toStageId) {
          return { ...s, leads: [...s.leads, draggingLead.lead] };
        }
        return s;
      }),
    };
    setActivePipeline(updated);
    setPipelines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setDraggingLead(null);
  };

  // ── Pipeline list view ──
  if (!activePipeline) {
    return (
      <div className="h-full bg-gray-50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Funis de Venda</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gerencie seus pipelines de vendas</p>
          </div>
          <button
            onClick={() => setShowNewPipeline(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Funil
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((pipeline) => (
            <button
              key={pipeline.id}
              onClick={() => setActivePipeline(pipeline)}
              className="bg-white rounded-2xl p-5 border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-brand-50 rounded-xl">
                  <Kanban className="w-5 h-5 text-brand-600" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 text-base mb-1">{pipeline.name}</h3>
              <p className="text-xs text-gray-400 mb-4">{pipeline.stages.length} etapas</p>

              <div className="flex gap-1 mb-4">
                {pipeline.stages.map((stage) => (
                  <div
                    key={stage.id}
                    className="h-1.5 flex-1 rounded-full opacity-70"
                    style={{ backgroundColor: stage.color }}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">Leads</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">{pipeline.totalLeads}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400">Potencial</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">
                    R$ {(pipeline.totalValue / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            </button>
          ))}

          {/* Add pipeline card */}
          <button
            onClick={() => setShowNewPipeline(true)}
            className="bg-white rounded-2xl p-5 border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all flex flex-col items-center justify-center gap-2 min-h-[200px] group"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition-colors" />
            </div>
            <span className="text-sm font-medium text-gray-400 group-hover:text-brand-600 transition-colors">Criar novo funil</span>
          </button>
        </div>

        {/* New pipeline modal */}
        {showNewPipeline && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Novo Funil</h2>
                <button onClick={() => setShowNewPipeline(false)} className="p-1.5 rounded-xl hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome do Funil *</label>
                <input
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createPipeline()}
                  placeholder="Ex: Vendas Varejo, Atacado Premium..."
                  autoFocus
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400 mt-2">Serão criadas 3 etapas padrão: Novo Lead, Em Andamento, Fechado</p>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewPipeline(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={createPipeline} className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
                  Criar Funil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Kanban view ──
  const totalValue = activePipeline.stages.reduce(
    (sum, s) => sum + s.leads.reduce((a, l) => a + (l.value || 0), 0),
    0
  );
  const totalLeads = activePipeline.stages.reduce((sum, s) => sum + s.leads.length, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Kanban header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setActivePipeline(null)} className="text-xs text-gray-400 hover:text-gray-700 shrink-0">Funis</button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <h1 className="text-sm font-bold text-gray-900 truncate">{activePipeline.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500"><Users className="w-3.5 h-3.5" />{totalLeads}</span>
            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500"><DollarSign className="w-3.5 h-3.5" />R$ {(totalValue / 1000).toFixed(1)}k</span>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
              <Plus className="w-3.5 h-3.5" />Novo Lead
            </button>
          </div>
        </div>
        {/* Scroll hint on mobile */}
        <p className="sm:hidden text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
          <span>←</span> Deslize para ver mais etapas <span>→</span>
        </p>
      </div>

      {/* Kanban board */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        <div className="flex gap-3 p-4 h-full" style={{ minWidth: `${activePipeline.stages.length * 240 + 32}px` }}>
          {activePipeline.stages.map((stage) => {
            const stageValue = stage.leads.reduce((a, l) => a + (l.value || 0), 0);
            return (
              <div
                key={stage.id}
                className="w-56 sm:w-64 shrink-0 flex flex-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(stage.id)}
              >
                {/* Stage header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-semibold text-gray-700">{stage.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                      {stage.leads.length}
                    </span>
                  </div>
                  <button className="p-1 rounded-lg hover:bg-gray-100">
                    <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
                {stageValue > 0 && (
                  <p className="text-xs text-gray-400 mb-2">
                    R$ {stageValue.toLocaleString("pt-BR")}
                  </p>
                )}

                {/* Leads */}
                <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                  {stage.leads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => onDragStart(lead, stage.id)}
                      className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 cursor-grab active:cursor-grabbing transition-all group"
                    >
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 font-bold text-xs flex items-center justify-center shrink-0">
                            {lead.name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 leading-tight">{lead.name}</span>
                        </div>
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
                      </div>
                      {lead.contact && (
                        <p className="text-xs text-gray-400 ml-8 mb-1.5">{lead.contact}</p>
                      )}
                      <div className="flex items-center justify-between ml-8">
                        {lead.value ? (
                          <span className="text-xs font-semibold text-green-600">
                            R$ {lead.value.toLocaleString("pt-BR")}
                          </span>
                        ) : <span />}
                        {lead.tag && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            {lead.tag}
                          </span>
                        )}
                      </div>
                      {lead.daysInStage > 0 && (
                        <p className="text-[10px] text-gray-300 ml-8 mt-1.5">
                          {lead.daysInStage}d nessa etapa
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Add lead button */}
                  {showNewLead === stage.id ? (
                    <div className="bg-white rounded-2xl p-3 border border-brand-200 shadow-sm">
                      <input
                        autoFocus
                        value={newLead.name}
                        onChange={(e) => setNewLead((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do lead *"
                        className="w-full text-sm border-b border-gray-200 pb-1.5 mb-2 focus:outline-none focus:border-brand-400"
                      />
                      <input
                        value={newLead.contact}
                        onChange={(e) => setNewLead((p) => ({ ...p, contact: e.target.value }))}
                        placeholder="Telefone ou e-mail"
                        className="w-full text-sm border-b border-gray-200 pb-1.5 mb-2 focus:outline-none focus:border-brand-400"
                      />
                      <input
                        value={newLead.value}
                        onChange={(e) => setNewLead((p) => ({ ...p, value: e.target.value }))}
                        placeholder="Valor (opcional)"
                        type="number"
                        className="w-full text-sm border-b border-gray-200 pb-1.5 mb-3 focus:outline-none focus:border-brand-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => addLead(stage.id)} className="flex-1 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700">
                          Adicionar
                        </button>
                        <button onClick={() => { setShowNewLead(null); setNewLead({ name: "", contact: "", value: "" }); }} className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewLead(stage.id)}
                      className="w-full py-2 text-xs font-medium text-gray-400 border border-dashed border-gray-200 rounded-2xl hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50 transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar lead
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
