"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Settings, Users, MessageSquarePlus, Zap,
  Phone, MoreVertical, Send, Paperclip, Smile, Mic,
  X, ChevronRight, Star, RefreshCw, Volume2, ArrowLeft,
  EyeOff, Plus,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

type ConvTab = "all" | "unread" | "favorites" | "groups" | "pinned";
type MobileView = "list" | "chat" | "settings";

interface Conversation {
  id: string; contactName: string; contactPhone?: string;
  lastMessage?: string; lastMessageAt?: string; unreadCount: number;
  isGroup?: boolean; channel: string; status: string;
  contactId?: string; externalId?: string; profilePicUrl?: string;
}
interface Message {
  id: string; content: string; direction: "inbound" | "outbound";
  createdAt: string; messageType?: string; mediaUrl?: string;
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "agora";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Avatar({ name, size = 10 }: { name: string; size?: number }) {
  const colors = [
    "from-violet-500 to-purple-600", "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600", "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
  ];
  const c = colors[name.charCodeAt(0) % colors.length];
  const sz = size === 10 ? "w-10 h-10" : size === 14 ? "w-14 h-14" : `w-${size} h-${size}`;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${c} text-white font-bold flex items-center justify-center shrink-0 text-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ConvList({ conversations, loading, search, setSearch, tab, setTab, selected, onSelect, onOpenSettings }: {
  conversations: Conversation[]; loading: boolean;
  search: string; setSearch: (v: string) => void;
  tab: ConvTab; setTab: (t: ConvTab) => void;
  selected: Conversation | null;
  onSelect: (c: Conversation) => void;
  onOpenSettings: () => void;
}) {
  const unreadCount = conversations.filter(c => c.unreadCount > 0).length;
  const groupCount = conversations.filter(c => c.isGroup).length;

  const filtered = conversations.filter(c => {
    const matchSearch = c.contactName.toLowerCase().includes(search.toLowerCase());
    if (tab === "unread") return matchSearch && c.unreadCount > 0;
    if (tab === "groups") return matchSearch && !!c.isGroup;
    return matchSearch;
  });

  const tabs: { key: ConvTab; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: `Não lidas${unreadCount ? ` ${unreadCount}` : ""}` },
    { key: "favorites", label: "Favoritas" },
    { key: "groups", label: `Grupos${groupCount ? ` ${groupCount}` : ""}` },
    { key: "pinned", label: "Fixadas" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">WhatsApp</h1>
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><EyeOff className="w-4 h-4" /></button>
            <button className="p-1.5 rounded-lg text-emerald-400 hover:bg-muted/50 transition-colors"><Zap className="w-4 h-4" /></button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><Users className="w-4 h-4" /></button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><MessageSquarePlus className="w-4 h-4" /></button>
            <button onClick={onOpenSettings} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><Settings className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors shrink-0 ${tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading && <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
            <MessageSquarePlus className="w-10 h-10 opacity-20 mb-3" />
            <p className="text-sm font-medium">Nenhuma conversa</p>
            <p className="text-xs opacity-60 mt-1">As conversas aparecem ao receber mensagens</p>
          </div>
        )}
        {filtered.map(conv => (
          <button key={conv.id} onClick={() => onSelect(conv)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors border-b border-border/50 text-left ${selected?.id === conv.id ? "bg-muted/40" : ""}`}>
            <div className="relative shrink-0">
              {conv.profilePicUrl
                ? <img src={conv.profilePicUrl} alt={conv.contactName} className="w-10 h-10 rounded-full object-cover" />
                : <Avatar name={conv.contactName} size={10} />}
              {conv.status === "open" && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-sm font-semibold text-foreground truncate">{conv.contactName}</p>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{timeAgo(conv.lastMessageAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {conv.lastMessage?.startsWith("[imagem]") ? "📷 Imagem"
                    : conv.lastMessage?.startsWith("[áudio]") || conv.lastMessage?.startsWith("[audio]") ? "🎵 Áudio"
                    : conv.lastMessage?.startsWith("[sticker]") || conv.lastMessage?.startsWith("[figurinha]") ? "🎭 Figurinha"
                    : conv.lastMessage?.startsWith("[video]") ? "🎬 Vídeo"
                    : conv.lastMessage?.startsWith("[documento]") ? "📄 Documento"
                    : conv.lastMessage ?? (conv.isGroup ? "Grupo" : "Sem mensagens")}
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
  );
}

function ChatView({ conv, messages, loadingMsgs, text, setText, onSend, sending, onBack, isMobile }: {
  conv: Conversation; messages: Message[]; loadingMsgs: boolean;
  text: string; setText: (v: string) => void;
  onSend: () => void; sending: boolean;
  onBack: () => void; isMobile: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
        {isMobile && (
          <button onClick={onBack} className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative shrink-0">
          {conv.profilePicUrl
            ? <img src={conv.profilePicUrl} alt={conv.contactName} className="w-10 h-10 rounded-full object-cover" />
            : <Avatar name={conv.contactName} size={10} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{conv.contactName}</p>
          <p className="text-xs text-muted-foreground">{conv.isGroup ? "Grupo" : conv.contactPhone ?? conv.externalId ?? ""}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50"><Phone className="w-4 h-4" /></button>
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-3">
        {loadingMsgs && <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {!loadingMsgs && messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</p>}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.direction === "outbound" ? "bg-primary text-white rounded-br-sm" : "bg-muted/60 text-foreground rounded-bl-sm border border-border"}`}>
              {msg.messageType === "audio" && <div className="flex items-center gap-2 text-xs opacity-80 mb-1"><Volume2 className="w-3.5 h-3.5" /><span>Áudio</span></div>}
              {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
              <p className={`text-[10px] mt-1 text-right ${msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"}`}>
                {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-3 border-t border-border bg-background/80 shrink-0">
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Paperclip className="w-4 h-4" /></button>
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Smile className="w-4 h-4" /></button>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Digite uma mensagem..."
          className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
        {text.trim()
          ? <button onClick={onSend} disabled={sending} className="p-2.5 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50 shrink-0"><Send className="w-4 h-4" /></button>
          : <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Mic className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <p className="font-bold text-foreground text-sm">Configurações & Automações</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie automações de resposta</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 p-5 space-y-5 overflow-y-auto scrollbar-none">
        {[{ label: "Automações", Icon: Zap }, { label: "Respostas Rápidas", Icon: MessageSquarePlus }].map(({ label, Icon }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <button className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5">
                <Plus className="w-3 h-3" />Nova
              </button>
            </div>
            <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
              <Icon className="w-8 h-8 opacity-20" />
              <p className="text-xs font-medium">Nenhum{label === "Automações" ? "a automação" : "a resposta"} criada</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactPanel({ conv }: { conv: Conversation }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <div className="flex flex-col items-center gap-2 mb-3">
          {conv.profilePicUrl
            ? <img src={conv.profilePicUrl} alt={conv.contactName} className="w-14 h-14 rounded-full object-cover" />
            : <Avatar name={conv.contactName} size={14} />}
          <p className="font-bold text-foreground text-base text-center">{conv.contactName}</p>
          {conv.contactPhone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{conv.contactPhone}</p>}
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ações</p>
        {[{ label: "Ver contato", Icon: Users }, { label: "Adicionar ao funil", Icon: ChevronRight }, { label: "Favoritar", Icon: Star }].map(({ label, Icon }) => (
          <button key={label} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors text-left">
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>
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
  const [mobileView, setMobileView] = useState<MobileView>("list");

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations?limit=100`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? data ?? []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations/${convId}/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? data ?? []);
    } catch {
      // silencioso
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const selectConv = (conv: Conversation) => {
    setSelected(conv);
    setMessages([]);
    fetchMessages(conv.id);
    setMobileView("chat");
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
    } finally {
      setSending(false);
    }
  };

  const listProps = {
    conversations, loading, search, setSearch, tab, setTab,
    selected, onSelect: selectConv,
    onOpenSettings: () => setMobileView("settings"),
  };

  return (
    <>
      {/* ── Mobile ── */}
      <div className="lg:hidden h-full flex flex-col bg-background">
        {mobileView === "list" && <ConvList {...listProps} />}
        {mobileView === "chat" && selected && (
          <ChatView conv={selected} messages={messages} loadingMsgs={loadingMsgs}
            text={text} setText={setText} onSend={sendMessage} sending={sending}
            onBack={() => setMobileView("list")} isMobile />
        )}
        {mobileView === "settings" && <SettingsPanel onClose={() => setMobileView("list")} />}
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:flex h-full bg-background overflow-hidden">
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          <ConvList {...listProps} onOpenSettings={() => setShowSettings(s => !s)} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center">
                <MessageSquarePlus className="w-10 h-10 opacity-30" />
              </div>
              <p className="font-semibold text-foreground">Selecione uma conversa</p>
              <p className="text-sm opacity-60">Escolha uma conversa para começar</p>
            </div>
          ) : (
            <ChatView conv={selected} messages={messages} loadingMsgs={loadingMsgs}
              text={text} setText={setText} onSend={sendMessage} sending={sending}
              onBack={() => {}} isMobile={false} />
          )}
        </div>
        {selected && !showSettings && (
          <div className="w-64 shrink-0 border-l border-border bg-background/50">
            <ContactPanel conv={selected} />
          </div>
        )}
        {showSettings && (
          <div className="w-80 shrink-0 border-l border-border bg-background">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        )}
      </div>
    </>
  );
}
