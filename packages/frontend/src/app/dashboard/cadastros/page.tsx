"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check, ClipboardList, Copy, ExternalLink, Link2, Loader2, MessageCircle, Plus, Search, Trash2, User, X,
} from "lucide-react";
import api from "@/lib/api";

interface Profile {
  id: string; token: string; url: string; message: string;
  status: "PENDING" | "COMPLETE"; clientStatus: "ACTIVE" | "INACTIVE"; source: "LINK" | "SHEET" | "CRM";
  name: string; brand: string | null; legalName: string | null; cnpj: string | null; cpf: string | null;
  email: string | null; emailAlt: string | null; phone: string | null; instagram: string | null;
  zipCode: string | null; street: string | null; number: string | null; complement: string | null;
  neighborhood: string | null; city: string | null; state: string | null; birthday: string | null;
  story: string | null; feedback: string | null; notes: string | null;
  linkSentAt: string | null; submittedAt: string | null; createdAt: string; updatedAt: string;
  contactId: string | null; contact: { id: string; name: string } | null;
}

const FILTERS = [
  { key: "ACTIVE", label: "Ativos" },
  { key: "INACTIVE", label: "Inativos" },
  { key: "PENDING", label: "Aguardando ficha" },
  { key: "ALL", label: "Todos" },
] as const;

const SOURCE_LABEL = { LINK: "Link", SHEET: "Planilha antiga", CRM: "CRM" };
const errMsg = (e: any) => e?.response?.data?.message ?? e?.message ?? "Algo deu errado.";
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtPhone = (p: string | null) => {
  const d = (p ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p ?? "";
};
const fmtCnpj = (v: string | null) => (v && v.length === 14 ? v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v ?? "");
const fmtCpf = (v: string | null) => (v && v.length === 11 ? v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : v ?? "");
const fmtBirthday = (b: string | null) => (b ? b.split("-").reverse().join("/") : "");
/** Link do WhatsApp com a mensagem pronta (sem número: o WhatsApp pergunta para quem mandar). */
const waLink = (phone: string | null, text: string) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return `https://wa.me/${d.length >= 12 ? d : ""}?text=${encodeURIComponent(text)}`;
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 1800); });
  };
  return { copied, copy };
}

function Badge({ tone, children }: { tone: "green" | "slate" | "amber" | "blue"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    slate: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    blue: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{children}</span>;
}

/** Tela "Cadastros": substitui o Google Forms. Gera o link da ficha, mostra quem preencheu e guarda os dados. */
export default function CadastrosPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <Cadastros />
    </Suspense>
  );
}

