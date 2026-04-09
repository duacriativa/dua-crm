"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  Phone,
  Mail,
  Tag,
  MoreVertical,
  ChevronDown,
  User,
  Star,
  Trash2,
  Edit,
  MessageCircle,
  SlidersHorizontal,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Segment = "ALL" | "NEW" | "ACTIVE" | "VIP" | "AT_RISK" | "DORMANT";

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  segment?: string;
  tags?: string[];
  createdAt: string;
  lastContact?: string;
  pipelineStage?: string;
  saleValue?: number;
}

const SEGMENT_LABELS: Record<string, string> = {
  NEW: "Novo",
  ACTIVE: "Ativo",
  VIP: "VIP",
  AT_RISK: "Em Risco",
  DORMANT: "Inativo",
};

const SEGMENT_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  VIP: "bg-purple-100 text-purple-700",
  AT_RISK: "bg-red-100 text-red-700",
  DORMANT: "bg-gray-100 text-gray-500",
};

const MOCK_CONTACTS: Contact[] = [
  { id: "1", name: "Ana Lima", phone: "+55 11 99999-0001", email: "ana@email.com", segment: "VIP", tags: ["Varejo", "SP"], createdAt: "2024-01-10", lastContact: "2024-04-08", pipelineStage: "Proposta", saleValue: 1200 },
  { id: "2", name: "Beatriz Souza", phone: "+55 21 98888-0002", email: "bea@email.com", segment: "ACTIVE", tags: ["Atacado"], createdAt: "2024-02-15", lastContact: "2024-04-07", pipelineStage: "Qualificado", saleValue: 850 },
  { id: "3", name: "Carla Mendes", phone: "+55 31 97777-0003", segment: "NEW", tags: ["Instagram"], createdAt: "2024-04-01", lastContact: "2024-04-06", pipelineStage: "Novo lead" },
  { id: "4", name: "Daniela Rocha", phone: "+55 11 96666-0004", email: "dani@email.com", segment: "DORMANT", tags: ["WhatsApp", "SP"], createdAt: "2023-11-20", lastContact: "2024-01-05", pipelineStage: "Perdido" },
  { id: "5", name: "Fernanda Costa", phone: "+55 85 95555-0005", segment: "AT_RISK", tags: ["Varejo"], createdAt: "2024-03-05", lastContact: "2024-03-20", pipelineStage: "Negociação", saleValue: 2500 },
  { id: "6", name: "Gabriela Alves", email: "gabi@email.com", segment: "VIP", tags: ["VIP", "Loja BH"], createdAt: "2023-08-01", lastContact: "2024-04-09", pipelineStage: "Fechado", saleValue: 5800 },
  { id: "7", name: "Helena Martins", phone: "+55 47 94444-0007", segment: "ACTIVE", tags: ["Atacado", "SC"], createdAt: "2024-01-22", lastContact: "2024-04-05", pipelineStage: "Proposta", saleValue: 1750 },
  { id: "8", name: "Isabela Ferreira", phone: "+55 11 93333-0008", email: "isa@email.com", segment: "NEW", tags: ["Instagram"], createdAt: "2024-04-08", lastContact: "2024-04-08", pipelineStage: "Novo lead" },
];

const segmentTabs: { label: string; value: Segment }[] = [
  { label: "Todos", value: "ALL" },
  { label: "Novos", value: "NEW" },
  { label: "Ativos", value: "ACTIVE" },
  { label: "VIP", value: "VIP" },
  { label: "Em Risco", value: "AT_RISK" },
  { label: "Inativos", value: "DORMANT" },
];

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState<Segment>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNewModal, setShowNewModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });

  const filtered = contacts.filter((c) => {
    const matchSeg = activeSegment === "ALL" || c.segment === activeSegment;
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase());
    return matchSeg && matchSearch;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const addContact = () => {
    if (!newContact.name.trim()) return;
    const c: Contact = {
      id: `local-${Date.now()}`,
      ...newContact,
      segment: "NEW",
      tags: [],
      createdAt: new Date().toISOString(),
    };
    setContacts((prev) => [c, ...prev]);
    setNewContact({ name: "", phone: "", email: "" });
    setShowNewModal(false);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contatos</h1>
            <p className="text-sm text-gray-400 mt-0.5">{contacts.length} contatos cadastrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Upload className="w-4 h-4" />
              Importar
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Contato
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </button>
        </div>

        {/* Segment tabs */}
        <div className="flex gap-1 mt-3">
          {segmentTabs.map((tab) => {
            const count = tab.value === "ALL" ? contacts.length : contacts.filter((c) => c.segment === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveSegment(tab.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeSegment === tab.value
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-[10px] ${activeSegment === tab.value ? "text-white/70" : "text-gray-400"}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-brand-50 border-b border-brand-100 px-6 py-2.5 flex items-center gap-3">
          <span className="text-sm font-medium text-brand-700">{selected.size} selecionado(s)</span>
          <button className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            Iniciar conversa
          </button>
          <button className="text-xs px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Adicionar tag
          </button>
          <button className="text-xs px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
            Cancelar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contato</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Segmento</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Etapa do Funil</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Último contato</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((contact) => (
              <tr key={contact.id} className="bg-white hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(contact.id)}
                    onChange={() => toggleSelect(contact.id)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{contact.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {contact.phone && (
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span className="text-xs">{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="text-xs">{contact.email}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {contact.segment && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${SEGMENT_COLORS[contact.segment] || "bg-gray-100 text-gray-500"}`}>
                      {SEGMENT_LABELS[contact.segment] || contact.segment}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {contact.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-600">{contact.pipelineStage || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-gray-700">
                    {contact.saleValue
                      ? `R$ ${contact.saleValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-400">
                    {contact.lastContact
                      ? new Date(contact.lastContact).toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <User className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
            <p className="text-xs mt-1 opacity-70">Tente outro filtro ou adicione um novo contato</p>
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Novo Contato</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nome *</label>
                <input
                  value={newContact.name}
                  onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Ana Lima"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">WhatsApp</label>
                <input
                  value={newContact.phone}
                  onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+55 11 99999-9999"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">E-mail</label>
                <input
                  value={newContact.email}
                  onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                  placeholder="ana@email.com"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={addContact}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
