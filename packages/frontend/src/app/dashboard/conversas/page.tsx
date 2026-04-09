"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, Send, Phone, MoreVertical, Tag, Clock, CheckCheck, Check,
  Smile, Paperclip, Star, Archive, MessageCircle, Instagram, Circle,
  ArrowLeft, X,
} from "lucide-react";

type Channel = "WHATSAPP" | "INSTAGRAM" | "WEBCHAT";
type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "ARCHIVED";

interface Contact {
  id: string; name: string; phone?: string; email?: string;
  tags?: string[]; segment?: string;
}
interface Message {
  id: string; content: string; direction: "INBOUND" | "OUTBOUND";
  type: string; createdAt: string; status?: "sent" | "delivered" | "read";
}
interface Conversation {
  id: string; channel: Channel; status: ConversationStatus;
  externalId: string; createdAt: string; updatedAt: string;
  contact: Contact; messages?: Message[];
  lastMessage?: string; unreadCount?: number; assigneeName?: string;
}

const channelIcon = (channel: Channel) => {
  switch (channel) {
    case "WHATSAPP": return <MessageCircle className="w-3.5 h-3.5 text-green-500" />;
    case "INSTAGRAM": return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
    default: return <Circle className="w-3.5 h-3.5 text-gray-400" />;
  }
};

const statusColor: Record<ConversationStatus, string> = {
  OPEN: "bg-green-500", PENDING: "bg-yellow-400",
  RESOLVED: "bg-gray-400", ARCHIVED: "bg-gray-300",
};

const tabs: { label: string; value: ConversationStatus | "ALL" }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Abertas", value: "OPEN" },
  { label: "Pendentes", value: "PENDING" },
  { label: "Resolvidas", value: "RESOLVED" },
];

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "1", channel: "WHATSAPP", status: "OPEN", externalId: "+5511999990001", createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 600000).toISOString(), contact: { id: "c1", name: "Ana Lima", phone: "+5511999990001", tags: ["VIP", "Loja SP"] }, lastMessage: "Oi! Quero saber sobre a nova coleção 🌸", unreadCount: 3, assigneeName: "Daniel" },
  { id: "2", channel: "WHATSAPP", status: "OPEN", externalId: "+5521988880002", createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 1800000).toISOString(), contact: { id: "c2", name: "Beatriz Souza", phone: "+5521988880002", tags: ["Prospect"] }, lastMessage: "Qual o prazo de entrega para o RJ?", unreadCount: 1, assigneeName: "Daniel" },
  { id: "3", channel: "INSTAGRAM", status: "PENDING", externalId: "@mari.moda", createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(), contact: { id: "c3", name: "Mariana Costa", tags: ["Influencer"] }, lastMessage: "Adorei o vestido da foto! Tem na cor azul?", unreadCount: 0 },
  { id: "4", channel: "WHATSAPP", status: "RESOLVED", externalId: "+5531977770003", createdAt: new Date(Date.now() - 172800000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), contact: { id: "c4", name: "Carla Mendes", phone: "+5531977770003" }, lastMessage: "Perfeito! Muito obrigada pelo atendimento 💜", unreadCount: 0 },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  "1": [
    { id: "m1", content: "Olá! Vi vocês no Instagram e adorei os looks!", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "m2", content: "Olá Ana! Que ótimo ter você por aqui 😊 Posso te ajudar?", direction: "OUTBOUND", type: "TEXT", createdAt: new Date(Date.now() - 7000000).toISOString(), status: "read" },
    { id: "m3", content: "Oi! Quero saber sobre a nova coleção 🌸", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 600000).toISOString() },
  ],
  "2": [
    { id: "m4", content: "Boa tarde! Gostaria de fazer um pedido", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "m5", content: "Boa tarde! Claro, como posso ajudar?", direction: "OUTBOUND", type: "TEXT", createdAt: new Date(Date.now() - 3500000).toISOString(), status: "delivered" },
    { id: "m6", content: "Qual o prazo de entrega para o RJ?", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 1800000).toISOString() },
  ],
  "3": [{ id: "m7", content: "Adorei o vestido da foto! Tem na cor azul?", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 3600000).toISOString() }],
  "4": [
    { id: "m8", content: "Meu pedido chegou! Tudo certinho.", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 90000000).toISOString() },
    { id: "m9", content: "Que ótimo! Fico feliz que tenha gostado 💜", direction: "OUTBOUND", type: "TEXT", createdAt: new Date(Date.now() - 89000000).toISOString(), status: "read" },
    { id: "m10", content: "Perfeito! Muito obrigada pelo atendimento 💜", direction: "INBOUND", type: "TEXT", createdAt: new Date(Date.now() - 86400000).toISOString() },
  ],
};