function Cadastros() {
  const router = useRouter();
  const params = useSearchParams();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ACTIVE");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const openId = params.get("id");
  const { copied, copy } = useCopy();

  const load = useCallback(() => {
    api.get("/client-profiles").then((r) => setRows(r.data)).catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      ACTIVE: r.filter((p) => p.clientStatus === "ACTIVE").length,
      INACTIVE: r.filter((p) => p.clientStatus === "INACTIVE").length,
      PENDING: r.filter((p) => p.status === "PENDING").length,
      ALL: r.length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const q = norm(search.trim());
    return (rows ?? [])
      .filter((p) => filter === "ALL" || (filter === "PENDING" ? p.status === "PENDING" : p.clientStatus === filter))
      .filter((p) => !q || norm([p.brand, p.name, p.legalName, p.email, p.phone, p.cnpj, p.cpf, p.city, p.instagram].filter(Boolean).join(" ")).includes(q))
      .sort((a, b) => (a.brand || a.name).localeCompare(b.brand || b.name, "pt-BR"));
  }, [rows, filter, search]);

  const selected = rows?.find((p) => p.id === openId) ?? null;
  const open = (id: string | null) => router.replace(id ? `/dashboard/cadastros?id=${id}` : "/dashboard/cadastros", { scroll: false });

  const markSent = (p: Profile) => {
    api.patch(`/client-profiles/${p.id}`, { linkSent: true }).then(load).catch(() => {});
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="w-6 h-6" /> Cadastros de clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Mande o link da ficha para o cliente novo. Quando ele preenche, os dados caem aqui e no contato.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
          <Plus className="w-4 h-4" /> Novo link de cadastro
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm border ${filter === f.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {f.label} <span className="opacity-70">{counts[f.key]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Marca, nome, CNPJ, cidade..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!rows && !error && <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

      {rows && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Marca / responsável</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Contato</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">CNPJ / CPF</th>
                  <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Cidade</th>
                  <th className="text-left font-medium px-4 py-3">Situação</th>
                  <th className="text-right font-medium px-4 py-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} onClick={() => open(p.id)} className="border-b border-border/60 last:border-0 hover:bg-muted/40 cursor-pointer">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{p.brand || p.name}</p>
                      {p.brand && <p className="text-xs text-muted-foreground">{p.name}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p>{fmtPhone(p.phone)}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px]">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{fmtCnpj(p.cnpj) || fmtCpf(p.cpf) || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{[p.city, p.state].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.clientStatus === "ACTIVE" ? <Badge tone="green">Ativo</Badge> : <Badge tone="slate">Inativo</Badge>}
                        {p.status === "PENDING" && <Badge tone="amber">{p.linkSentAt ? "Link enviado" : "Falta a ficha"}</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button title="Copiar link" onClick={() => { copy(p.id, p.url); markSent(p); }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                        {copied === p.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a title="Mandar pelo WhatsApp" href={waLink(p.phone, p.message)} target="_blank" rel="noreferrer" onClick={() => markSent(p)}
                        className="inline-flex p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-500">
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum cadastro aqui.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && <NewLinkModal onClose={() => setShowNew(false)} onCreated={load} />}
      {selected && <ProfileDrawer key={selected.id} p={selected} onClose={() => open(null)} onSaved={load} />}
    </div>
  );
}

/** Gera o link: para um cliente que já está no CRM (busca) ou para um cliente novo (nome e WhatsApp). */
function NewLinkModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<"new" | "contact">("new");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [phone, setPhone] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Profile | null>(null);
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (mode !== "contact" || q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => {
      api.get("/contacts", { params: { search: q.trim(), limit: 8 } }).then((r) => setFound(r.data?.contacts ?? [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  const create = async (body: Record<string, string>) => {
    setSaving(true);
    setError("");
    try {
      const r = await api.post("/client-profiles", body);
      setCreated(r.data);
      onCreated();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full px-3 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Link2 className="w-5 h-5" /> Link de cadastro</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        {created ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pronto! Mande para <b className="text-foreground">{created.name}</b>:</p>
            <pre className="whitespace-pre-wrap text-sm bg-muted/50 border border-border rounded-xl p-3 font-sans">{created.message}</pre>
            <div className="flex flex-wrap gap-2">
              <a href={waLink(created.phone, created.message)} target="_blank" rel="noreferrer"
                onClick={() => api.patch(`/client-profiles/${created.id}`, { linkSent: true }).then(onCreated).catch(() => {})}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:opacity-90">
                <MessageCircle className="w-4 h-4" /> Abrir no WhatsApp
              </a>
              <button onClick={() => copy("msg", created.message)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">
                {copied === "msg" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} Copiar mensagem
              </button>
              <button onClick={() => copy("url", created.url)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-muted">
                {copied === "url" ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />} Só o link
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-1 p-1 bg-muted/50 rounded-xl text-sm">
              {([["new", "Cliente novo"], ["contact", "Já está no CRM"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMode(k)} className={`flex-1 py-2 rounded-lg ${mode === k ? "bg-card shadow font-semibold" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>

            {mode === "new" ? (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create({ name, brand, phone }); }}>
                <input className={inp} placeholder="Nome do responsável" value={name} onChange={(e) => setName(e.target.value)} />
                <input className={inp} placeholder="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
                <input className={inp} placeholder="WhatsApp com DDD (opcional)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <p className="text-xs text-muted-foreground">O cliente completa o resto na ficha. Se o WhatsApp já for de um contato, a ficha se liga a ele quando for enviada.</p>
                <button disabled={saving} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Gerar link
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                <input className={inp} placeholder="Buscar contato por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                <div className="max-h-64 overflow-y-auto divide-y divide-border">
                  {found.map((c) => (
                    <button key={c.id} disabled={saving} onClick={() => create({ contactId: c.id })}
                      className="w-full text-left px-2 py-2.5 hover:bg-muted rounded-lg flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{fmtPhone(c.phone ?? null)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Se o contato já tem ficha, mostramos o link dele.</p>
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

const FIELDS: { key: keyof Profile; label: string; wide?: boolean; area?: boolean; fmt?: (v: string | null) => string }[] = [
  { key: "name", label: "Responsável" },
  { key: "brand", label: "Marca" },
  { key: "legalName", label: "Razão social", wide: true },
  { key: "cnpj", label: "CNPJ", fmt: fmtCnpj },
  { key: "cpf", label: "CPF", fmt: fmtCpf },
  { key: "phone", label: "WhatsApp", fmt: fmtPhone },
  { key: "instagram", label: "Instagram" },
  { key: "email", label: "E-mail" },
  { key: "emailAlt", label: "E-mail alternativo" },
  { key: "birthday", label: "Aniversário (dd/mm)", fmt: fmtBirthday },
  { key: "zipCode", label: "CEP" },
  { key: "street", label: "Rua", wide: true },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "story", label: "História da marca", wide: true, area: true },
  { key: "feedback", label: "Recado para a Dua", wide: true, area: true },
  { key: "notes", label: "Observação interna", wide: true, area: true },
];

/** Ficha completa: ver, corrigir, marcar ativo/inativo e reenviar o link. */
function ProfileDrawer({ p, onClose, onSaved }: { p: Profile; onClose: () => void; onSaved: () => void }) {
  const initial = () => Object.fromEntries(FIELDS.map((f) => [f.key, f.fmt ? f.fmt(p[f.key] as string | null) : ((p[f.key] as string | null) ?? "")])) as Record<string, string>;
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { copied, copy } = useCopy();

  const save = async (extra?: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = extra ?? {
        ...form,
        birthday: form.birthday ? form.birthday.split("/").reverse().map((x) => x.padStart(2, "0")).join("-") : "",
      };
      await api.patch(`/client-profiles/${p.id}`, body);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Apagar a ficha de ${p.brand || p.name}? O contato no CRM continua.`)) return;
    await api.delete(`/client-profiles/${p.id}`).then(() => { onClose(); onSaved(); }).catch((e) => setError(errMsg(e)));
  };

  const inp = "w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <aside className="bg-card border-l border-border w-full max-w-xl h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start gap-3 z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{p.brand || p.name}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {p.clientStatus === "ACTIVE" ? <Badge tone="green">Ativo</Badge> : <Badge tone="slate">Inativo</Badge>}
              {p.status === "COMPLETE" ? <Badge tone="blue">Ficha completa</Badge> : <Badge tone="amber">Falta a ficha</Badge>}
              <span className="text-[11px] text-muted-foreground">
                Origem: {SOURCE_LABEL[p.source]} · {p.submittedAt ? `preenchida em ${fmtDate(p.submittedAt)}` : p.linkSentAt ? `link enviado em ${fmtDate(p.linkSentAt)}` : `criada em ${fmtDate(p.createdAt)}`}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <a href={waLink(p.phone, p.message)} target="_blank" rel="noreferrer"
              onClick={() => api.patch(`/client-profiles/${p.id}`, { linkSent: true }).then(onSaved).catch(() => {})}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:opacity-90">
              <MessageCircle className="w-4 h-4" /> {p.status === "COMPLETE" ? "Pedir atualização" : "Mandar link"}
            </a>
            <button onClick={() => copy("url", p.url)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              {copied === "url" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} Copiar link
            </button>
            <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              <ExternalLink className="w-4 h-4" /> Abrir ficha
            </a>
            {p.contactId && (
              <a href={`/dashboard/contatos/${p.contactId}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                <User className="w-4 h-4" /> Contato
              </a>
            )}
            <button disabled={saving} onClick={() => save({ clientStatus: p.clientStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
              className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              Marcar como {p.clientStatus === "ACTIVE" ? "inativo" : "ativo"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</p>
                {editing ? (
                  f.area
                    ? <textarea rows={3} className={`${inp} mt-1`} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
                    : <input className={`${inp} mt-1`} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
                ) : (
                  <p className={`text-sm mt-0.5 ${f.area ? "whitespace-pre-wrap" : "break-words"}`}>{form[f.key] || <span className="text-muted-foreground">—</span>}</p>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {editing ? (
              <>
                <button disabled={saving} onClick={() => save()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
                </button>
                <button onClick={() => { setForm(initial()); setEditing(false); }} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Cancelar</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">Editar dados</button>
            )}
            <button onClick={remove} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4" /> Apagar ficha
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
