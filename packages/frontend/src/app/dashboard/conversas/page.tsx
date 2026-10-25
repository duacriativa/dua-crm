"use client";
import { authFetch } from "@/lib/auth-fetch";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, Suspense, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { useSearchParams } from "next/navigation";

// Converte *negrito* do WhatsApp em <strong>
function formatWhatsApp(text?: string | null) {
  if (!text) return text;
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    /^\*[^*\n]+\*$/.test(part) ? <strong key={i}>{part.slice(1, -1)}</strong> : part
  );
}
import {
  Search, Send, Phone, MoreVertical, Clock, CheckCheck, Check,
  Smile, Paperclip, MessageCircle, Instagram, Circle,
  ArrowLeft, RefreshCw, Plus, X, Trash2, AlertCircle, Sparkles, FileText, StickyNote,
  Mail, BadgeCheck, Megaphone, EyeOff, RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { SendTemplateModal } from "@/components/whatsapp/templates";

const API_URL = "";

type Channel = "WHATSAPP" | "INSTAGRAM" | "WEBCHAT";
type ConversationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
type MobileView = "list" | "chat" | "info";

interface Contact {
  id: string; name: string; phone?: string; email?: string; instagramHandle?: string | null;
  tags?: string[]; segment?: string;
}
interface Message {
  id: string; externalId?: string | null; content: string; direction: "INBOUND" | "OUTBOUND";
  type: string; sentAt: string; mediaUrl?: string | null;
  quotedContent?: string | null; quotedExternalId?: string | null; quotedType?: string | null;
  deliveredAt?: string | null; readAt?: string | null; errorCode?: string | null; errorMessage?: string; quotedFromMe?: boolean;
}
// Nota interna da linha do tempo (fica no contato, não vai para o WhatsApp)
interface Activity {
  id: string; type: "NOTE"; content: string; conversationId?: string | null;
  authorName?: string | null; recipientName?: string | null; author?: { name: string } | null; createdAt: string;
}
type TimelineItem = { kind: "msg"; at: string; msg: Message } | { kind: "note"; at: string; note: Activity };
// Ficha completa do contato (GET /contacts/:id) para a lateral
interface ContactDetails {
  id: string; type: "LEAD" | "CLIENT"; clientSince?: string | null; tags: string[];
  email?: string | null; instagramHandle?: string | null;
  monthlyRevenue?: string | null; saleModel?: string | null;
  utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null;
  adHeadline?: string | null; adSourceUrl?: string | null;
  contracts?: { id: string; clientName: string; serviceType: string; monthlyValue: number }[];
}
const SERVICE_LABEL: Record<string, string> = {
  SOCIAL_MEDIA: "Social media", PAID_TRAFFIC: "Tráfego pago", CRM_SETUP: "CRM", CONSULTING: "Consultoria", OTHER: "Outro",
};
// "@lsfbrand_", "lsfbrand_" ou a URL do perfil → "lsfbrand_"
function igHandle(raw: string) {
  return raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
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
// Separador de dia da linha do tempo: "Hoje", "Ontem" ou "20 de outubro"
function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", d.getFullYear() === today.getFullYear()
    ? { day: "2-digit", month: "long" } : { day: "2-digit", month: "long", year: "numeric" });
}
function channelIcon(channel: Channel) {
  if (channel === "WHATSAPP") return <MessageCircle className="w-3.5 h-3.5 text-green-500" />;
  if (channel === "INSTAGRAM") return <Instagram className="w-3.5 h-3.5 text-pink-500" />;
  return <Circle className="w-3.5 h-3.5 text-gray-400" />;
}
// Aberta: precisa de resposta nossa · Aguardando: esperando pagamento/retorno ·
// Concluída: assunto encerrado · Ignorada: spam/grupo, some da lista.
// Aguardando e Concluída voltam para Aberta quando o cliente escreve.
const STATUS_META: Record<ConversationStatus, { label: string; action: string; dot: string; badge: string; item: string }> = {
  OPEN: { label: "Aberta", action: "Reabrir", dot: "bg-green-500", badge: "bg-green-100 text-green-700", item: "text-blue-700 hover:bg-blue-50" },
  IN_PROGRESS: { label: "Aguardando", action: "Aguardando", dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700", item: "text-yellow-700 hover:bg-yellow-50" },
  RESOLVED: { label: "Concluída", action: "Concluir", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-500", item: "text-green-700 hover:bg-green-50" },
  ARCHIVED: { label: "Ignorada", action: "Ignorar", dot: "bg-gray-300", badge: "bg-gray-100 text-gray-400", item: "text-gray-600 hover:bg-gray-50" },
};
const STATUS_ICON: Record<ConversationStatus, typeof Clock> = { OPEN: RotateCcw, IN_PROGRESS: Clock, RESOLVED: CheckCheck, ARCHIVED: EyeOff };
const tabs: { label: string; value: string }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Abertas", value: "OPEN" },
  { label: "Aguardando", value: "IN_PROGRESS" },
  { label: "Concluídas", value: "RESOLVED" },
  { label: "Ignoradas", value: "ARCHIVED" },
];

const QUOTED_LABEL: Record<string, string> = { IMAGE: "📷 Imagem", VIDEO: "🎥 Vídeo", AUDIO: "🎵 Áudio", DOCUMENT: "📄 Documento" };

function ConversasInner() {
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get("phone");
  const convParam = searchParams.get("conv");

  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  // Campo de mensagem cresce até mostrar o texto todo (limite max-h-60)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [newMessage]);
  // Assinatura: nome que aparece em negrito acima da mensagem (ex: "Financeiro")
  const [signatures, setSignatures] = useState<string[]>([]);
  const [signature, setSignature] = useState("");
  // Ficam salvas no usuário (servidor), para aparecerem em qualquer aparelho
  const persistSignatures = (list: string[], current: string) =>
    authFetch(`${API_URL}/api/v1/users/me/signatures`, {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ signatures: list, signature: current }),
    }).catch(() => {});
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/v1/users/me/signatures`, { headers: authHeaders() });
        if (!res.ok) return;
        const data: { signatures: string[]; signature: string } = await res.json();
        // Assinaturas antigas, salvas só neste navegador: sobem para o servidor uma vez
        let local: string[] = [];
        try { local = JSON.parse(localStorage.getItem("crm_signatures") || "[]"); } catch {}
        if (!data.signatures.length && local.length) {
          const current = localStorage.getItem("crm_signature") || "";
          setSignatures(local); setSignature(local.includes(current) ? current : "");
          await persistSignatures(local, current);
        } else {
          setSignatures(data.signatures); setSignature(data.signature || "");
        }
        try { localStorage.removeItem("crm_signatures"); localStorage.removeItem("crm_signature"); } catch {}
      } catch {}
    })();
  }, []);
  const saveSignatures = (list: string[], current: string) => {
    setSignatures(list); setSignature(current);
    persistSignatures(list, current);
  };
  const handleSignatureChange = (value: string) => {
    if (value === "__add") {
      const name = window.prompt("Nome da assinatura (ex: Financeiro, Daniel):")?.trim();
      if (name) saveSignatures(signatures.includes(name) ? signatures : [...signatures, name], name);
    } else if (value === "__remove") {
      if (signature && window.confirm(`Remover a assinatura "${signature}"?`)) saveSignatures(signatures.filter(s => s !== signature), "");
    } else {
      saveSignatures(signatures, value);
    }
  };
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  // Celular: arrastar o dedo para a direita volta uma tela (chat → lista, info → chat)
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    const el = e.target as HTMLElement;
    swipeStart.current = el.closest("input, textarea, select, [data-no-swipe]") ? null : { x: t.clientX, y: t.clientY };
  };
  const onSwipeEnd = (e: ReactTouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (dx < 80 || dy > dx / 2) return;
    if (mobileView === "chat") setMobileView("list");
    else if (mobileView === "info") setMobileView("chat");
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(false);
  const forceScrollRef = useRef(false);   // rola até o fim após enviar
  const prevScrollHeightRef = useRef(0);  // altura antes da última atualização
  const stickUntilRef = useRef(0);        // até quando a conversa recém-aberta fica presa no fim (fotos carregando)
  const scrollToBottom = () => requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: "end" }));
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedRef = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  // Reply / citação de mensagem
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Notas internas: o campo vira "Nota interna" e salva no CRM em vez de enviar
  const [notes, setNotes] = useState<Activity[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteRecipient, setNoteRecipient] = useState(""); // "" = toda a equipe; senão, a assinatura do colega

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Emoji picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // File attachment
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Menu ⋮ do header do chat
  const [showChatMenu, setShowChatMenu] = useState(false);

  // O chat é montado duas vezes (desktop e celular), então um ref só apontaria
  // para uma das cópias e o clique num item do menu fecharia o menu antes de agir
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.("[data-chat-menu]")) setShowChatMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Nova conversa outbound
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState("");
  const [newConvName, setNewConvName] = useState("");
  const [newConvMessage, setNewConvMessage] = useState("");
  const [startingConv, setStartingConv] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Limpa LID e formatos estranhos para exibição
  const displayPhone = (phone?: string | null) => {
    if (!phone) return "";
    if (phone.startsWith("ig:")) return "Instagram";
    if (phone.startsWith("lid:")) return "LID: " + phone.replace("lid:", "").substring(0, 8) + "…";
    if (phone.includes("@lid")) return "LID";
    // Formata número BR: +55 (DD) 9XXXX-XXXX
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length === 12) {
      // Faltou o 9 do celular — insere após o DDD
      const fixed = digits.slice(0, 4) + "9" + digits.slice(4);
      return `+${fixed.slice(0,2)} (${fixed.slice(2,4)}) ${fixed.slice(4,9)}-${fixed.slice(9)}`;
    }
    if (digits.startsWith("55") && digits.length === 13) {
      return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const saveContact = async () => {
    if (!selected) return;
    setSavingContact(true);
    try {
      await authFetch(`${API_URL}/api/v1/contacts/${selected.contact.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      // Atualiza local
      setConversations((prev) => prev.map((c) =>
        c.id === selected.id
          ? { ...c, contact: { ...c.contact, name: editName, phone: editPhone }, externalId: editPhone }
          : c
      ));
      setSelected((prev) => prev ? { ...prev, contact: { ...prev.contact, name: editName, phone: editPhone }, externalId: editPhone } : prev);
      setEditingContact(false);
    } finally {
      setSavingContact(false);
    }
  };

  // ── Ficha do contato na lateral (cliente/lead, dados do formulário, tags) ──
  const [contactInfo, setContactInfo] = useState<ContactDetails | null>(null);
  const [newTag, setNewTag] = useState("");
  const selectedContactId = selected?.contact.id;
  useEffect(() => {
    setContactInfo(null);
    setNewTag("");
    if (!selectedContactId) return;
    let alive = true;
    authFetch(`${API_URL}/api/v1/contacts/${selectedContactId}`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data) setContactInfo(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedContactId]);

  const patchContact = async (data: Partial<Pick<ContactDetails, "type" | "tags">>) => {
    if (!selected || !contactInfo) return;
    const prev = contactInfo;
    const next = { ...contactInfo, ...data };
    if (data.type === "CLIENT" && !contactInfo.clientSince) next.clientSince = new Date().toISOString();
    setContactInfo(next);
    // Tags também aparecem na lista de conversas
    if (data.tags) {
      const contactId = selected.contact.id;
      setConversations((list) => list.map((c) => c.contact.id === contactId ? { ...c, contact: { ...c.contact, tags: data.tags } } : c));
      setSelected((s) => s ? { ...s, contact: { ...s.contact, tags: data.tags } } : s);
    }
    try {
      const res = await authFetch(`${API_URL}/api/v1/contacts/${contactInfo.id}`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
    } catch {
      setContactInfo(prev);
    }
  };
  const addTag = () => {
    const tag = newTag.trim();
    setNewTag("");
    if (!tag || !contactInfo || contactInfo.tags.includes(tag)) return;
    patchContact({ tags: [...contactInfo.tags, tag] });
  };
  const phoneParamUsed = useRef(false);

  // ── Busca lista de conversas ──────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeTab !== "ALL") params.set("status", activeTab);
      if (search) params.set("search", search);
      params.set("limit", "50");

      const res = await authFetch(`${API_URL}/api/v1/conversations?${params}`, { headers: authHeaders() });
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

  // ── Auto-seleciona conversa pelo ?conv= (notificação push) ou ?phone= ──────
  useEffect(() => {
    if ((!phoneParam && !convParam) || loading || phoneParamUsed.current) return;
    const nameParam = searchParams.get("name");
    const digits = phoneParam?.replace(/\D/g, "");
    const match = conversations.find((c) =>
      (convParam && c.id === convParam) || (digits && c.contact.phone?.replace(/\D/g, "") === digits)
    );
    if (match) {
      phoneParamUsed.current = true;
      selectConversation(match);
    } else if (!phoneParam) {
      phoneParamUsed.current = true;
    } else {
      phoneParamUsed.current = true;
      setNewConvPhone(phoneParam);
      if (nameParam) setNewConvName(nameParam);
      setShowNewConv(true);
    }
  }, [phoneParam, convParam, conversations, loading, searchParams]);

  // ── Inicia conversa outbound ──────────────────────────────────────────────
  const startConversation = async () => {
    if (!newConvPhone.trim() || startingConv) return;
    setStartingConv(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/start`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          phone: newConvPhone.trim(),
          name: newConvName.trim() || undefined,
          message: newConvMessage.trim() || undefined,
        }),
      });
      if (!res.ok) return;
      const conv = await res.json();
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv.id);
        return exists ? prev : [{ ...conv, lastMessage: newConvMessage || null, unreadCount: 0 }, ...prev];
      });
      selectConversation({ ...conv, lastMessage: newConvMessage || null, unreadCount: 0 });
      setShowNewConv(false);
      setNewConvPhone(""); setNewConvName(""); setNewConvMessage("");
    } finally {
      setStartingConv(false);
    }
  };

  // ── Busca mensagens da conversa selecionada ───────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${convId}/messages`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const raw: Message[] = Array.isArray(data) ? data : [];
      // Completa citações antigas (só com id) a partir das mensagens carregadas
      const byExt = new Map(raw.filter((m) => m.externalId).map((m) => [m.externalId!, m]));
      const list = raw.map((m) => {
        const q = m.quotedExternalId ? byExt.get(m.quotedExternalId) : undefined;
        return q ? { ...m, quotedContent: m.quotedContent || q.content, quotedType: m.quotedType || q.type, quotedFromMe: q.direction === "OUTBOUND" } : m;
      });
      // Mantém mensagens otimistas até o servidor devolvê-las (evita a "piscada")
      setMessages((prev) => [
        ...list,
        ...prev.filter((m) => m.id.startsWith("opt-") && (m.errorCode || (Date.now() - new Date(m.sentAt).getTime() < 15000
          && !list.some((d) => d.direction === "OUTBOUND" && d.content === m.content)))),
      ]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const fetchActivities = useCallback(async (convId: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${convId}/activities`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      // Ignora resposta atrasada de outra conversa
      if (selectedRef.current?.id === convId) setNotes(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const selectConversation = (conv: Conversation) => {
    isInitialLoadRef.current = true;
    setMessages([]);
    setNotes([]);
    setNoteMode(false);
    setSelected(conv);
    selectedRef.current = conv;
    setMobileView("chat");
    fetchMessages(conv.id);
    fetchActivities(conv.id);
    // Zero unread localmente
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
  };

  // ── Polling de mensagens a cada 3s quando conversa aberta ────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected) return;
    pollRef.current = setInterval(() => {
      if (selectedRef.current) { fetchMessages(selectedRef.current.id); fetchActivities(selectedRef.current.id); }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, fetchMessages, fetchActivities]);

  // ── Linha do tempo: mensagens + notas internas, em ordem de horário ──────
  const timeline = useMemo<TimelineItem[]>(() => {
    // Só 50 mensagens são carregadas: notas mais antigas que elas ficariam fora de ordem no topo
    const oldest = messages.length >= 50 ? new Date(messages[0].sentAt).getTime() : -Infinity;
    const items: TimelineItem[] = [
      ...messages.map((msg) => ({ kind: "msg" as const, at: msg.sentAt, msg })),
      ...notes.filter((n) => new Date(n.createdAt).getTime() >= oldest).map((note) => ({ kind: "note" as const, at: note.createdAt, note })),
    ];
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [messages, notes]);

  // ── Auto scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (timeline.length === 0) return;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      // setTimeout garante que o browser terminou o layout antes de scrollar
      stickUntilRef.current = Date.now() + 10_000;
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) { container.scrollTop = container.scrollHeight; prevScrollHeightRef.current = container.scrollHeight; }
      }, 50);
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) return;
    // Mede pela altura anterior: a mensagem nova já está no DOM e não deve contar
    const wasNearBottom = prevScrollHeightRef.current - container.scrollTop - container.clientHeight < 200;
    if (forceScrollRef.current || wasNearBottom) {
      forceScrollRef.current = false;
      scrollToBottom();
    }
    prevScrollHeightRef.current = container.scrollHeight;
  }, [timeline]);

  // Fotos e vídeos carregam depois da rolagem inicial e empurram o fim para baixo:
  // enquanto a conversa acabou de abrir, volta para o fim a cada mídia carregada,
  // até a pessoa rolar por conta própria
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onMediaLoad = () => {
      if (Date.now() > stickUntilRef.current) return;
      container.scrollTop = container.scrollHeight;
      prevScrollHeightRef.current = container.scrollHeight;
    };
    const release = () => { stickUntilRef.current = 0; };
    container.addEventListener("load", onMediaLoad, true);
    container.addEventListener("loadedmetadata", onMediaLoad, true);
    container.addEventListener("wheel", release, { passive: true });
    container.addEventListener("touchmove", release, { passive: true });
    return () => {
      container.removeEventListener("load", onMediaLoad, true);
      container.removeEventListener("loadedmetadata", onMediaLoad, true);
      container.removeEventListener("wheel", release);
      container.removeEventListener("touchmove", release);
    };
  }, [selected?.id]);

  // ── Enviar mensagem ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selected || sending) return;
    setSending(true);
    const content = signature ? `*${signature}:*\n${newMessage.trim()}` : newMessage.trim();
    const quoted = replyingTo;
    setNewMessage("");
    setReplyingTo(null);

    // Otimista
    const optimistic: Message = {
      id: `opt-${Date.now()}`, content, direction: "OUTBOUND",
      type: "TEXT", sentAt: new Date().toISOString(),
      quotedContent: quoted?.content ?? null,
      quotedExternalId: quoted?.externalId ?? null,
      quotedType: quoted?.type ?? null,
    };
    forceScrollRef.current = true;
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          content,
          quotedExternalId: quoted?.externalId ?? undefined,
          quotedContent: quoted?.content ?? undefined,
          quotedType: quoted?.type ?? undefined,
        }),
      });
      const saved = await res.json().catch(() => null);
      setMessages((prev) => prev.map((m) => m.id !== optimistic.id ? m
        : res.ok && saved?.id ? saved
        : { ...m, errorCode: "send_failed", errorMessage: [].concat(saved?.message ?? `Erro ${res.status}`).join(" ") }));
    } catch {
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, errorCode: "send_failed", errorMessage: "Sem conexão com o servidor." } : m));
    } finally {
      setSending(false);
    }
  }, [newMessage, selected, sending, replyingTo, signature]);

  // Baixa documento: usa mediaUrl salvo ou busca na API oficial sob demanda
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Busca a mídia na API oficial (o webhook só traz o id) e guarda na mensagem
  const fetchMediaUrl = async (convId: string, msgId: string): Promise<{ url?: string; error?: string }> => {
    const res = await authFetch(`${API_URL}/api/v1/conversations/${convId}/messages/${msgId}/remedia`, { method: "POST", headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.mediaUrl) return { error: data.message };
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, mediaUrl: data.mediaUrl } : m));
    return { url: data.mediaUrl };
  };

  // Carrega automaticamente imagens/figurinhas que ainda não têm arquivo
  const triedMediaRef = useRef(new Set<string>());
  useEffect(() => {
    if (!selected) return;
    messages
      .filter((m) => m.type === "IMAGE" && !m.mediaUrl && !m.id.startsWith("opt-") && !triedMediaRef.current.has(m.id))
      .slice(-20)
      .forEach((m) => { triedMediaRef.current.add(m.id); fetchMediaUrl(selected.id, m.id).catch(() => {}); });
  }, [messages, selected]);

  // Imagem terminou de carregar: se estava no fim da conversa, continua no fim
  const handleMediaLoad = () => {
    const c = messagesContainerRef.current;
    if (c && c.scrollHeight - c.scrollTop - c.clientHeight < 300) scrollToBottom();
  };

  const downloadDocument = async (msg: Message) => {
    if (!selected || downloadingId) return;
    let url = msg.mediaUrl;
    if (!url) {
      setDownloadingId(msg.id);
      try {
        const r = await fetchMediaUrl(selected.id, msg.id);
        if (!r.url) { alert(r.error || "Não foi possível baixar o arquivo."); return; }
        url = r.url;
      } finally {
        setDownloadingId(null);
      }
    }
    const a = document.createElement("a");
    a.href = url!;
    a.download = msg.content && msg.content !== "[documento]" ? msg.content : "documento";
    a.click();
  };

  // ── Sugestão de resposta (IA) ─────────────────────────────────────────────
  // Janela de 24h da Meta: sem mensagem do contato nesse período, só template aprovado
  const [showTemplate, setShowTemplate] = useState(false);
  const [writeAnyway, setWriteAnyway] = useState(false);
  // Instagram: sem template; até 7 dias vai com a tag de atendimento humano, depois só quando o contato escrever
  const isInstagram = selected?.channel === "INSTAGRAM";
  const sinceInbound = useMemo(() => {
    const last = messages.reduce((max, m) => (m.direction === "INBOUND" ? Math.max(max, new Date(m.sentAt).getTime()) : max), 0);
    return Date.now() - last;
  }, [messages]);
  const windowClosed = isInstagram ? sinceInbound > 7 * 24 * 60 * 60 * 1000 : sinceInbound > 24 * 60 * 60 * 1000;
  const humanAgentWindow = isInstagram && !windowClosed && sinceInbound > 24 * 60 * 60 * 1000;
  useEffect(() => { setWriteAnyway(false); setShowTemplate(false); }, [selected?.id]);

  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const requestSuggestion = async (previous?: string) => {
    if (!selected || suggesting) return;
    setSuggesting(true); setSuggestError("");
    if (suggestion === null) setSuggestion("");
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${selected.id}/suggest-reply`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ previous, draft: previous ? undefined : newMessage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setSuggestError([].concat(data.message ?? "Não foi possível gerar a sugestão.").join(" "));
      else setSuggestion(data.suggestion || "");
    } catch {
      setSuggestError("Sem conexão com o servidor.");
    } finally {
      setSuggesting(false);
    }
  };
  const applySuggestion = () => {
    if (!suggestion) return;
    setNewMessage(suggestion);
    setSuggestion(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // ── Notas internas ────────────────────────────────────────────────────────
  const saveNote = useCallback(async () => {
    if (!newMessage.trim() || !selected || savingNote) return;
    setSavingNote(true);
    try {
      const res = await authFetch(`${API_URL}/api/v1/conversations/${selected.id}/notes`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ content: newMessage.trim(), authorName: signature || undefined, recipientName: noteRecipient || undefined }),
      });
      if (!res.ok) { alert("Não foi possível salvar a nota. Tente de novo."); return; }
      const note: Activity = await res.json();
      forceScrollRef.current = true;
      setNotes((prev) => [...prev.filter((n) => n.id !== note.id), note]);
      setNewMessage("");
    } catch {
      alert("Sem conexão com o servidor. A nota não foi salva.");
    } finally {
      setSavingNote(false);
    }
  }, [newMessage, selected, savingNote, signature, noteRecipient]);

  const deleteNote = async (note: Activity) => {
    if (!selected || !window.confirm("Excluir esta nota?")) return;
    const res = await authFetch(`${API_URL}/api/v1/conversations/${selected.id}/activities/${note.id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== note.id));
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter quebra a linha na posição do cursor
      e.preventDefault();
      const el = e.currentTarget as HTMLTextAreaElement;
      const { selectionStart: start, selectionEnd: end, value } = el;
      setNewMessage(value.slice(0, start) + "\n" + value.slice(end));
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 1; });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (noteMode) saveNote(); else sendMessage(); }
  }, [sendMessage, saveNote, noteMode]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
  }, []);

  const COMMON_EMOJIS = [
    '😀','😂','🥰','😍','😎','🤔','😅','😭','😱','🥳',
    '👍','👎','❤️','🔥','✨','🎉','🙏','💯','😊','😢',
    '😡','🤣','😴','🤗','😬','🤩','🥺','😤','🤯','😇',
    '👋','🤝','💪','🙌','👏','🫶','❤️‍🔥','💔','💬','📸',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendFile(file);
  };

  // Ctrl+V com imagem (print) no campo de mensagem envia a imagem
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const blob = item?.getAsFile();
    if (!blob || !selected) return;
    e.preventDefault();
    if (!window.confirm(`Enviar a imagem colada para ${selected.contact.name}?`)) return;
    const ext = blob.type.split("/")[1] || "png";
    sendFile(new File([blob], `print-${Date.now()}.${ext}`, { type: blob.type }));
  };

  const sendFile = async (file: File) => {
    if (!selected || sendingMedia) return;
    setSendingMedia(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const mediatype = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'document'
        : file.type.startsWith('video/') ? 'video'
        : 'document';

      // Optimistic message
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        content: file.name,
        direction: 'OUTBOUND',
        type: mediatype === 'image' ? 'IMAGE' : mediatype === 'video' ? 'VIDEO' : 'DOCUMENT',
        sentAt: new Date().toISOString(),
        mediaUrl: mediatype === 'image' ? `data:${file.type};base64,${base64}` : null,
      };
      forceScrollRef.current = true;
      setMessages(prev => [...prev, optimistic]);

      try {
        await authFetch(`${API_URL}/api/v1/conversations/${selected.id}/media`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ base64, mediatype, filename: file.name, caption: '' }),
        });
      } finally {
        setSendingMedia(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const updateStatus = async (status: ConversationStatus) => {
    if (!selected) return;
    const res = await authFetch(`${API_URL}/api/v1/conversations/${selected.id}/status`, {
      method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }),
    });
    if (!res.ok) { alert("Não foi possível mudar o status da conversa."); return; }
    setSelected((prev) => prev ? { ...prev, status } : prev);
    // Sai da aba atual se não pertence mais a ela ("Todas" não mostra ignoradas)
    const fits = activeTab === "ALL" ? status !== "ARCHIVED" : activeTab === status;
    setConversations((prev) => fits
      ? prev.map((c) => c.id === selected.id ? { ...c, status } : c)
      : prev.filter((c) => c.id !== selected.id));
  };

  const deleteConversation = async () => {
    if (!selected) return;
    if (!confirm(`Excluir conversa com ${selected.contact.name}? Todo o histórico será apagado.`)) return;
    await authFetch(`${API_URL}/api/v1/conversations/${selected.id}`, { method: "DELETE", headers: authHeaders() });
    setConversations((prev) => prev.filter((c) => c.id !== selected.id));
    setSelected(null);
    setMessages([]);
    setMobileView("list");
  };

  // ── Conversation List ─────────────────────────────────────────────────────
  const ConvList = (
    <aside className="w-full lg:w-80 flex flex-col border-r border-gray-200 bg-white shrink-0 h-full">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Conversas</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => { setNewConvPhone(""); setNewConvName(""); setNewConvMessage(""); setShowNewConv(true); }}
              className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-xl" title="Nova conversa">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={fetchConversations} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100" title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa..." className="w-full pl-9 pr-4 py-2 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
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
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${STATUS_META[conv.status].dot}`} />
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
                <span className="text-xs text-gray-400">{selected.channel === "INSTAGRAM" && selected.contact.instagramHandle ? `@${selected.contact.instagramHandle}` : displayPhone(selected.contact.phone) || displayPhone(selected.externalId)}</span>
              </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Status rápido */}
          {selected.status === "OPEN" ? (
            <button onClick={() => updateStatus("RESOLVED")} title="Assunto encerrado; volta para Aberta se o cliente escrever"
              className="text-xs px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 font-medium hover:bg-green-100 hidden sm:flex items-center gap-1">
              <CheckCheck className="w-3.5 h-3.5" />Concluir
            </button>
          ) : (
            <button onClick={() => updateStatus("OPEN")} className="text-xs px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 hidden sm:flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" />Reabrir
            </button>
          )}
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_META[selected.status]?.badge ?? ""}`}>
            {STATUS_META[selected.status]?.label ?? selected.status}
          </span>
          <div className="relative" data-chat-menu>
            <button onClick={() => setShowChatMenu((v) => !v)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showChatMenu && (
              <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg border border-gray-100 z-30 w-44 py-1">
                {(["OPEN", "IN_PROGRESS", "RESOLVED", "ARCHIVED"] as ConversationStatus[]).filter((st) => st !== selected.status).map((st) => {
                  const Icon = STATUS_ICON[st];
                  return (
                    <button key={st} onClick={() => { updateStatus(st); setShowChatMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 ${STATUS_META[st].item}`}>
                      <Icon className="w-3.5 h-3.5" />{STATUS_META[st].action}
                    </button>
                  );
                })}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { deleteConversation(); setShowChatMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" />Excluir conversa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
        {loadingMsgs && messages.length === 0 ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-gray-300" /></div>
        ) : timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageCircle className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          timeline.map((item, i) => {
            const showDate = i === 0 || new Date(timeline[i - 1].at).toDateString() !== new Date(item.at).toDateString();
            const dateSeparator = showDate && (
              <div className="flex justify-center my-3">
                <span className="text-[11px] text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200">
                  {dayLabel(item.at)}
                </span>
              </div>
            );
            if (item.kind === "note") {
              const note = item.note;
              const forMe = !!note.recipientName && note.recipientName === signature;
              return (
                <div key={`note-${note.id}`}>
                  {dateSeparator}
                  <div className="flex justify-center group">
                    <div className={`w-full max-w-[85%] rounded-2xl border bg-amber-50 px-4 py-2.5 text-sm text-amber-950 shadow-sm ${forMe ? "border-amber-400 ring-2 ring-amber-300" : "border-amber-200"}`}>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1 text-[11px] text-amber-700">
                        <StickyNote className="w-3.5 h-3.5" />
                        {note.recipientName ? (<>
                          <span className="font-semibold">Mensagem interna</span>
                          <span>· de: <b>{note.authorName || note.author?.name || "Equipe"}</b> para: <b>{forMe ? "você" : note.recipientName}</b></span>
                        </>) : (<>
                          <span className="font-semibold">Nota interna</span>
                          <span>· {note.authorName || note.author?.name || "Equipe"}</span>
                        </>)}
                        <span>· {new Date(note.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        <button onClick={() => deleteNote(note)} title="Excluir nota"
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-amber-600 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    </div>
                  </div>
                </div>
              );
            }
            const msg = item.msg;
            const isOut = msg.direction === "OUTBOUND";
            return (
              <div key={msg.id}>
                {dateSeparator}
                <div className={`flex items-end gap-1 group ${isOut ? "justify-end" : "justify-start"}`}>
                  {/* Botão reply — aparece no hover */}
                  {!isOut && (
                    <button onClick={() => setReplyingTo(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-gray-100 hover:bg-gray-200 shrink-0 mb-1">
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  )}
                  <div className={`max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden ${isOut ? "bg-brand-600 text-white rounded-br-md" : "bg-white text-gray-800 rounded-bl-md border border-gray-100"}`}>
                    {/* Citação (quoted reply) */}
                    {msg.quotedContent && (
                      <div className={`mx-2 mt-2 px-3 py-2 rounded-xl text-xs border-l-4 ${isOut ? "bg-white/20 border-white/60 text-white/90" : "bg-gray-50 border-brand-400 text-gray-600"}`}>
                        <p className={`font-semibold mb-0.5 text-[11px] ${isOut ? "text-white" : "text-brand-600"}`}>
                          {msg.quotedFromMe === undefined ? "Mensagem" : msg.quotedFromMe ? "Você" : selected.contact.name}
                          {msg.quotedType && QUOTED_LABEL[msg.quotedType] && <span className="font-normal opacity-80"> · {QUOTED_LABEL[msg.quotedType]}</span>}
                        </p>
                        <p className="line-clamp-3 whitespace-pre-wrap">{formatWhatsApp(msg.quotedContent)}</p>
                      </div>
                    )}
                    {/* Thumbnail de imagem/vídeo */}
                    {(msg.type === "IMAGE" || msg.type === "VIDEO") && msg.mediaUrl && (
                      <div className="relative">
                        <img
                          src={msg.mediaUrl} alt="mídia"
                          className="w-full max-w-[280px] object-cover rounded-t-2xl cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ maxHeight: 200 }}
                          onLoad={handleMediaLoad}
                          onClick={() => setLightboxUrl(msg.mediaUrl!)}
                        />
                        {msg.type === "VIDEO" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-t-2xl pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                              <svg className="w-5 h-5 text-gray-800 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Ícone para tipos sem thumbnail */}
                    {(msg.type === "IMAGE" || msg.type === "VIDEO") && !msg.mediaUrl && (
                      <div className={`flex items-center gap-2 px-4 pt-3 ${isOut ? "text-white/80" : "text-gray-400"}`}>
                        {msg.type === "IMAGE" ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                          : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="m15 10 5-3v10l-5-3M3 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>}
                        <span className="text-xs font-medium">{msg.type === "IMAGE" ? "Imagem" : "Vídeo"}</span>
                      </div>
                    )}
                    {msg.type === "AUDIO" && (
                      <div className="px-3 pt-3">
                        {false ? null : (
                          <div className={`flex items-center gap-2 ${isOut ? "text-white/80" : "text-gray-400"}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
                            <span className="text-xs font-medium">Áudio</span>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.type === "DOCUMENT" && (
                      <button type="button" onClick={() => downloadDocument(msg)} title="Baixar arquivo"
                        className={`flex items-center gap-2 px-4 pt-3 hover:underline ${isOut ? "text-white/80" : "text-gray-500 hover:text-brand-600"}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span className="text-xs font-medium truncate max-w-[180px]">{msg.content !== "[documento]" ? msg.content : "Documento"}</span>
                        {downloadingId === msg.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px] font-semibold">Baixar</span>}
                      </button>
                    )}
                    {/* Conteúdo/legenda */}
                    <div className="px-4 py-2.5">
                      {msg.type === "TEXT" && <p className="leading-relaxed whitespace-pre-wrap">{formatWhatsApp(msg.content)}</p>}
                      {msg.type === "INTERACTIVE" && (() => {
                        // Bot: "texto\n\n[ Botão 1 ]  [ Botão 2 ]" · Cliente: título do botão que tocou
                        const m = msg.content.match(/^([\s\S]*?)\n*((?:\[ [^\]]+ \]\s*)+)$/);
                        const body = m ? m[1] : msg.content;
                        const buttons = m ? [...m[2].matchAll(/\[ ([^\]]+) \]/g)].map((b) => b[1]) : [];
                        return (
                          <>
                            {!isOut && <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-gray-400">Tocou no botão</p>}
                            {body && <p className="leading-relaxed whitespace-pre-wrap">{formatWhatsApp(body)}</p>}
                            {buttons.length > 0 && (
                              <div className="flex flex-col gap-1 mt-2">
                                {buttons.map((b) => (
                                  <span key={b} className={`text-center text-xs font-medium rounded-lg py-1.5 ${isOut ? "bg-white/15" : "bg-gray-100"}`}>{b}</span>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {msg.type === "TEMPLATE" && (
                        <>
                          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isOut ? "text-white/70" : "text-gray-400"}`}>Template</p>
                          <p className="leading-relaxed whitespace-pre-wrap">{formatWhatsApp(msg.content)}</p>
                        </>
                      )}
                      {(msg.type === "IMAGE" || msg.type === "VIDEO") && msg.content && msg.content !== "[imagem]" && msg.content !== "[vídeo]" && !(msg.mediaUrl && msg.content === "[figurinha]") && (
                        <p className="leading-relaxed whitespace-pre-wrap text-xs mt-1 opacity-90">{msg.content}</p>
                      )}
                      <div className={`flex items-center justify-end gap-1 mt-0.5 ${isOut ? "text-white/70" : "text-gray-400"}`}>
                        <span className="text-[10px]">{new Date(msg.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {isOut && (msg.errorCode ? <span className="flex items-center gap-0.5 text-red-200 font-semibold" title={msg.errorCode === "131047" ? "Não entregue: o contato não falou com você nas últimas 24h. A Meta só permite enviar por template." : msg.errorMessage ? `Não entregue: ${msg.errorMessage}` : `Não entregue (erro ${msg.errorCode})`}><AlertCircle className="w-3 h-3" />{msg.errorCode === "131047" ? "Não entregue · fora das 24h" : "Não entregue"}</span> : msg.readAt ? <CheckCheck className="w-3 h-3 text-blue-300" /> : msg.deliveredAt ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
                      </div>
                    </div>
                  </div>
                  {/* Botão reply para mensagens outbound */}
                  {isOut && (
                    <button onClick={() => setReplyingTo(msg)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-gray-100 hover:bg-gray-200 shrink-0 mb-1">
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white border-t border-gray-200 px-3 py-3 shrink-0">
        {/* Preview de reply */}
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-brand-50 border-l-4 border-brand-500 rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-wide mb-0.5">
                {replyingTo.type === "IMAGE" ? "📷 Imagem" : replyingTo.type === "VIDEO" ? "🎥 Vídeo" : replyingTo.type === "AUDIO" ? "🎵 Áudio" : replyingTo.type === "DOCUMENT" ? "📄 Documento" : "Responder"}
              </p>
              <p className="text-xs text-gray-600 truncate">{replyingTo.content}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="shrink-0 p-0.5 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {suggestion !== null && (
          <div className="mb-2 rounded-2xl border border-brand-200 bg-brand-50/60 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><Sparkles className="w-4 h-4 text-brand-600" />Sugestão de resposta</p>
              <button onClick={() => { setSuggestion(null); setSuggestError(""); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-gray-500 mb-2">Revise e clique em "Usar esta resposta". Nada é enviado sem você.</p>
            {suggesting ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-3"><RefreshCw className="w-4 h-4 animate-spin" />Pensando…</div>
            ) : suggestError ? (
              <p className="text-sm text-red-600 py-2">{suggestError}</p>
            ) : (
              <textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} rows={3}
                className="w-full resize-none bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={applySuggestion} disabled={suggesting || !suggestion}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-40">Usar esta resposta</button>
              <button onClick={() => requestSuggestion(suggestion || undefined)} disabled={suggesting}
                className="px-3 py-1.5 text-xs font-semibold text-brand-700 bg-white border border-brand-200 rounded-xl hover:bg-brand-50 disabled:opacity-40">Outra opção</button>
            </div>
          </div>
        )}
        {suggestion === null && (
          <div className="flex items-center gap-1 mb-2 text-xs font-semibold">
            <button onClick={() => setNoteMode(false)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full ${!noteMode ? "bg-brand-50 text-brand-700 border border-brand-200" : "text-gray-500 hover:bg-gray-100 border border-transparent"}`}>
              <MessageCircle className="w-3.5 h-3.5" />Mensagem
            </button>
            <button onClick={() => { setNoteMode(true); setReplyingTo(null); textareaRef.current?.focus(); }}
              title="Só a equipe vê. Não vai para o WhatsApp."
              className={`flex items-center gap-1 px-3 py-1 rounded-full ${noteMode ? "bg-amber-50 text-amber-800 border border-amber-200" : "text-gray-500 hover:bg-gray-100 border border-transparent"}`}>
              <StickyNote className="w-3.5 h-3.5" />Nota interna
            </button>
            {noteMode && (
              <label className="ml-auto flex items-center gap-1 font-normal text-gray-500">
                Para:
                <select value={noteRecipient} onChange={(e) => setNoteRecipient(e.target.value)}
                  title="Escolha um colega para avisar no celular dele. O cliente não vê."
                  className="bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-xs font-semibold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="">Toda a equipe</option>
                  {signatures.filter((s) => s !== signature || s === noteRecipient).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
        {!noteMode && isInstagram && windowClosed && (messages.length > 0 || !loadingMsgs) ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="flex-1 text-sm text-amber-900">
              Passaram mais de 7 dias desde a última mensagem do contato no Direct. O Instagram só deixa responder depois que ele escrever de novo.
            </p>
          </div>
        ) : !noteMode && windowClosed && !writeAnyway && (messages.length > 0 || !loadingMsgs) ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 flex flex-wrap items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="flex-1 min-w-[180px] text-sm text-amber-900">
              Fora da janela de 24h: o contato não falou com você nesse período. O WhatsApp só permite enviar um template aprovado.
            </p>
            <button onClick={() => setShowTemplate(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700">
              <FileText className="w-4 h-4" />Enviar template
            </button>
            <button onClick={() => setWriteAnyway(true)} className="text-xs text-amber-800 underline">Escrever mesmo assim</button>
          </div>
        ) : (<>
        {humanAgentWindow && !noteMode && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mb-1.5">
            Fora das 24h: a resposta vai com a tag de atendimento humano do Instagram (vale até 7 dias depois da última mensagem do contato).
          </p>
        )}
        {suggestion === null && !noteMode && (
          <div className="flex justify-end gap-1.5 mb-1.5">
            {!isInstagram && <button onClick={() => setShowTemplate(true)} title="Enviar um template aprovado pela Meta"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100">
              <FileText className="w-3.5 h-3.5" />Template
            </button>}
            <button onClick={() => requestSuggestion()} title="A IA lê a conversa e sugere uma resposta (usa o que você já digitou)"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full hover:bg-brand-100">
              <Sparkles className="w-3.5 h-3.5" />Sugerir resposta
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sendingMedia || noteMode || isInstagram}
            title={isInstagram ? "Envio de arquivos pelo Instagram ainda não está disponível no CRM" : undefined}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-40"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <div className="relative" ref={emojiPickerRef}>
            <button
              onClick={() => setShowEmojiPicker(v => !v)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-20 w-64">
                <div className="grid grid-cols-8 gap-1">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { setNewMessage(prev => prev + emoji); setShowEmojiPicker(false); }}
                      className="text-xl hover:bg-gray-100 rounded-lg p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <select value={signature} onChange={(e) => handleSignatureChange(e.target.value)} title="Assinatura"
            className="max-w-[130px] h-[42px] bg-gray-50 border border-gray-200 rounded-2xl px-3 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Sem assinatura</option>
            {signatures.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__add">+ Novo nome…</option>
            {signature && <option value="__remove">Remover "{signature}"</option>}
          </select>
          <textarea value={newMessage} onChange={handleMessageChange} onKeyDown={handleKeyDown} onPaste={handlePaste}
            placeholder={noteMode ? (noteRecipient ? `Mensagem para ${noteRecipient}: o cliente não vê` : "Nota interna: só a equipe vê, não vai para o WhatsApp") : replyingTo ? "Digite sua resposta..." : "Digite uma mensagem..."}
            ref={textareaRef} rows={1} className={`flex-1 resize-none text-gray-900 placeholder:text-gray-400 border rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 max-h-60 overflow-y-auto ${noteMode ? "bg-amber-50 border-amber-200 focus:ring-amber-400" : "bg-gray-50 border-gray-200 focus:ring-brand-500"}`} style={{ minHeight: "42px" }} />
          {noteMode ? (
            <button onClick={saveNote} disabled={!newMessage.trim() || savingNote} title={noteRecipient ? `Avisar ${noteRecipient}` : "Salvar nota"}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-500 text-white text-xs font-semibold rounded-2xl hover:bg-amber-600 disabled:opacity-40 transition-colors">
              {savingNote ? <RefreshCw className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}{noteRecipient ? "Enviar" : "Salvar nota"}
            </button>
          ) : (
            <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="p-2.5 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 disabled:opacity-40 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        </>)}
      </div>
      {showTemplate && (
        <SendTemplateModal conversationId={selected.id} contactName={selected.contact?.name}
          onClose={() => setShowTemplate(false)}
          onSent={(msg) => { forceScrollRef.current = true; setMessages((prev) => [...prev, msg]); }} />
      )}
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
        {selected.contact.phone && <p className="text-xs text-gray-400 mt-0.5">{displayPhone(selected.contact.phone)}</p>}
        {selected.contact.instagramHandle && (
          <a href={`https://instagram.com/${selected.contact.instagramHandle}`} target="_blank" rel="noreferrer" className="text-xs text-pink-600 hover:underline mt-0.5 block">@{selected.contact.instagramHandle}</a>
        )}
        {contactInfo && (
          <div className="mt-3">
            {/* Lead ↔ Cliente: um clique troca o tipo do contato */}
            <div className="inline-flex rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
              <button onClick={() => contactInfo.type !== "LEAD" && patchContact({ type: "LEAD" })}
                className={`px-3 py-1 rounded-full transition-colors ${contactInfo.type === "LEAD" ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>Lead</button>
              <button onClick={() => contactInfo.type !== "CLIENT" && patchContact({ type: "CLIENT" })}
                className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${contactInfo.type === "CLIENT" ? "bg-green-500 text-white shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                <BadgeCheck className="w-3.5 h-3.5" />Cliente
              </button>
            </div>
            {contactInfo.type === "CLIENT" && (
              <div className="mt-2 space-y-1">
                {contactInfo.contracts?.map((ct) => (
                  <p key={ct.id} className="text-xs text-gray-700"><span className="font-semibold">{ct.clientName}</span> · {SERVICE_LABEL[ct.serviceType] ?? ct.serviceType}</p>
                ))}
                {contactInfo.clientSince && <p className="text-[11px] text-gray-400">Cliente desde {new Date(contactInfo.clientSince).toLocaleDateString("pt-BR")}</p>}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <Link href={`/dashboard/contatos/${selected.contact.id}`} className="flex-1 py-1.5 text-xs font-semibold text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50">Ver Perfil</Link>
          <button
            onClick={() => { setEditName(selected.contact.name); setEditPhone(selected.contact.phone ?? ""); setEditingContact(true); }}
            className="flex-1 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >Editar</button>
        </div>
      </div>
      {contactInfo && (() => {
        const ig = contactInfo.instagramHandle ? igHandle(contactInfo.instagramHandle) : "";
        const utms = [contactInfo.utmSource, contactInfo.utmMedium, contactInfo.utmCampaign].filter((v) => v && v !== "-");
        const rows: { label: string; value: ReactNode }[] = [];
        if (ig) rows.push({ label: "Instagram", value: (
          <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline flex items-center gap-1 min-w-0">
            <Instagram className="w-3.5 h-3.5 shrink-0" /><span className="truncate">@{ig}</span>
          </a>) });
        if (contactInfo.email) rows.push({ label: "E-mail", value: (
          <a href={`mailto:${contactInfo.email}`} className="text-brand-600 hover:underline flex items-center gap-1 min-w-0">
            <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{contactInfo.email}</span>
          </a>) });
        if (contactInfo.monthlyRevenue) rows.push({ label: "Faturamento", value: contactInfo.monthlyRevenue });
        if (contactInfo.saleModel) rows.push({ label: "Modelo de venda", value: contactInfo.saleModel });
        if (utms.length) rows.push({ label: "Origem", value: utms.join(" / ") });
        if (contactInfo.adHeadline) rows.push({ label: "Anúncio", value: contactInfo.adSourceUrl
          ? <a href={contactInfo.adSourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline flex items-center gap-1 min-w-0"><Megaphone className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{contactInfo.adHeadline}</span></a>
          : contactInfo.adHeadline });
        return rows.length > 0 && (
          <div className="p-4 border-b border-gray-100 space-y-2.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados do lead</p>
            {rows.map((r) => (
              <div key={r.label} className="min-w-0">
                <p className="text-[11px] text-gray-400">{r.label}</p>
                <div className="text-xs font-medium text-gray-700 break-words">{r.value}</div>
              </div>
            ))}
          </div>
        );
      })()}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {(contactInfo?.tags ?? selected.contact.tags ?? []).map((tag) => (
            <span key={tag} className="group text-xs bg-brand-50 text-brand-700 border border-brand-100 pl-2 pr-1 py-1 rounded-full flex items-center gap-0.5">
              {tag}
              {contactInfo && (
                <button onClick={() => patchContact({ tags: contactInfo.tags.filter((t) => t !== tag) })} title="Remover tag"
                  className="p-0.5 rounded-full text-brand-300 hover:text-brand-700 hover:bg-brand-100"><X className="w-3 h-3" /></button>
              )}
            </span>
          ))}
          {contactInfo && (
            <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } if (e.key === "Escape") setNewTag(""); }}
              onBlur={addTag} placeholder="+ tag"
              className="text-xs text-gray-900 placeholder:text-gray-400 w-20 focus:w-full px-2 py-1 rounded-full border border-dashed border-gray-200 focus:border-brand-300 focus:outline-none bg-transparent transition-all" />
          )}
        </div>
      </div>
      <div className="p-4 space-y-2.5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversa</p>
        <div className="flex justify-between"><span className="text-xs text-gray-400">Canal</span><div className="flex items-center gap-1">{channelIcon(selected.channel)}<span className="text-xs font-medium text-gray-700">{selected.channel}</span></div></div>
        <div className="flex justify-between"><span className="text-xs text-gray-400">Iniciada</span><span className="text-xs font-medium text-gray-700">{new Date(selected.createdAt).toLocaleDateString("pt-BR")}</span></div>
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
      <div className="lg:hidden flex flex-col w-full h-full" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
        {mobileView === "list" && ConvList}
        {mobileView === "chat" && ChatPanel}
        {mobileView === "info" && InfoPanel}
      </div>

      {/* Modal Editar Contato */}
      {editingContact && selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Editar contato</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefone (com DDI, ex: +5592985672491)</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+5585989011558"
                  className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {(editPhone.startsWith("lid:") || editPhone.includes("@lid")) && (
                  <p className="text-xs text-orange-600 mt-1">⚠️ Digite o número real para poder enviar mensagens</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditingContact(false)} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">Cancelar</button>
              <button
                onClick={saveContact}
                disabled={savingContact || !editName.trim()}
                className="flex-1 py-2 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50"
              >{savingContact ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2" onClick={() => setLightboxUrl(null)}>
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="imagem"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Modal Nova Conversa */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Nova Conversa</h2>
              <button onClick={() => setShowNewConv(false)} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">WhatsApp *</label>
                <input value={newConvPhone} onChange={(e) => setNewConvPhone(e.target.value)}
                  placeholder="+55 85 99999-9999"
                  className="w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome (opcional)</label>
                <input value={newConvName} onChange={(e) => setNewConvName(e.target.value)}
                  placeholder="Nome do contato"
                  className="w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Primeira mensagem (opcional)</label>
                <textarea value={newConvMessage} onChange={(e) => setNewConvMessage(e.target.value)}
                  placeholder="Olá! Vi seu cadastro em nosso site..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewConv(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={startConversation} disabled={!newConvPhone.trim() || startingConv}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50">
                {startingConv ? "Iniciando..." : "Iniciar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConversasPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    }>
      <ConversasInner />
    </Suspense>
  );
}
