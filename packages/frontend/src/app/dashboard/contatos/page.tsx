"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Download, Upload, Phone, Mail,
  MoreVertical, User, Edit, MessageCircle, SlidersHorizontal, X, RefreshCw,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

type Segment = "ALL" | "NEW" | "ACTIVE" | "VIP" | "AT_RISK" | "DORMANT";

interface Contact {
  id: string; name: string; phone?: string; email?: string;
  segment?: string; tags?: string[]; createdAt: string;
  lastContact?: string; pipelineStage?: string; saleValue?: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  NEW: "Novo", ACTIVE: "Ativo", VIP: "VIP", AT_RISK: "Em Risco", DORMANT: "Inativo",
};
const SEGMENT_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700", ACTIVE: "bg-green-100 text-green-700",
  VIP: "bg-purple-100 text-purple-700", AT_RISK: "bg-red-100 text-red-700",
  DORMANT: "bg-gray-100 text-gray-500",
};


const segmentTabs: { label: string; value: Segment }[] = [
  { label: "Todos", value: "ALL" },
  { label: "Novos", value: "NEW" },
  { label: "Ativos", value: "ACTIVE" },
  { label: "VIP", value: "VIP" },
  { label: "Em Risco", value: "AT_RISK" },
  { label: "Inativos", value: "DORMANT" },
];

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<Segment>("ALL");
  const [showNewModal, setShowNewModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (activeSegment !== "ALL") params.set("segment", activeSegment);
      if (search) params.set("search", search);
      const res = await fetch(`${API_URL}/api/v1/contacts?${params}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [activeSegment, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = contacts; // já filtrado pelo backend

  const addContact = async () => {
    if (!newContact.name.trim()) return;
    await fetch(`${API_URL}/api/v1/contacts`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify(newContact),
    });
    setNewContact({ name: "", phone: "", email: "" });
    setShowNewModal(false);
    fetchContacts();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        {/* Title + actions */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Contatos</h1>
            <p className="text-xs text-gray-400">{loading ? "Carregando..." : `${total} contatos cadastrados`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
              <Upload className="w-4 h-4" /><span>Importar</span>
            </button>
            <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
              <Download className="w-4 h-4" /><span>Exportar</span>
            </button>
            <button onClick={() => setShowNewModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
              <Plus className="w-4 h-4" />
              <span>Novo Contato</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone..." className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>

        {/* Segment tabs — horizontal scroll on mobile */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {segmentTabs.map((tab) => {
            const count = tab.value === "ALL" ? contacts.length : contacts.filter((c) => c.segment === tab.value).length;
            return (
              <button key={tab.value} onClick={() => setActiveSegment(tab.value)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${activeSegment === tab.value ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100"}`}>
                {tab.label}
                <span className={`ml-1 text-[10px] ${activeSegment === tab.value ? "text-white/70" : "text-gray-400"}`}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {/* Mobile: card list */}
        <div className="block sm:hidden divide-y divide-gray-100 bg-white">
          {filtered.map((contact) => (
            <div key={contact.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center shrink-0">
                {contact.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{contact.name}</p>
                  {contact.segment && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${SEGMENT_COLORS[contact.segment] || ""}`}>
                      {SEGMENT_LABELS[contact.segment]}
                    </span>
                  )}
                </div>
                {contact.phone && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3" />{contact.phone}
                  </p>
                )}
                {contact.pipelineStage && (
                  <p className="text-xs text-gray-400">{contact.pipelineStage}{contact.saleValue ? ` · R$ ${contact.saleValue.toLocaleString("pt-BR")}` : ""}</p>
                )}
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Desktop: full table */}
        <table className="hidden sm:table w-full text-sm">
          <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contato</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Segmento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Etapa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Valor</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((contact) => (
              <tr key={contact.id} className="bg-white hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center shrink-0">{contact.name.charAt(0)}</div>
                    <span className="font-medium text-gray-900">{contact.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {contact.phone && <div className="flex items-center gap-1.5 text-gray-500"><Phone className="w-3 h-3 shrink-0" /><span className="text-xs">{contact.phone}</span></div>}
                    {contact.email && <div className="flex items-center gap-1.5 text-gray-500"><Mail className="w-3 h-3 shrink-0" /><span className="text-xs">{contact.email}</span></div>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {contact.segment && <span className={`text-xs font-medium px-2 py-1 rounded-full ${SEGMENT_COLORS[contact.segment] || ""}`}>{SEGMENT_LABELS[contact.segment]}</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags?.map((tag) => <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tag}</span>)}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell"><span className="text-sm text-gray-600">{contact.pipelineStage || "—"}</span></td>
                <td className="px-4 py-3 hidden lg:table-cell"><span className="text-sm font-medium text-gray-700">{contact.saleValue ? `R$ ${contact.saleValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><MessageCircle className="w-4 h-4" /></button>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><Edit className="w-4 h-4" /></button>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 opacity-40" />
            <p className="text-sm">Carregando...</p>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <User className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs mt-1 opacity-70">Os contatos do WhatsApp aparecem automaticamente ao receber mensagens</p>
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Novo Contato</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome *</label>
                <input value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Ana Lima" autoFocus className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">WhatsApp</label>
                <input value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} placeholder="+55 11 99999-9999" className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">E-mail</label>
                <input value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} placeholder="ana@email.com" className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewModal(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button onClick={addContact} className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
