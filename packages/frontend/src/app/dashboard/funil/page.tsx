"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, MoreVertical, ChevronRight, Kanban, DollarSign, Users, GripVertical, X, RefreshCw, Check, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

const COLORS = ["#6366F1", "#E8501F", "#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EF4444", "#EC4899", "#14B8A6"];

interface Contact { id: string; name: string; phone?: string; }
interface Lead { id: string; contactId: string; contact: Contact; value?: number; notes?: string; position: number; stageId: string; }
interface Stage { id: string; name: string; color: string; position: number; leads: Lead[]; }
interface Pipeline { id: string; name: string; stages: Stage[]; }

export default function FunilPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [showNewLead, setShowNewLead] = useState<string | null>(null);
  const [newLead, setNewLead] = useState({ name: "", phone: "", value: "" });
  const [draggingLead, setDraggingLead] = useState<{ lead: Lead; fromStageId: string } | null>(null);
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Stage editing
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [editingStageColor, setEditingStageColor] = useState("");
  const [stageMenuId, setStageMenuId] = useState<string | null>(null);
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(COLORS[0]);
  const stageMenuRef = useRef<HTMLDivElement>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/pipelines`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setPipelines(data);
      if (activePipeline) {
        const updated = data.find((p: Pipeline) => p.id === activePipeline.id);
        if (updated) setActivePipeline(updated);
      }
    } finally { setLoading(false); }
  }, [activePipeline?.id]);

  useEffect(() => { fetchPipelines(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (stageMenuRef.current && !stageMenuRef.current.contains(e.target as Node)) {
        setStageMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const createPipeline = async () => {
    if (!newPipelineName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pipelines`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: newPipelineName.trim() }),
      });
      const data = await res.json();
      setPipelines((prev) => [...prev, data]);
      setNewPipelineName("");
      setShowNewPipeline(false);
    } finally { setSaving(false); }
  };

  const addStage = async () => {
    if (!newStageName.trim() || !activePipeline || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pipelines/${activePipeline.id}/stages`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: newStageName.trim(), color: newStageColor }),
      });
      const stage = await res.json();
      const updated = { ...activePipeline, stages: [...activePipeline.stages, { ...stage, leads: [] }] };
      setActivePipeline(updated);
      setPipelines((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setNewStageName("");
      setNewStageColor(COLORS[0]);
      setShowAddStage(false);
    } finally { setSaving(false); }
  };

  const saveStageEdit = async (stageId: string) => {
    if (!editingStageName.trim() || !activePipeline) return;
    await fetch(`${API_URL}/api/v1/pipelines/stages/${stageId}`, {
      method: "PATCH", headers: authHeaders(),
      body: JSON.stringify({ name: editingStageName.trim(), color: editingStageColor }),
    });
    const updated = {
      ...activePipeline,
      stages: activePipeline.stages.map((s) =>
        s.id === stageId ? { ...s, name: editingStageName.trim(), color: editingStageColor } : s
      ),
    };
    setActivePipeline(updated);
    setPipelines((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditingStageId(null);
  };

  const deleteStage = async (stageId: string) => {
    if (!activePipeline) return;
    if (!confirm("Deletar esta etapa? Os leads serão removidos.")) return;
    await fetch(`${API_URL}/api/v1/pipelines/stages/${stageId}`, { method: "DELETE", headers: authHeaders() });
    const updated = { ...activePipeline, stages: activePipeline.stages.filter((s) => s.id !== stageId) };
    setActivePipeline(updated);
    setPipelines((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setStageMenuId(null);
  };

  const reorderStage = async (fromId: string, toId: string) => {
    if (!activePipeline || fromId === toId) return;
    const stages = [...activePipeline.stages];
    const fromIdx = stages.findIndex((s) => s.id === fromId);
    const toIdx = stages.findIndex((s) => s.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = stages.splice(fromIdx, 1);
    stages.splice(toIdx, 0, moved);
    const reordered = stages.map((s, i) => ({ ...s, position: i }));
    // Optimistic update
    setActivePipeline({ ...activePipeline, stages: reordered });
    setPipelines((prev) => prev.map((p) => p.id === activePipeline.id ? { ...p, stages: reordered } : p));
    // Persist all positions
    await Promise.all(
      reordered.map((s) =>
        fetch(`${API_URL}/api/v1/pipelines/stages/${s.id}`, {
          method: "PATCH", headers: authHeaders(),
          body: JSON.stringify({ position: s.position }),
        })
      )
    );
  };

  const addLead = async (stageId: string) => {
    if (!newLead.name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/pipelines/stages/${stageId}/leads`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ name: newLead.name.trim(), phone: newLead.phone || undefined, value: newLead.value ? parseFloat(newLead.value) : undefined }),
      });
      const lead = await res.json();
      setActivePipeline((prev) => prev ? { ...prev, stages: prev.stages.map((s) => s.id === stageId ? { ...s, leads: [...s.leads, lead] } : s) } : prev);
      setPipelines((prev) => prev.map((p) => p.id === activePipeline?.id ? { ...p, stages: p.stages.map((s) => s.id === stageId ? { ...s, leads: [...s.leads, lead] } : s) } : p));
      setNewLead({ name: "", phone: "", value: "" });
      setShowNewLead(null);
    } finally { setSaving(false); }
  };

  const moveLead = async (leadId: string, toStageId: string) => {
    await fetch(`${API_URL}/api/v1/pipelines/leads/${leadId}/move`, {
      method: "PATCH", headers: authHeaders(), body: JSON.stringify({ stageId: toStageId }),
    });
  };

  const onDragStart = (lead: Lead, fromStageId: string) => {
    setDraggingLead({ lead, fromStageId });
    setDraggingStageId(null);
  };

  const onDropLead = async (toStageId: string) => {
    if (!draggingLead || !activePipeline || draggingLead.fromStageId === toStageId) { setDraggingLead(null); return; }
    const updated = { ...activePipeline, stages: activePipeline.stages.map((s) => {
      if (s.id === draggingLead.fromStageId) return { ...s, leads: s.leads.filter((l) => l.id !== draggingLead.lead.id) };
      if (s.id === toStageId) return { ...s, leads: [...s.leads, { ...draggingLead.lead, stageId: toStageId }] };
      return s;
    })};
    setActivePipeline(updated);
    setPipelines((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setDraggingLead(null);
    await moveLead(draggingLead.lead.id, toStageId);
  };

  // ── Pipeline list ──
  if (!activePipeline) {
    return (
      <div className="h-full bg-gray-50 p-4 sm:p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Funis de Venda</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gerencie seus pipelines de vendas</p>
          </div>
          <button onClick={() => setShowNewPipeline(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
            <Plus className="w-4 h-4" />Novo Funil
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pipelines.map((pipeline) => {
              const totalLeads = pipeline.stages.reduce((s, st) => s + st.leads.length, 0);
              const totalValue = pipeline.stages.reduce((s, st) => s + st.leads.reduce((a, l) => a + (l.value || 0), 0), 0);
              return (
                <button key={pipeline.id} onClick={() => setActivePipeline(pipeline)}
                  className="bg-white rounded-2xl p-5 border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all text-left group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2.5 bg-brand-50 rounded-xl"><Kanban className="w-5 h-5 text-brand-600" /></div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base mb-1">{pipeline.name}</h3>
                  <p className="text-xs text-gray-400 mb-4">{pipeline.stages.length} etapas</p>
                  <div className="flex gap-1 mb-4">
                    {pipeline.stages.map((stage) => <div key={stage.id} className="h-1.5 flex-1 rounded-full opacity-70" style={{ backgroundColor: stage.color }} />)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Leads</span></div>
                      <span className="text-lg font-bold text-gray-800">{totalLeads}</span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3.5 h-3.5 text-gray-400" /><span className="text-xs text-gray-400">Potencial</span></div>
                      <span className="text-sm font-bold text-gray-800">R$ {(totalValue / 1000).toFixed(1)}k</span>
                    </div>
                  </div>
                </button>
              );
            })}
            <button onClick={() => setShowNewPipeline(true)}
              className="bg-white rounded-2xl p-5 border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-all flex flex-col items-center justify-center gap-2 min-h-[200px] group">
              <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition-colors" />
              </div>
              <span className="text-sm font-medium text-gray-400 group-hover:text-brand-600 transition-colors">Criar novo funil</span>
            </button>
          </div>
        )}

        {showNewPipeline && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Novo Funil</h2>
                <button onClick={() => setShowNewPipeline(false)} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
              </div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome do Funil *</label>
              <input value={newPipelineName} onChange={(e) => setNewPipelineName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createPipeline()}
                placeholder="Ex: Vendas Varejo, Atacado Premium..." autoFocus
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <p className="text-xs text-gray-400 mt-2">Serão criadas 3 etapas padrão: Novo Lead, Em Andamento, Fechado</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewPipeline(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancelar</button>
                <button onClick={createPipeline} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50">
                  {saving ? "Criando..." : "Criar Funil"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Kanban ──
  const totalValue = activePipeline.stages.reduce((sum, s) => sum + s.leads.reduce((a, l) => a + (l.value || 0), 0), 0);
  const totalLeads = activePipeline.stages.reduce((sum, s) => sum + s.leads.length, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50">
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
          </div>
        </div>
        <p className="sm:hidden text-[10px] text-gray-400 mt-1.5">← Deslize para ver mais etapas →</p>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        <div className="flex gap-3 p-4 h-full items-start" style={{ minWidth: `${(activePipeline.stages.length + 1) * 240 + 32}px` }}>
          {activePipeline.stages.map((stage) => {
            const stageValue = stage.leads.reduce((a, l) => a + (l.value || 0), 0);
            const isEditing = editingStageId === stage.id;
            const isDragOver = dragOverStageId === stage.id && draggingStageId && draggingStageId !== stage.id;
            return (
              <div
                key={stage.id}
                className={`w-56 sm:w-64 shrink-0 flex flex-col transition-all duration-150 ${isDragOver ? "ring-2 ring-brand-400 rounded-2xl opacity-80" : ""} ${draggingStageId === stage.id ? "opacity-40" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingStageId) setDragOverStageId(stage.id);
                }}
                onDragLeave={() => { if (draggingStageId) setDragOverStageId(null); }}
                onDrop={() => {
                  if (draggingStageId) {
                    reorderStage(draggingStageId, stage.id);
                    setDraggingStageId(null);
                    setDragOverStageId(null);
                  } else {
                    onDropLead(stage.id);
                  }
                }}
              >
                {/* Stage header */}
                <div
                  className={`flex items-center justify-between mb-3 gap-1 ${!isEditing ? "cursor-grab active:cursor-grabbing" : ""}`}
                  draggable={!isEditing}
                  onDragStart={() => { setDraggingStageId(stage.id); setDraggingLead(null); }}
                  onDragEnd={() => { setDraggingStageId(null); setDragOverStageId(null); }}
                >
                  {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <input autoFocus value={editingStageName} onChange={(e) => setEditingStageName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveStageEdit(stage.id); if (e.key === "Escape") setEditingStageId(null); }}
                        className="text-sm font-semibold border border-brand-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500 w-full" />
                      <div className="flex gap-1 flex-wrap">
                        {COLORS.map((c) => (
                          <button key={c} onClick={() => setEditingStageColor(c)}
                            className="w-5 h-5 rounded-full border-2 transition-all"
                            style={{ backgroundColor: c, borderColor: editingStageColor === c ? '#111' : 'transparent' }} />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => saveStageEdit(stage.id)} className="flex-1 py-1 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700">
                          <Check className="w-3 h-3 mx-auto" />
                        </button>
                        <button onClick={() => setEditingStageId(null)} className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                        <span className="text-sm font-semibold text-gray-700 truncate">{stage.name}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">{stage.leads.length}</span>
                      </div>
                      <div className="relative shrink-0" ref={stageMenuId === stage.id ? stageMenuRef : null}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setStageMenuId(stageMenuId === stage.id ? null : stage.id); }}
                          className="p-1 rounded-lg hover:bg-gray-100">
                          <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                        {stageMenuId === stage.id && (
                          <div className="absolute right-0 top-7 bg-white rounded-xl shadow-lg border border-gray-100 z-20 w-40 py-1">
                            <button onClick={() => { setEditingStageId(stage.id); setEditingStageName(stage.name); setEditingStageColor(stage.color); setStageMenuId(null); }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              Renomear etapa
                            </button>
                            <button onClick={() => deleteStage(stage.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                              Deletar etapa
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {stageValue > 0 && <p className="text-xs text-gray-400 mb-2">R$ {stageValue.toLocaleString("pt-BR")}</p>}

                <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                  {stage.leads.map((lead) => (
                    <div key={lead.id} draggable onDragStart={() => onDragStart(lead, stage.id)}
                      className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 cursor-grab active:cursor-grabbing transition-all">
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 font-bold text-xs flex items-center justify-center shrink-0">
                            {lead.contact.name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-800 leading-tight">{lead.contact.name}</span>
                        </div>
                        <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
                      </div>
                      {lead.contact.phone && <p className="text-xs text-gray-400 ml-8 mb-1.5">{lead.contact.phone}</p>}
                      {lead.value && <div className="ml-8"><span className="text-xs font-semibold text-green-600">R$ {lead.value.toLocaleString("pt-BR")}</span></div>}
                      {lead.notes && <p className="text-[10px] text-gray-400 ml-8 mt-1 truncate">{lead.notes}</p>}
                    </div>
                  ))}

                  {showNewLead === stage.id ? (
                    <div className="bg-white rounded-2xl p-3 border border-brand-200 shadow-sm">
                      <input autoFocus value={newLead.name} onChange={(e) => setNewLead((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do lead *"
                        className="w-full text-sm border-b border-gray-200 pb-1.5 mb-2 focus:outline-none focus:border-brand-400" />
                      <input value={newLead.phone} onChange={(e) => setNewLead((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="WhatsApp"
                        className="w-full text-sm border-b border-gray-200 pb-1.5 mb-2 focus:outline-none focus:border-brand-400" />
                      <input value={newLead.value} onChange={(e) => setNewLead((p) => ({ ...p, value: e.target.value }))}
                        placeholder="Valor (opcional)" type="number"
                        className="w-full text-sm border-b border-gray-200 pb-1.5 mb-3 focus:outline-none focus:border-brand-400" />
                      <div className="flex gap-2">
                        <button onClick={() => addLead(stage.id)} disabled={saving}
                          className="flex-1 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                          {saving ? "..." : "Adicionar"}
                        </button>
                        <button onClick={() => { setShowNewLead(null); setNewLead({ name: "", phone: "", value: "" }); }}
                          className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewLead(stage.id)}
                      className="w-full py-2 text-xs font-medium text-gray-400 border border-dashed border-gray-200 rounded-2xl hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50 transition-all flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" />Adicionar lead
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add stage column */}
          <div className="w-56 sm:w-64 shrink-0">
            {showAddStage ? (
              <div className="bg-white rounded-2xl p-4 border border-brand-200 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-3">Nova Etapa</p>
                <input autoFocus value={newStageName} onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStage()}
                  placeholder="Nome da etapa"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setNewStageColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: newStageColor === c ? '#111' : 'transparent' }} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={addStage} disabled={saving}
                    className="flex-1 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                    {saving ? "..." : "Criar"}
                  </button>
                  <button onClick={() => { setShowAddStage(false); setNewStageName(""); }}
                    className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddStage(true)}
                className="w-full py-3 text-xs font-medium text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50 transition-all flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />Nova etapa
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
