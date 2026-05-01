"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, Settings, Users, MessageSquarePlus, Zap,
  Phone, MoreVertical, Send, Paperclip, Smile, Mic,
  X, ChevronRight, Star, Bell, BellOff, RefreshCw,
  Image as ImageIcon, FileText, Volume2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface Conversation {
  id: string; contactName: string; contactPhone?: string;
  lastMessage?: string; lastMessageAt?: string; unreadCount: number;
  isGroup?: boolean; channel: string; status: string;
  contactId?: string; externalId?: string;
}
interface Message {
  id: string; content: string; direction: "inbound" | "outbound";
  createdAt: string; messageType?: string; mediaUrl?: string;
}

type ConvTab = "all" | "unread" | "favorites" | "groups";

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff/60000)}min`;
  if (diff < 86400000) return d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
}

function Avatar({ name, size = 10 }: { name: string; size?: number }) {
  const colors = ["from-violet-500 to-purple-600","from-blue-500 to-cyan-600","from-emerald-500 to-teal-600","from-rose-500 to-pink-600","from-amber-500 to-orange-600"];
  const c = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${c} text-white font-bold flex items-center justify-center shrink-0 text-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ConvTab>("all");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations?limit=100`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? data ?? []);
    } finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations/${convId}/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? data ?? []);
    } finally { setLoadingMsgs(false); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectConv = (conv: Conversation) => {
    setSelected(conv);
    fetchMessages(conv.id);
  };

  const sendMessage = async () => {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    try {
      await fetch(`${API_URL}/api/v1/conversations/${selected.id}/messages`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ content: text.trim(), type: "text" }),
      });
      setText("");
      fetchMessages(selected.id);
    } finally { setSending(false); }
  };

  const filtered = conversations.filter(c => {
    const matchSearch = c.contactName.toLowerCase().includes(search.toLowerCase());
    if (tab === "unread") return matchSearch && c.unreadCount > 0;
    if (tab === "groups") return matchSearch && c.isGroup;
    if (tab === "favorites") return matchSearch;
    return matchSearch;
  });

  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;
  const groupCount = conversations.filter(c => c.isGroup).length;

  return (
    <div className="h-full flex bg-background overflow-hidden">

      {/* ── Coluna esquerda: lista de conversas ── */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-foreground">WhatsApp</h1>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors ${showSettings ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                title="Automações & Respostas">
                <Settings className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Monitor de Grupos">
                <Users className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Nova conversa">
                <MessageSquarePlus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-none">
            {([
              { key: "all", label: "Todas" },
              { key: "unread", label: `Não lidas${unreadCount ? ` ${unreadCount}` : ""}` },
              { key: "favorites", label: "Favoritas" },
              { key: "groups", label: `Grupos${groupCount ? ` ${groupCount}` : ""}` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
                  tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-4 text-center">
              <MessageSquarePlus className="w-10 h-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">Nenhuma conversa</p>
              <p className="text-xs opacity-60 mt-1">As conversas aparecem automaticamente ao receber mensagens</p>
            </div>
          )}
          {filtered.map(conv => (
            <button key={conv.id} onClick={() => selectConv(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors border-b border-border/50 text-left ${selected?.id === conv.id ? "bg-muted/40" : ""}`}>
              <Avatar name={conv.contactName} size={10} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-foreground truncate">{conv.contactName}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {conv.lastMessage ?? (conv.isGroup ? "Grupo" : "Sem mensagens")}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 ml-2">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Área central: chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center">
              <MessageSquarePlus className="w-10 h-10 opacity-30" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Selecione uma conversa</p>
              <p className="text-sm opacity-60 mt-1">Escolha uma conversa para começar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
              <div className="flex items-center gap-3">
                <Avatar name={selected.contactName} size={10} />
                <div>
                  <p className="font-semibold text-foreground">{selected.contactName}</p>
                  <p className="text-xs text-muted-foreground">{selected.isGroup ? "Grupo" : selected.contactPhone ?? selected.externalId}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><Phone className="w-4 h-4" /></button>
                <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-4 space-y-3">
              {loadingMsgs && (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="flex justify-center py-8 text-muted-foreground text-sm">Nenhuma mensagem ainda</div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                    msg.direction === "outbound"
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-muted/60 text-foreground rounded-bl-sm border border-border"
                  }`}>
                    {msg.messageType === "image" && msg.mediaUrl && (
                      <img src={msg.mediaUrl} alt="imagem" className="rounded-lg mb-2 max-w-full" />
                    )}
                    {msg.messageType === "audio" && (
                      <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
                        <Volume2 className="w-3.5 h-3.5" /><span>Áudio</span>
                      </div>
                    )}
                    {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                    <p className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"} text-right`}>
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de mensagem */}
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-background/80 backdrop-blur-xl shrink-0">
              <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><Paperclip className="w-4 h-4" /></button>
              <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><Smile className="w-4 h-4" /></button>
              <div className="flex-1 relative">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Digite uma mensagem..."
                  className="w-full px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              {text.trim() ? (
                <button onClick={sendMessage} disabled={sending}
                  className="p-2.5 rounded-xl bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><Mic className="w-4 h-4" /></button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Painel direito: detalhes / automações ── */}
      {selected && (
        <div className="w-72 shrink-0 border-l border-border flex flex-col bg-background/50">
          {/* Info do contato */}
          <div className="p-5 border-b border-border">
            <div className="flex flex-col items-center gap-2 mb-4">
              <Avatar name={selected.contactName} size={14} />
              <p className="font-bold text-foreground text-base text-center">{selected.contactName}</p>
              {selected.isGroup && <p className="text-xs text-muted-foreground">Grupo</p>}
            </div>
            {selected.contactPhone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />{selected.contactPhone}
              </div>
            )}
          </div>

          {/* Membros do grupo (se for grupo) */}
          {selected.isGroup && (
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Membros do Grupo</p>
              <p className="text-xs text-muted-foreground">Carregando membros...</p>
            </div>
          )}

          {/* Ações rápidas */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ações</p>
            <div className="space-y-2">
              {[
                { label: "Ver contato", icon: Users },
                { label: "Adicionar ao funil", icon: ChevronRight },
                { label: "Marcar como favorita", icon: Star },
              ].map(({ label, icon: Icon }) => (
                <button key={label}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors text-left">
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Painel Automações (drawer lateral) ── */}
      {showSettings && (
        <div className="w-80 shrink-0 border-l border-border flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-bold text-foreground text-sm">Configurações & Automações</p>
              <p className="text-xs text-muted-foreground mt-0.5">Gerencie automações de resposta do WhatsApp</p>
            </div>
            <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-none p-5 space-y-5">
            {/* Automações */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Automações</p>
                <button className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                  <Plus className="w-3 h-3" />Nova
                </button>
              </div>
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <Zap className="w-8 h-8 opacity-20" />
                <p className="text-xs font-medium">Nenhuma automação criada</p>
                <p className="text-[10px] opacity-60 text-center">Crie automações para responder automaticamente</p>
              </div>
            </div>
            {/* Respostas Rápidas */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Respostas Rápidas</p>
                <button className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                  <Plus className="w-3 h-3" />Nova
                </button>
              </div>
              <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
                <MessageSquarePlus className="w-8 h-8 opacity-20" />
                <p className="text-xs font-medium">Nenhuma resposta rápida</p>
                <p className="text-[10px] opacity-60 text-center">Crie mensagens para enviar com um clique</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