// mobile view: "list" | "chat" | "info"
type MobileView = "list" | "chat" | "info";

export default function ConversasPage() {
  const [activeTab, setActiveTab] = useState<ConversationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filtered = conversations.filter((c) => {
    const matchTab = activeTab === "ALL" || c.status === activeTab;
    const matchSearch = !search || c.contact.name.toLowerCase().includes(search.toLowerCase()) || (c.contact.phone || "").includes(search) || (c.lastMessage || "").toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const selectConversation = (conv: Conversation) => {
    setSelected(conv);
    setMobileView("chat");
    setMessages(MOCK_MESSAGES[conv.id] || []);
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !selected) return;
    const msg: Message = {
      id: `local-${Date.now()}`, content: newMessage.trim(),
      direction: "OUTBOUND", type: "TEXT",
      createdAt: new Date().toISOString(), status: "sent",
    };
    setMessages((prev) => [...prev, msg]);
    setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, lastMessage: msg.content, updatedAt: msg.createdAt } : c));
    setNewMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Conversation List ─────────────────────────────────────────────────────
  const ConvList = (
    <aside className="w-full lg:w-80 flex flex-col border-r border-gray-200 bg-white shrink-0 h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900 mb-3">Conversas</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa..." className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div className="flex border-b border-gray-100 px-2 pt-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} className={`px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-colors ${activeTab === tab.value ? "text-brand-600 border-b-2 border-brand-600" : "text-gray-400 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((conv) => (
          <button key={conv.id} onClick={() => selectConversation(conv)} className={`w-full flex items-start gap-3 px-4 py-3.5 text-left border-b border-gray-50 hover:bg-gray-50 transition-colors ${selected?.id === conv.id ? "bg-brand-50 border-l-2 border-l-brand-500" : ""}`}>
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center">{conv.contact.name.charAt(0)}</div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColor[conv.status]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-sm font-semibold text-gray-900 truncate">{conv.contact.name}</span>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(conv.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {channelIcon(conv.channel)}
                <p className="text-xs text-gray-500 truncate flex-1">{conv.lastMessage}</p>
                {(conv.unreadCount || 0) > 0 && (
                  <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">{conv.unreadCount}</span>
                )}
              </div>
              {conv.contact.tags && conv.contact.tags.length > 0 && (
                <div className="flex gap-1 mt-1.5">{conv.contact.tags.slice(0, 2).map((tag) => <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tag}</span>)}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );

  // ── Chat panel ────────────────────────────────────────────────────────────
  const ChatPanel = selected ? (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-50 h-full">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          {/* Back button — mobile only */}
          <button onClick={() => setMobileView("list")} className="lg:hidden p-1.5 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button onClick={() => setMobileView("info")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 font-bold text-sm flex items-center justify-center">{selected.contact.name.charAt(0)}</div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm leading-tight">{selected.contact.name}</p>
              <div className="flex items-center gap-1">
                {channelIcon(selected.channel)}
                <span className="text-xs text-gray-400">{selected.externalId}</span>
              </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${selected.status === "OPEN" ? "bg-green-100 text-green-700" : selected.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
            {selected.status === "OPEN" ? "Aberta" : selected.status === "PENDING" ? "Pendente" : "Resolvida"}
          </span>
          <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map((msg, i) => {
          const isOut = msg.direction === "OUTBOUND";
          const showDate = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="text-[11px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">{new Date(msg.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</span>
                </div>
              )}
              <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isOut ? "bg-brand-600 text-white rounded-br-md" : "bg-white text-gray-800 rounded-bl-md border border-gray-100"}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isOut ? "text-white/70" : "text-gray-400"}`}>
                    <span className="text-[10px]">{new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    {isOut && (msg.status === "read" ? <CheckCheck className="w-3 h-3 text-blue-300" /> : msg.status === "delivered" ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600"><Paperclip className="w-5 h-5" /></button>
          <button className="p-2 text-gray-400 hover:text-gray-600"><Smile className="w-5 h-5" /></button>
          <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Digite uma mensagem..." rows={1} className="flex-1 resize-none bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 max-h-28" style={{ minHeight: "42px" }} />
          <button onClick={sendMessage} disabled={!newMessage.trim()} className="p-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex-1 hidden lg:flex flex-col items-center justify-center bg-gray-50 text-gray-400">
      <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-sm font-medium">Selecione uma conversa</p>
      <p className="text-xs mt-1 opacity-70">Escolha uma conversa ao lado para começar</p>
    </div>
  );

  // ── Contact info panel ────────────────────────────────────────────────────
  const InfoPanel = selected ? (
    <aside className="w-full lg:w-72 flex flex-col bg-white h-full border-l border-gray-200 overflow-y-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 lg:hidden">
        <button onClick={() => setMobileView("chat")} className="p-1.5 -ml-1 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-gray-800 text-sm">Info do contato</span>
      </div>
      <div className="p-5 border-b border-gray-100 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 font-bold text-xl flex items-center justify-center mx-auto mb-3">{selected.contact.name.charAt(0)}</div>
        <h2 className="font-bold text-gray-900 text-sm">{selected.contact.name}</h2>
        {selected.contact.phone && <p className="text-xs text-gray-400 mt-0.5">{selected.contact.phone}</p>}
        <div className="flex items-center justify-center gap-2 mt-3">
          <button className="flex-1 py-1.5 text-xs font-semibold text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">Ver Perfil</button>
          <button className="flex-1 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Editar</button>
        </div>
      </div>
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {selected.contact.tags?.map((tag) => <span key={tag} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2 py-1 rounded-full font-medium">{tag}</span>)}
          <button className="text-xs text-gray-400 border border-dashed border-gray-300 px-2 py-1 rounded-full hover:border-brand-400 hover:text-brand-500">+ Add tag</button>
        </div>
      </div>
      <div className="p-4 border-b border-gray-100 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversa</p>
        <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Canal</span><div className="flex items-center gap-1">{channelIcon(selected.channel)}<span className="text-xs font-medium text-gray-700">{selected.channel}</span></div></div>
        <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Status</span><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selected.status === "OPEN" ? "bg-green-100 text-green-700" : selected.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>{selected.status === "OPEN" ? "Aberta" : selected.status === "PENDING" ? "Pendente" : "Resolvida"}</span></div>
        <div className="flex items-center justify-between"><span className="text-xs text-gray-400">Responsável</span><span className="text-xs font-medium text-gray-700">{selected.assigneeName || "—"}</span></div>
      </div>
      <div className="p-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Ações</p>
        <button className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-green-50 text-green-700 font-medium hover:bg-green-100 flex items-center gap-2"><CheckCheck className="w-4 h-4" />Marcar como resolvida</button>
        <button className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-yellow-50 text-yellow-700 font-medium hover:bg-yellow-100 flex items-center gap-2"><Clock className="w-4 h-4" />Marcar como pendente</button>
        <button className="w-full text-left text-sm px-3 py-2.5 rounded-xl bg-gray-50 text-gray-600 font-medium hover:bg-gray-100 flex items-center gap-2"><Archive className="w-4 h-4" />Arquivar conversa</button>
      </div>
    </aside>
  ) : null;

  // ── Layout: mobile single-column, desktop 3-column ────────────────────────
  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop: always show all 3 cols */}
      <div className="hidden lg:flex w-full h-full">
        {ConvList}
        {ChatPanel}
        {selected && InfoPanel}
      </div>

      {/* Mobile: one column at a time */}
      <div className="lg:hidden flex flex-col w-full h-full">
        {mobileView === "list" && ConvList}
        {mobileView === "chat" && ChatPanel}
        {mobileView === "info" && InfoPanel}
      </div>
    </div>
  );
}
