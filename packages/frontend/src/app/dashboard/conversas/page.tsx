"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Send, Phone, MoreVertical, Clock, CheckCheck, Check,
  Smile, Paperclip, Archive, MessageCircle, Instagram, Circle,
  ArrowLeft, RefreshCw,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Channel = "WHATSAPP" | "INSTAGRAM" | "WEBCHAT";
type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "ARCHIVED";
type MobileView = "list" | "chat" | "info";

interface Contact {
  id: string; name: string; phone?: string; email?: string;
  tags?: string[]; segment?: string;
}
interface Message {
  id: string; content: string; direction: "INBOUND" | "OUTBOUND";
  type: string; sentAt: string;
  deliveredAt?: string | null; readAt?: string | null;
}
interface Conversation {
  id: string; channel: Channel; status: ConversationStatus;
  externalId: string; createdAt: string; updatedAt: string;
  contact: Contact; lastMessage?: string; unreadCount?: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
}
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}
function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function channelIcon(channel: Channel) {
  if (channel === "WHATSAPP") return <MessageCircle className="w-3.5 h-3.5 text-green-500" />;
  if (channel === "INSTAGRAM") return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
  return <Circle className="w-3.5 h-3.5 text-gray-400" />;
}
const statusDot: Record<ConversationStatus, string> = {
  OPEN: "bg-green-500", PENDING: "bg-yellow-400",
  RESOLVED: "bg-gray-400", ARCHIVED: "bg-gray-300",
};
const tabs: { label: string; value: string }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Abertas", value: "OPEN" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Resolvidas", value: "RESOLVED" },
];

