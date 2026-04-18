"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Phone, Mail, Instagram, Tag, Calendar, 
  DollarSign, MessageCircle, Edit, MoreVertical, 
  User, Clock, Globe, Filter, Briefcase
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
}

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

interface Contact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  instagramHandle?: string | null;
  tags?: string[];
  notes?: string | null;
  segment?: string;
  createdAt: string;
  updatedAt: string;
  pipelineLeads?: any[];
}

export default function ContactProfilePage() {
  const { id } = useParams();
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContact = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/contacts/${id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Não foi possível carregar os dados do contato.");
      const data = await res.json();
      setContact(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchContact();
  }, [id, fetchContact]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500">
        <User className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contato não encontrado</h2>
        <p className="max-w-xs text-center text-sm mb-6">{error || "O perfil solicitado não está disponível ou foi removido."}</p>
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para contatos
        </button>
      </div>
    );
  }

  // Parse fields from notes if they follow our [Formulário] pattern
  const parseFields = () => {
    const fields: any = {};
    if (contact.notes) {
      const notes = contact.notes;
      if (notes.includes("Investimento atual:")) fields.investimento = notes.split("Investimento atual:")[1].split("\n")[0].trim();
      if (notes.includes("Faturamento:")) fields.faturamento = notes.split("Faturamento:")[1].split("\n")[0].trim();
      if (notes.includes("Atendimento de leads:")) fields.atendimento = notes.split("Atendimento de leads:")[1].split("\n")[0].trim();
      if (notes.includes("Interesse:")) fields.interesse = notes.split("Interesse:")[1].split("\n")[0].trim();
    }
    return fields;
  };

  const aditionalFields = parseFields();

  return (
    <div className="h-full flex flex-col bg-[#F9FAFB]">
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 border border-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{contact.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <User size={12} /> Perfil do Contato
                </span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest bg-brand-50 px-2 py-0.5 rounded-full">
                  {contact.segment || "NEW"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => router.push(`/dashboard/conversas?phone=${encodeURIComponent(contact.phone || "")}&name=${encodeURIComponent(contact.name || "")}`)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition-all shadow-md shadow-brand-100"
            >
              <MessageCircle className="w-4 h-4" />
              Abrir Chat
            </button>
            <button className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coluna Esquerda: Dados Básicos e Perfil */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card: Dados do Perfil */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                <User size={120} />
              </div>
              
              <div className="flex items-start gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <Briefcase size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Perfil do Negócio</h2>
                  <p className="text-sm text-gray-400">Informações coletadas durante o cadastro</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-green-600">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Faturamento Mensal</p>
                      <p className="text-sm font-semibold text-gray-800">{aditionalFields.faturamento || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-purple-600">
                      <Tag size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Modelo de Venda</p>
                      <p className="text-sm font-semibold text-gray-800">Instagram/WhatsApp</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-600">
                      <Filter size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Investimento Atual</p>
                      <p className="text-sm font-semibold text-gray-800">{aditionalFields.investimento || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md hover:scale-[1.02]">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-orange-600">
                      <ArrowLeft size={20} className="rotate-180" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Interesse</p>
                      <p className="text-sm font-semibold text-gray-800">{aditionalFields.interesse || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card: Notas e Observações */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Filter size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Notas e Observações</h2>
                </div>
                <button className="text-sm text-brand-600 font-bold hover:underline flex items-center gap-1">
                  <Edit size={14} /> Editar
                </button>
              </div>
              <div className="bg-amber-50/30 rounded-2xl p-6 border border-amber-100/50">
                <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                  {contact.notes || "Nenhuma nota adicionada a este contato."}
                </p>
              </div>
            </div>

          </div>

          {/* Coluna Direita: Contato e Timeline */}
          <div className="space-y-6">
            
            {/* Contato Rápido */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Informações de Contato</h3>
              
              <div className="space-y-4">
                <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none mb-1">WhatsApp</p>
                      <p className="text-sm font-semibold text-gray-800">{contact.phone || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none mb-1">E-mail</p>
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-[140px]">{contact.email || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="group flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
                      <Instagram size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-none mb-1">Instagram</p>
                      <p className="text-sm font-semibold text-gray-800">{contact.instagramHandle ? `@${contact.instagramHandle.replace('@', '')}` : "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline do Lead */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Histórico do CRM</h3>
              
              <div className="space-y-6">
                <div className="relative pl-6 border-l-2 border-gray-100 pb-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-brand-500 shadow-sm" />
                  <p className="text-xs font-bold text-gray-800">Primeiro Cadastro</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar size={10} /> {new Date(contact.createdAt).toLocaleDateString("pt-BR")} às {new Date(contact.createdAt).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="relative pl-6 border-l-2 border-gray-100 pb-1">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-200 shadow-sm" />
                  <p className="text-xs font-bold text-gray-600">Última Atualização</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={10} /> {new Date(contact.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-1">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {contact.tags && contact.tags.length > 0 ? (
                  contact.tags.map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-600 text-[11px] font-bold rounded-xl whitespace-nowrap">
                      {tag}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-gray-300 px-1 italic">Nenhuma tag</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
