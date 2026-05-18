"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Settings, Users, MessageSquarePlus, Zap,
  Phone, MoreVertical, Send, Paperclip, Smile, Mic,
  X, ChevronRight, Star, RefreshCw, ArrowLeft,
  Plus, AlertCircle, Smartphone, Download, ZoomIn, Play, Pause, Crown
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function getToken() { return typeof window !== "undefined" ? localStorage.getItem("access_token") : ""; }
function authHeaders() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }

type ConvTab = "mine" | "unattended" | "all" | "unread";
type MobileView = "list" | "chat" | "settings";

interface Conversation {
  id: string; contactName: string; contactPhone?: string;
  lastMessage?: string; lastMessageAt?: string; unreadCount: number;
  status: string; channel: string; externalId?: string;
  profilePicUrl?: string; isGroup?: boolean;
  contact?: { qualification?: string; type?: string };
}
interface Message {
  id: string; content: string; direction: "inbound" | "outbound";
  createdAt: string; sentAt?: string; type?: string; mediaUrl?: string;
  externalId?: string; senderName?: string;
}
interface GroupMember {
  id: string; name: string; isAdmin: boolean;
}

/** Detecta se um telefone é LID (número longo sem prefixo + ) */
function isLidPhone(phone?: string) {
  return !!phone && /^\d{10,}$/.test(phone);
}

/** Cores para nomes de remetentes em grupos (por inicial) */
const SENDER_COLORS = [
  "text-rose-400", "text-emerald-400", "text-blue-400", "text-amber-400",
  "text-violet-400", "text-cyan-400", "text-pink-400", "text-teal-400",
];
function senderColor(name: string) {
  return SENDER_COLORS[(name?.charCodeAt(0) ?? 0) % SENDER_COLORS.length];
}