export default function ConversasPage() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedRef = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  // ── Busca lista de conversas ──────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab !== "ALL") params.set("status", activeTab);
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await fetch(`${API_URL}/api/v1/conversations?${params}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // silently fail — backend pode estar subindo
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    setLoading(true);
    fetchConversations();
  }, [fetchConversations]);

  // ── Polling de conversas a cada 5s ───────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // ── Busca mensagens da conversa selecionada ───────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations/${convId}/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const selectConversation = (conv: Conversation) => {
    setSelected(conv);
    setMobileView("chat");
    fetchMessages(conv.id);
    // Zero unread localmente
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
  };

  // ── Polling de mensagens a cada 3s quando conversa aberta ────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => {
      if (selectedRef.current) fetchMessages(selectedRef.current.id);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchMessages]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Enviar mensagem ───────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMessage.trim() || !selected || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");

    // Otimista
    const optimistic: Message = {
      id: `opt-${Date.now()}`, content, direction: "OUTBOUND",
      type: "TEXT", sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await fetch(`${API_URL}/api/v1/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content }),
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    await fetch(`${API_URL}/api/v1/conversations/${selected.id}/status`, {
      method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }),
    });
    setSelected((prev) => prev ? { ...prev, status: status as ConversationStatus } : prev);
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, status: status as ConversationStatus } : c));
  };

  // ── Conversation List ─────────────────────────────────────────────────────
  const ConvList = (
    <aside className="w-full lg:w-80 flex flex-col border-r border-gray-200 bg-white shrink-0 h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Conversas</h1>
          <button onClick={fetchConversations} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa..." className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      <div className="flex border-b border-gray-100 px-2 pt-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-colors ${activeTab === tab.value ? "text-brand-600 border-b-2 border-brand-600" : "text-gray-400 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 opacity-40" />
            <p className="text-xs">Carregando...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma conversa</p>
            <p className="text-xs mt-1 opacity-60">As mensagens do WhatsApp aparecerão aqui</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button key={conv.id} onClick={() => selectConversation(conv)} className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === conv.id ? "bg-brand-50 border-l-2 border-l-brand-500" : ""}`}>
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center">{conv.contact.name.charAt(0).toUpperCase()}</div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusDot[conv.status]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">{conv.contact.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(conv.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {channelIcon(conv.channel)}
                  <p className="text-xs text-gray-500 truncate flex-1">{conv.lastMessage ?? "Sem mensagens"}</p>
                  {(conv.unreadCount || 0) > 0 && (
                    <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">{conv.unreadCount}</span>
                  )}
                </div>
                {(conv.contact.tags?.length ?? 0) > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {conv.contact.tags!.slice(0, 2).map((tag) => <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tag}</span>)}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );

  // ── Chat Panel ────────────────────────────────────────────────────────────
  const ChatPanel = selected ? (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-50 h-full">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileView("list")} className="lg:hidden p-1.5 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setMobileView("info")} className="flex items-center gap-2 hover:opacity-80">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center">{selected.contact.name.charAt(0)}</div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm leading-tight">{selected.contact.name}</p>
              <div className="flex items-center gap-1">
                {channelIcon(selected.channel)}
                <span className="text-xs text-gray-400">{selected.contact.phone ?? selected.externalId}</span>
              </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Status rápido */}
          {selected.status === "OPEN" && (
            <button onClick={() => updateStatus("RESOLVED")} className="text-xs px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 font-medium hover:bg-green-100 hidden sm:flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5" />Resolver
            </button>
          )}
          {selected.status === "RESOLVED" && (
            <button onClick={() => updateStatus("OPEN")} className="text-xs px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 hidden sm:flex items-center gap-1">
              Reabrir
            </button>
          )}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${selected.status === "OPEN" ? "bg-green-100 text-green-700" : selected.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
            {selected.status === "OPEN" ? "Aberta" : selected.status === "PENDING" ? "Pendente" : "Resolvida"}
          </span>
          <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loadingMsgs && messages.length === 0 ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOut = msg.direction === "OUTBOUND";
            const showDate = i === 0 || new Date(messages[i - 1].sentAt).toDateString() !== new Date(msg.sentAt).toDateString();
            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">
                      {new Date(msg.sentAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                    </span>
                  </div>
                )}
                <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isOut ? "bg-brand-600 text-white rounded-br-md" : "bg-white text-gray-800 rounded-bl-md border border-gray-100"}`}>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? "text-white/70" : "text-gray-400"}`}>
                      <span className="text-[10px]">{new Date(msg.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      {isOut && (msg.readAt ? <CheckCheck className="w-3 h-3 text-blue-300" /> : msg.deliveredAt ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600"><Paperclip className="w-5 h-5" /></button>
          <button className="p-2 text-gray-400 hover:text-gray-600"><Smile className="w-5 h-5" /></button>
          <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite uma mensagem..." rows={1} className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 max-h-28" style={{ minHeight: "42px" }} />
          <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="p-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-gray-50 text-gray-400">
      <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm font-medium">Selecione uma conversa</p>
      <p className="text-xs mt-1 opacity-70">Mensagens do WhatsApp aparecem aqui automaticamente</p>
    </div>
  );

  // ── Info Panel ────────────────────────────────────────────────────────────
  const InfoPanel = selected ? (
    <aside className="w-full lg:w-64 flex flex-col bg-white h-full border-l border-gray-200 overflow-y-auto shrink-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 lg:hidden">
        <button onClick={() => setMobileView("chat")} className="p-1.5 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
        <span className="font-semibold text-gray-800 text-sm">Info do contato</span>
      </div>
      <div className="p-4 border-b border-gray-100 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 font-bold text-lg flex items-center justify-center mx-auto mb-2">{selected.contact.name.charAt(0)}</div>
        <h2 className="font-bold text-gray-900 text-sm">{selected.contact.name}</h2>
        {selected.contact.phone && <p className="text-xs text-gray-400 mt-0.5">{selected.contact.phone}</p>}
        <div className="flex gap-2 mt-3">
          <button className="flex-1 py-1.5 text-xs font-semibold text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">Ver Perfil</button>
          <button className="flex-1 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Editar</button>
        </div>
      </div>
      {(selected.contact.tags?.length ?? 0) > 0 && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.contact.tags!.map((tag) => <span key={tag} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2 py-1 rounded-full">{tag}</span>)}
          </div>
        </div>
      )}
      <div className="p-4 border-b border-gray-100 space-y-2.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversa</p>
        <div className="flex justify-between"><span className="text-xs text-gray-400">Canal</span><div className="flex items-center gap-1">{channelIcon(selected.channel)}<span className="text-xs font-medium text-gray-700">{selected.channel}</span></div></div>
        <div className="flex justify-between"><span className="text-xs text-gray-400">Iniciada</span><span className="text-xs font-medium text-gray-700">{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</span></div>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ações</p>
        <button onClick={() => updateStatus("RESOLVED")} className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-green-50 text-green-700 font-medium hover:bg-green-100 flex items-center gap-2"><CheckCheck className="w-4 h-4" />Resolver</button>
        <button onClick={() => updateStatus("PENDING")} className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-yellow-50 text-yellow-700 font-medium hover:bg-yellow-100 flex items-center gap-2"><Clock className="w-4 h-4" />Pendente</button>
        <button onClick={() => updateStatus("ARCHIVED")} className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 flex items-center gap-2"><Archive className="w-4 h-4" />Arquivar</button>
      </div>
    </aside>
  ) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop: 3 colunas */}
      <div className="hidden lg:flex w-full h-full">
        {ConvList}
        {ChatPanel}
        {selected && InfoPanel}
      </div>
      {/* Mobile: 1 coluna por vez */}
      <div className="lg:hidden flex flex-col w-full h-full">
        {mobileView === "list" && ConvList}
        {mobileView === "chat" && ChatPanel}
        {mobileView === "info" && InfoPanel}
      </div>
    </div>
  );
}
