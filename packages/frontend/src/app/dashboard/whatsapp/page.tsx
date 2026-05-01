"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Plus, Settings, Users, MessageSquarePlus, Zap,
  Phone, MoreVertical, Send, Paperclip, Smile, Mic,
  X, ChevronRight, Star, RefreshCw, Volume2, ArrowLeft, EyeOff,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

interface Conversation {
  id: string; contactName: string; contactPhone?: string;
  lastMessage?: string; lastMessageAt?: string; unreadCount: number;
  isGroup?: boolean; channel: string; status: string;
  contactId?: string; externalId?: string;
  profilePicUrl?: string;
}
interface Message {
  id: string; content: string; direction: "inbound" | "outbound";
  createdAt: string; messageType?: string; mediaUrl?: string;
}

type ConvTab = "all" | "unread" | "favorites" | "groups" | "pinned";
type MobileView = "list" | "chat" | "settings";

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
  const colors = ["from-violet-500 to-purple-600", "from-blue-500 to-cyan-600", "from-emerald-500 to-teal-600", "from-rose-500 to-pink-600", "from-amber-500 to-orange-600"];
  const c = colors[name.charCodeAt(0) % colors.length];
  const sz = `w-${size} h-${size}`;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${c} text-white font-bold flex items-center justify-center shrink-0 text-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/* ── Lista de conversas ── */
function ConvList({
  conversations, loading, search, setSearch, tab, setTab,
  selected, onSelect, onOpenSettings,
}: {
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
    if (tab === "groups") return matchSearch && c.isGroup;
    if (tab === "favorites") return matchSearch;
    if (tab === "pinned") return matchSearch;
    return matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">WhatsApp</h1>
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Ocultar lidas">
              <EyeOff className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Automações">
              <Zap className="w-4 h-4 text-emerald-400" />
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Contatos">
              <Users className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Nova conversa">
              <MessageSquarePlus className="w-4 h-4" />
            </button>
            <button onClick={onOpenSettings}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors" title="Configurações">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar conversa..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {([
            { key: "all", label: "Todas" },
            { key: "unread", label: `Não lidas${unreadCount ? ` ${unreadCount}` : ""}` },
            { key: "favorites", label: "Favoritas" },
            { key: "groups", label: `Grupos${groupCount ? ` ${groupCount}` : ""}` },
            { key: "pinned", label: "Fixadas" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors shrink-0 ${tab === t.key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
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
            <p className="text-xs opacity-60 mt-1">As conversas aparecem ao receber mensagens</p>
          </div>
        )}
        {filtered.map(conv => (
          <button key={conv.id} onClick={() => onSelect(conv)}
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
  );
}

/* ── Tela de Chat ── */
function ChatView({
  conv, messages, loadingMsgs, text, setText, onSend, sending, onBack, isMobile,
}: {
  conv: Conversation; messages: Message[]; loadingMsgs: boolean;
  text: string; setText: (v: string) => void;
  onSend: () => void; sending: boolean;
  onBack: () => void; isMobile: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header do chat */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-background/80 backdrop-blur-xl shrink-0">
        {isMobile && (
          <button onClick={onBack} className="p-1.5 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="relative shrink-0">
          {conv.profilePicUrl ? (
            <img src={conv.profilePicUrl} alt={conv.contactName} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <Avatar name={conv.contactName} size={10} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{conv.contactName}</p>
          <p className="text-xs text-muted-foreground">{conv.isGroup ? "Grupo" : conv.contactPhone ?? conv.externalId ?? ""}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><Phone className="w-4 h-4" /></button>
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-3">
        {loadingMsgs && <div className="flex justify-center py-8 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin" /></div>}
        {!loadingMsgs && messages.length === 0 && <div className="flex justify-center py-8 text-muted-foreground text-sm">Nenhuma mensagem ainda</div>}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.direction === "outbound" ? "bg-primary text-white rounded-br-sm" : "bg-muted/60 text-foreground rounded-bl-sm border border-border"}`}>
              {msg.messageType === "image" && msg.mediaUrl && <img src={msg.mediaUrl} alt="" className="rounded-lg mb-2 max-w-full" />}
              {msg.messageType === "audio" && <div className="flex items-center gap-2 text-xs opacity-80 mb-1"><Volume2 className="w-3.5 h-3.5" /><span>Áudio</span></div>}
              {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
              <p className={`text-[10px] mt-1 ${msg.direction === "outbound" ? "text-white/60" : "text-muted-foreground"} text-right`}>
                {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-border bg-background/80 backdrop-blur-xl shrink-0safe-area-bottom">
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors shrink-0"><Paperclip className="w-4 h-4" /></button>
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors shrink-0"><Smile className="w-4 h-4" /></button>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Digite uma mensagem..."
          className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
        {text.trim() ? (
          <button onClick={onSend} disabled={sending}
            className="p-2.5 rounded-xl bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0">
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors shrink-0"><Mic className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  );
}

/* ── Painel de Automações ── */
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
      <div className="flex-1 overflow-y-auto scrollbar-none p-5 space-y-5">
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
  );
}

/* ── Painel direito: info do contato (desktop) ── */
function ContactPanel({ conv }: { conv: Conversation }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border">
        <div className="flex flex-col items-center gap-2 mb-4">
          <Avatar name={conv.contactName} size={14} />
          <p className="font-bold text-foreground text-base text-center">{conv.contactName}</p>
          {conv.isGroup && <p className="text-xs text-muted-foreground">Grupo</p>}
        </div>
        {conv.contactPhone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Phone className="w-3.5 h-3.5" />{conv.contactPhone}
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ações</p>
        <div className="space-y-1">
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
  );
}

/* ── Página principal ── */
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

  // Mobile: controla qual "tela" está visível
  const [mobileView, setMobileView] = useState<MobileView>("list");

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

  const selectConv = (conv: Conversation) => {
    setSelected(conv);
    setMessages([]);
    fetchMessages(conv.id);
    setMobileView("chat"); // mobile: vai para tela de chat
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

  // ── MOBILE LAYOUT — uma tela por vez ──
  return (
    <>
      {/* ════ MOBILE (< lg) ════ */}
      <div className="lg:hidden h-full flex flex-col bg-background">
        {mobileView === "list" && (
          <ConvList
            conversations={conversations} loading={loading}
            search={search} setSearch={setSearch}
            tab={tab} setTab={setTab}
            selected={selected} onSelect={selectConv}
            onOpenSettings={() => setMobileView("settings")}
          />
        )}

        {mobileView === "chat" && selected && (
          <ChatView
            conv={selected} messages={messages} loadingMsgs={loadingMsgs}
            text={text} setText={setText} onSend={sendMessage} sending={sending}
            onBack={() => setMobileView("list")} isMobile={true}
          />
        )}

        {mobileView === "settings" && (
          <SettingsPanel onClose={() => setMobileView("list")} />
        )}
      </div>

      {/* ════ DESKTOP (≥ lg) ════ */}
      <div className="hidden lg:flex h-full bg-background overflow-hidden">
        {/* Lista */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          <ConvList
            conversations={conversations} loading={loading}
            search={search} setSearch={setSearch}
            tab={tab} setTab={setTab}
            selected={selected} onSelect={selectConv}
            onOpenSettings={() => setShowSettings(!showSettings)}
          />
        </div>

        {/* Chat */}
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
            <ChatView
              conv={selected} messages={messages} loadingMsgs={loadingMsgs}
              text={text} setText={setText} onSend={sendMessage} sending={sending}
              onBack={() => {}} isMobile={false}
            />
          )}
        </div>

        {/* Painel direito: info do contato ou automações */}
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