/** Player de áudio customizado */
function AudioPlayer({ src, onError }: { src: string; onError: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => { onError(); }); }
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress(a.currentTime / a.duration);
        }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        onEnded={() => setPlaying(false)}
        onError={onError}
        className="hidden"
      />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/30 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1.5 bg-primary/20 rounded-full cursor-pointer overflow-hidden"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const a = audioRef.current;
            if (a && a.duration) { a.currentTime = ratio * a.duration; setProgress(ratio); }
          }}
        >
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] opacity-60">🎤</span>
          <span className="text-[10px] opacity-60">{duration > 0 ? fmt(playing ? (progress * duration) : duration) : "—"}</span>
        </div>
      </div>
    </div>
  );
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
  const safeName = name || "U";
  const colors = [
    "from-violet-500 to-purple-600", "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600", "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
  ];
  const c = colors[safeName.charCodeAt(0) % colors.length] || colors[0];
  const sz = size === 10 ? "w-10 h-10" : size === 14 ? "w-14 h-14" : `w-${size} h-${size}`;
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br ${c} text-white font-bold flex items-center justify-center shrink-0 text-sm`}>
      {safeName.charAt(0).toUpperCase()}
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
  const unreadCount = (conversations || []).filter(c => c?.unreadCount > 0).length;
  const unattendedCount = (conversations || []).filter(c => c?.status === "OPEN" || c?.status === "open").length;

  const filtered = (conversations || []).filter(c => {
    const name = c?.contactName || "Desconhecido";
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      (c?.contactPhone && c.contactPhone.includes(search));
    if (tab === "unread") return matchSearch && c?.unreadCount > 0;
    if (tab === "mine") return matchSearch; // futuramente filtrar por atendente
    if (tab === "unattended") return matchSearch && (c?.status === "OPEN" || c?.status === "open");
    return matchSearch;
  });

  const tabs: { key: ConvTab; label: string }[] = [
    { key: "mine", label: "Minhas" },
    { key: "unattended", label: `Sem atendente${unattendedCount ? ` ${unattendedCount}` : ""}` },
    { key: "all", label: "Todas" },
    { key: "unread", label: `Não li...` },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">WhatsApp</h1>
          <div className="flex items-center gap-0.5">
            <button title="Automações" className="p-1.5 rounded-lg text-emerald-400 hover:bg-muted/50 transition-colors"><Zap className="w-4 h-4" /></button>
            <button title="Grupos" onClick={() => setTab("all")} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><Users className="w-4 h-4" /></button>
            <button title="Adicionar uma conversa" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><MessageSquarePlus className="w-4 h-4" /></button>
            <button title="Configurações" onClick={onOpenSettings} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"><Settings className="w-4 h-4" /></button>
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
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {conv.lastMessage?.startsWith("[imagem]") ? "📷 Imagem"
                    : conv.lastMessage?.startsWith("[áudio]") || conv.lastMessage?.startsWith("[audio]") ? "🎵 Áudio"
                    : conv.lastMessage?.startsWith("[sticker]") || conv.lastMessage?.startsWith("[figurinha]") ? "🎭 Figurinha"
                    : conv.lastMessage?.startsWith("[video]") ? "🎬 Vídeo"
                    : conv.lastMessage?.startsWith("[documento]") ? "📄 Documento"
                    : conv.lastMessage ?? (conv.isGroup ? "Grupo" : "Sem mensagens")}
                </p>
                {conv.contact?.qualification === 'ULTRA' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-400 shrink-0">Quente</span>}
                {conv.contact?.qualification === 'QUALIFIED' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">Qualificado</span>}
                {(!conv.contact?.qualification || conv.contact?.qualification === 'UNQUALIFIED') && !conv.isGroup && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-primary/20 text-primary shrink-0">Novo Lead</span>}
                {conv.contact?.type === 'CLIENT' && <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-violet-500/20 text-violet-400 shrink-0">Cliente</span>}
              </div>
              <div className="flex items-center justify-between">
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 ml-auto">
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

function ChatView({ conv, messages, loadingMsgs, text, setText, onSend, sending, onBack, isMobile, onUpdateMessage }: {
  conv: Conversation; messages: Message[]; loadingMsgs: boolean;
  text: string; setText: (v: string) => void;
  onSend: () => void; sending: boolean;
  onBack: () => void; isMobile: boolean;
  onUpdateMessage: (msgId: string, updates: Partial<Message>) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [failedAudios, setFailedAudios] = useState<Set<string>>(new Set());
  const [reloadingAudio, setReloadingAudio] = useState<Set<string>>(new Set());

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleAudioError = (msgId: string) => {
    setFailedAudios(prev => new Set(prev).add(msgId));
  };

  const reloadMedia = async (msg: Message) => {
    if (!msg.externalId) return;
    setReloadingAudio(prev => new Set(prev).add(msg.id));
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations/${conv.id}/messages/${msg.id}/remedia`, {
        method: "POST", headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateMessage(msg.id, { mediaUrl: data.mediaUrl });
        setFailedAudios(prev => { const next = new Set(prev); next.delete(msg.id); return next; });
      } else {
        alert("Não foi possível recarregar. A mensagem pode ser muito antiga.");
      }
    } catch {
      alert("Erro de rede ao recarregar.");
    } finally {
      setReloadingAudio(prev => { const next = new Set(prev); next.delete(msg.id); return next; });
    }
  };

  const phoneLabel = conv.isGroup
    ? "Grupo"
    : isLidPhone(conv.contactPhone) ? "Número não resolvido"
    : conv.contactPhone ?? "";

  return (
    <div className="flex flex-col h-full">
      {/* Lightbox fullscreen */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-sm p-4"
          onClick={() => setLightboxImg(null)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setLightboxImg(null)}>
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxImg} alt="Imagem ampliada"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()} />
          <a href={lightboxImg} download="imagem.jpg"
            className="absolute bottom-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={e => e.stopPropagation()}>
            <Download className="w-5 h-5" />
          </a>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
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
          <p className="font-bold text-foreground truncate text-sm">{conv.contactName}</p>
          <p className="text-xs text-muted-foreground">{phoneLabel}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50"><Phone className="w-4 h-4" /></button>
          <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-4 space-y-1">
        {loadingMsgs && <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {!loadingMsgs && messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda</p>}
        {messages.map((msg, idx) => {
          const isOut = (msg.direction as string).toUpperCase() === "OUTBOUND";
          const audioFailed = failedAudios.has(msg.id);
          const audioReloading = reloadingAudio.has(msg.id);
          // Mostra nome do remetente em grupos INBOUND quando muda de remetente
          const prevMsg = messages[idx - 1];
          const showSender = !isOut && conv.isGroup && msg.senderName &&
            (idx === 0 || prevMsg?.senderName !== msg.senderName || prevMsg?.direction?.toUpperCase() === "OUTBOUND");

          return (
            <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"} ${showSender ? "mt-3" : "mt-1"}`}>
              <div className={`max-w-[72%] ${isOut ? "" : ""}`}>
                {/* Nome do remetente no grupo */}
                {showSender && (
                  <p className={`text-xs font-semibold mb-1 ml-1 ${senderColor(msg.senderName!)}`}>
                    {msg.senderName}
                  </p>
                )}
                <div className={`rounded-2xl px-3 py-2 ${
                  isOut
                    ? "bg-primary text-white rounded-br-sm"
                    : "bg-card text-foreground rounded-bl-sm border border-border/60 shadow-sm"
                }`}>
                  {/* AUDIO */}
                  {msg.type?.toUpperCase() === "AUDIO" && (
                    <div className="mb-1.5">
                      {audioFailed ? (
                        <div className="flex items-center gap-2 py-1">
                          <span className="text-xs opacity-60">🎤 Áudio expirado</span>
                          {msg.externalId && (
                            <button onClick={() => reloadMedia(msg)} disabled={audioReloading}
                              className="flex items-center gap-1 text-xs font-semibold underline opacity-70 hover:opacity-100 disabled:opacity-30">
                              {audioReloading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Recarregar
                            </button>
                          )}
                        </div>
                      ) : msg.mediaUrl ? (
                        <AudioPlayer src={msg.mediaUrl} onError={() => handleAudioError(msg.id)} />
                      ) : (
                        <div className="flex items-center gap-2 py-1">
                          <span className="text-xs opacity-60">🎤 Áudio indisponível</span>
                          {msg.externalId && (
                            <button onClick={() => reloadMedia(msg)} disabled={audioReloading}
                              className="flex items-center gap-1 text-xs font-semibold underline opacity-70 hover:opacity-100 disabled:opacity-30">
                              <RefreshCw className="w-3 h-3" /> Carregar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* IMAGE */}
                  {msg.type?.toUpperCase() === "IMAGE" && msg.mediaUrl && (
                    <div className="relative mb-1.5 group cursor-pointer rounded-xl overflow-hidden"
                      onClick={() => setLightboxImg(msg.mediaUrl!)}>
                      <img src={msg.mediaUrl} alt="Imagem"
                        className="max-w-[240px] max-h-[280px] w-full object-cover transition-opacity group-hover:opacity-85" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="bg-black/50 rounded-full p-2"><ZoomIn className="w-5 h-5 text-white" /></div>
                      </div>
                      {msg.content && msg.content !== "[imagem]" && (
                        <p className="text-xs px-2 pb-1 opacity-80">{msg.content}</p>
                      )}
                    </div>
                  )}
                  {/* VIDEO */}
                  {msg.type?.toUpperCase() === "VIDEO" && msg.mediaUrl && (
                    <video controls className="max-w-[240px] max-h-[240px] rounded-xl mb-1.5 bg-black/10 w-full" src={msg.mediaUrl} />
                  )}
                  {/* DOCUMENT */}
                  {msg.type?.toUpperCase() === "DOCUMENT" && msg.mediaUrl && (
                    <a href={msg.mediaUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-xs font-semibold mb-1.5 bg-black/10 px-3 py-2 rounded-lg hover:bg-black/20 transition-colors">
                      <Paperclip className="w-4 h-4" /> Ver Documento
                    </a>
                  )}
                  {/* TEXT content (skip placeholder labels) */}
                  {msg.content && !["[imagem]", "[áudio]", "[audio]", "[vídeo]", "[video]", "[sticker]", "[figurinha]", "[documento]"].includes(msg.content) && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {/* Timestamp */}
                  <p className={`text-[10px] mt-0.5 text-right ${isOut ? "text-white/50" : "text-muted-foreground"}`}>
                    {msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-border bg-background shrink-0">
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Paperclip className="w-4 h-4" /></button>
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Smile className="w-4 h-4" /></button>
        <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Zap className="w-4 h-4" /></button>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Digite uma mensagem..."
          className="flex-1 min-w-0 px-4 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
        {text.trim()
          ? <button onClick={onSend} disabled={sending} className="p-2.5 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-50 shrink-0"><Send className="w-4 h-4" /></button>
          : <button className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 shrink-0"><Mic className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}

function SettingsPanel({ onClose, onDisconnect }: { onClose: () => void; onDisconnect: () => void }) {
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.")) return;
    setDisconnecting(true);
    // Tenta desconectar no backend mas não bloqueia o fluxo se falhar
    try {
      await fetch(`${API_URL}/api/v1/whatsapp/disconnect`, { method: "POST", headers: authHeaders() });
    } catch {
      // ignora erro de rede — prossegue com desconexão local
    } finally {
      setDisconnecting(false);
    }
    // Sempre atualiza a UI, independente do backend
    onDisconnect();
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <p className="font-bold text-foreground text-sm">Configurações e Automações</p>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie automações de resposta</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 p-5 space-y-6 overflow-y-auto scrollbar-none">

        {/* Sessão de Automações */}
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

        <div className="pt-6 border-t border-border">
          <p className="text-sm font-semibold text-foreground mb-4">Ações da Conta</p>
          <div className="space-y-2">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors text-left"
              onClick={async () => {
                const res = await fetch(`${API_URL}/api/v1/whatsapp/sync`, { method: "POST", headers: authHeaders() });
                if (res.ok) alert("Sincronização de contatos iniciada! Em alguns minutos os nomes e fotos aparecerão.");
              }}
            >
              <Users className="w-4 h-4" /> Sincronizar contatos (Agenda)
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors text-left"
              onClick={async () => {
                const res = await fetch(`${API_URL}/api/v1/conversations/sync-groups`, { method: "POST", headers: authHeaders() });
                if (res.ok) {
                  const data = await res.json();
                  alert(`Nomes de grupos atualizados! ${data.updated} de ${data.total} grupos renomeados.`);
                  window.location.reload();
                }
              }}
            >
              <Users className="w-4 h-4" /> Sincronizar nomes de grupos
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors text-left" onClick={async () => {
              if (!confirm("Apagar TODAS as conversas e mensagens? Esta ação não pode ser desfeita!")) return;
              await fetch(`${API_URL}/api/v1/conversations/history`, { method: "DELETE", headers: authHeaders() });
              onClose();
              window.location.reload();
            }}>
              <RefreshCw className="w-4 h-4" /> Limpar histórico de conversas
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-500 rounded-xl hover:bg-rose-500/10 transition-colors text-left disabled:opacity-50"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
              {disconnecting ? "Desconectando..." : "Desconectar WhatsApp"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactPanel({ conv }: { conv: Conversation }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!conv.isGroup) { setMembers([]); return; }
    setLoadingMembers(true);
    fetch(`${API_URL}/api/v1/conversations/${conv.id}/group-members`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { members: [] })
      .then(d => setMembers(d.members || []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [conv.id, conv.isGroup]);

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none">
      {/* Avatar + nome */}
      <div className="p-5 border-b border-border flex flex-col items-center gap-2 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {conv.profilePicUrl
            ? <img src={conv.profilePicUrl} alt={conv.contactName} className="w-16 h-16 rounded-2xl object-cover" />
            : conv.isGroup
              ? <Users className="w-8 h-8 text-primary" />
              : <Avatar name={conv.contactName} size={14} />}
        </div>
        <p className="font-bold text-foreground text-sm text-center leading-tight">{conv.contactName}</p>
        {conv.isGroup
          ? <p className="text-xs text-muted-foreground">{members.length > 0 ? `${members.length} participantes` : "Grupo"}</p>
          : conv.contactPhone && !isLidPhone(conv.contactPhone)
            ? <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{conv.contactPhone}</p>
            : <p className="text-xs text-muted-foreground italic">Número não resolvido</p>
        }
      </div>

      {/* Membros do grupo */}
      {conv.isGroup && (
        <div className="p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Membros do Grupo
          </p>
          {loadingMembers && <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
          {!loadingMembers && members.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum membro encontrado</p>
          )}
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-muted/30 transition-colors">
                <Avatar name={m.name} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{m.name}</p>
                </div>
                {m.isAdmin && (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Admin" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações (para conversas 1:1) */}
      {!conv.isGroup && (
        <div className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ações</p>
          {[{ label: "Ver contato", Icon: Users }, { label: "Adicionar ao funil", Icon: ChevronRight }, { label: "Favoritar", Icon: Star }].map(({ label, Icon }) => (
            <button key={label} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground rounded-xl hover:bg-muted/50 hover:text-foreground transition-colors text-left">
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      )}
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

  // Status de conexão do WhatsApp
  const [waStatus, setWaStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);

  const checkWaStatus = useCallback(async () => {
    try {
      // 1. Tenta o endpoint de status (rápido)
      const res = await fetch(`${API_URL}/api/v1/whatsapp/status`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setWaStatus("connected");
          setWaQr(null);
          return true;
        }
      }
      // 2. Se status retornou false ou falhou, tenta connect (já trata instância ativa)
      const connRes = await fetch(`${API_URL}/api/v1/whatsapp/connect`, {
        method: "POST", headers: authHeaders()
      });
      if (connRes.ok) {
        const connData = await connRes.json();
        if (connData.connected) {
          setWaStatus("connected");
          setWaQr(null);
          return true;
        }
        if (connData.qrCode) {
          setWaQr(connData.qrCode);
          setWaStatus("disconnected");
          return false;
        }
      }
      setWaStatus("disconnected");
      return false;
    } catch {
      setWaStatus("disconnected");
      return false;
    }
  }, []);

  useEffect(() => { checkWaStatus(); }, [checkWaStatus]);

  useEffect(() => {
    if (waQr && waStatus !== "connected") {
      const interval = setInterval(async () => {
        const isConnected = await checkWaStatus();
        if (isConnected) clearInterval(interval);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [waQr, waStatus, checkWaStatus]);

  const generateWaQr = async (forceNew = false) => {
    setWaLoading(true);
    try {
      // Só desconecta se o usuário forçou (botão "Gerar novo código"), nunca na primeira tentativa
      if (forceNew) {
        await fetch(`${API_URL}/api/v1/whatsapp/disconnect`, { method: "POST", headers: authHeaders() }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500)); // aguarda instância ser removida
      }
      const res = await fetch(`${API_URL}/api/v1/whatsapp/connect`, { method: "POST", headers: authHeaders() });
      if (!res.ok) { alert("Erro ao conectar — tente novamente"); return; }
      const data = await res.json();
      if (data.connected) {
        setWaStatus("connected");
        setWaQr(null);
      } else if (data.qrCode) {
        setWaQr(data.qrCode);
        setWaStatus("disconnected");
      } else {
        alert("Não foi possível gerar o QR Code. Tente novamente em alguns segundos.");
      }
    } catch {
      alert("Erro ao gerar QR Code");
    } finally {
      setWaLoading(false);
    }
  };

  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations?limit=100`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(Array.isArray(data.conversations) ? data.conversations : Array.isArray(data) ? data : []);
    } catch {
      // silencioso
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (convId: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations/${convId}/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(Array.isArray(data.messages) ? data.messages : Array.isArray(data) ? data : []);
    } catch {
      // silencioso
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => fetchConversations(true), 5000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      fetchMessages(selected.id, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selected, fetchMessages]);

  const selectConv = (conv: Conversation) => {
    setSelected(conv);
    setMessages([]);
    fetchMessages(conv.id);
    setMobileView("chat");
  };

  const updateMessage = useCallback((msgId: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, ...updates } : m));
  }, []);

  const sendMessage = async () => {
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/conversations/${selected.id}/messages`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ content: text.trim(), type: "text" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao enviar: ${err.message || "Erro desconhecido"}`);
        return;
      }
      setText("");
      fetchMessages(selected.id);
    } catch (e: any) {
      alert(`Erro de rede: ${e.message}`);
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
    <div className="relative h-full w-full">
      {/* ── Overlay de Conexão ── */}
      {waStatus !== "connected" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl max-w-sm w-full flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            {waStatus === "checking" ? (
              <div className="py-12 flex flex-col items-center">
                <RefreshCw className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="font-semibold text-foreground">Verificando conexão...</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <Smartphone className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Conecte seu WhatsApp</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Para enviar e receber mensagens, você precisa conectar seu aparelho escaneando o QR Code.
                </p>

                {waQr ? (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-border mb-4">
                      <img src={waQr} alt="QR Code WhatsApp" className="w-48 h-48" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Abra o WhatsApp &gt; Aparelhos Conectados
                    </p>
                    <button onClick={() => generateWaQr(true)} disabled={waLoading} className="text-sm font-semibold text-primary hover:underline flex items-center gap-2">
                      {waLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Gerar novo código
                    </button>
                  </div>
                ) : (
                  <button onClick={() => generateWaQr()} disabled={waLoading} className="w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold text-white bg-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                    {waLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                    Gerar QR Code
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile ── */}
      <div className="lg:hidden h-full flex flex-col bg-background">
        {mobileView === "list" && <ConvList {...listProps} />}
        {mobileView === "chat" && selected && (
          <ChatView conv={selected} messages={messages} loadingMsgs={loadingMsgs}
            text={text} setText={setText} onSend={sendMessage} sending={sending}
            onBack={() => setMobileView("list")} isMobile onUpdateMessage={updateMessage} />
        )}
        {mobileView === "settings" && <SettingsPanel onClose={() => setMobileView("list")} onDisconnect={() => setWaStatus("disconnected")} />}
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
              onBack={() => {}} isMobile={false} onUpdateMessage={updateMessage} />
          )}
        </div>
        {selected && !showSettings && (
          <div className="w-64 shrink-0 border-l border-border bg-background/50">
            <ContactPanel conv={selected} />
          </div>
        )}
        {showSettings && (
          <div className="w-80 shrink-0 border-l border-border bg-background">
            <SettingsPanel onClose={() => setShowSettings(false)} onDisconnect={() => setWaStatus("disconnected")} />
          </div>
        )}
      </div>
    </div>
  );
}