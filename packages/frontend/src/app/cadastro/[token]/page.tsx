"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type Form = Record<
  "name" | "brand" | "legalName" | "cnpj" | "cpf" | "email" | "emailAlt" | "phone" | "instagram" | "zipCode" |
  "street" | "number" | "complement" | "neighborhood" | "city" | "state" | "birthday" | "story" | "feedback",
  string
>;

const EMPTY: Form = {
  name: "", brand: "", legalName: "", cnpj: "", cpf: "", email: "", emailAlt: "", phone: "", instagram: "", zipCode: "",
  street: "", number: "", complement: "", neighborhood: "", city: "", state: "", birthday: "", story: "", feedback: "",
};

const LIME = "#B5FB3D";
const inp = "w-full px-3 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 placeholder:text-neutral-400";
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

const digits = (v: string) => v.replace(/\D/g, "");
const cnpjMask = (v: string) => digits(v).slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
const cpfMask = (v: string) => digits(v).slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const cepMask = (v: string) => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
const phoneMask = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="block text-xs text-neutral-500 mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6">
      <h2 className="font-bold text-base mb-4">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="bg-neutral-950 text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-10">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-md" />
            <span className="font-bold tracking-tight">Dua Criativa</span>
          </div>
          <h1 className="mt-8 text-2xl sm:text-3xl font-black leading-tight">Ficha de cadastro</h1>
          <p className="mt-2 text-sm text-white/70 max-w-md">
            Esses dados vão para o contrato, as notas fiscais e o nosso atendimento. Leva uns 3 minutos.
          </p>
        </div>
      </header>
      {children}
      <footer className="text-center text-[11px] text-neutral-400 py-8 px-4">
        Dua Criativa · Marketing para marcas de moda · Fortaleza
      </footer>
    </main>
  );
}

/** Ficha que o cliente novo preenche pelo link que a equipe manda (tela Cadastros do CRM). */
export default function CadastroPage({ params }: { params: { token: string } }) {
  const [f, setF] = useState<Form | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/public/cadastro/${encodeURIComponent(params.token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: { status: string; data: Form }) => {
        const d = { ...EMPTY, ...r.data };
        setF({ ...d, cnpj: cnpjMask(d.cnpj), cpf: cpfMask(d.cpf), zipCode: cepMask(d.zipCode), phone: phoneMask(d.phone) });
        if (r.status === "COMPLETE") setUpdating(true);
      })
      .catch(() => setNotFound(true));
  }, [params.token]);

  const set = (k: keyof Form, mask?: (v: string) => string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => (s ? { ...s, [k]: mask ? mask(e.target.value) : e.target.value } : s));

  // CEP completo: busca rua, bairro, cidade e estado
  const lookupCep = async (cep: string) => {
    if (digits(cep).length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits(cep)}/json/`).then((x) => x.json());
      if (r?.erro) return;
      setF((s) => s && {
        ...s,
        street: s.street || r.logradouro || "", neighborhood: s.neighborhood || r.bairro || "",
        city: s.city || r.localidade || "", state: s.state || r.uf || "",
      });
    } catch { /* sem internet ou ViaCEP fora: o cliente digita */ }
  };

  const [bMonth, bDay] = (f?.birthday || "-").split("-");
  const setBirthday = (month: string, day: string) => setF((s) => s && { ...s, birthday: month && day ? `${month}-${day}` : "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/public/cadastro/${encodeURIComponent(params.token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
        throw new Error(res.status === 429 ? "Muitas tentativas. Aguarde um minuto." : msg || "Algo deu errado. Tente de novo.");
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (notFound) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-4 pt-16 text-center">
          <p className="font-semibold">Link de cadastro não encontrado.</p>
          <p className="text-sm text-neutral-500 mt-1">Confira o link que você recebeu ou fale com a gente pelo WhatsApp.</p>
        </div>
      </Shell>
    );
  }
  if (!f) return <Shell><div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div></Shell>;

  if (done) {
    return (
      <Shell>
        <div className="max-w-md mx-auto px-4 -mt-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: "#65a30d" }} />
            <p className="mt-4 text-lg font-bold">Cadastro recebido!</p>
            <p className="text-sm text-neutral-500 mt-1">Obrigada, {f.name.split(" ")[0]}. Agora é com a gente 💚</p>
            <button onClick={() => { setDone(false); setUpdating(true); }} className="mt-6 text-sm underline text-neutral-500">Corrigir alguma informação</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} className="max-w-2xl mx-auto px-4 sm:px-6 -mt-6 space-y-4">
        {updating && (
          <p className="bg-white rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-600">
            Você já enviou essa ficha. Pode corrigir o que quiser e enviar de novo.
          </p>
        )}

        <Section title="Sobre você">
          <Field label="Nome completo do responsável"><input required className={inp} value={f.name} onChange={set("name")} autoComplete="name" /></Field>
          <Field label="WhatsApp"><input required className={inp} value={f.phone} inputMode="tel" placeholder="(85) 99999-9999" onChange={set("phone", phoneMask)} autoComplete="tel" /></Field>
          <Field label="E-mail"><input required type="email" className={inp} value={f.email} onChange={set("email")} autoComplete="email" /></Field>
          <Field label="E-mail alternativo" hint="Opcional (financeiro, sócio...)"><input type="email" className={inp} value={f.emailAlt} onChange={set("emailAlt")} /></Field>
          <Field label="CPF" hint="Do responsável">
            <input className={inp} value={f.cpf} inputMode="numeric" placeholder="000.000.000-00" onChange={set("cpf", cpfMask)} />
          </Field>
          <Field label="Quando é seu aniversário?" hint="Só dia e mês">
            <div className="flex gap-2">
              <select className={inp} value={bDay || ""} onChange={(e) => setBirthday(bMonth, e.target.value)}>
                <option value="">Dia</option>
                {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => <option key={d} value={d}>{Number(d)}</option>)}
              </select>
              <select className={inp} value={bMonth || ""} onChange={(e) => setBirthday(e.target.value, bDay)}>
                <option value="">Mês</option>
                {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select>
            </div>
          </Field>
        </Section>

        <Section title="Sobre a marca">
          <Field label="Nome da marca"><input required className={inp} value={f.brand} onChange={set("brand")} /></Field>
          <Field label="Instagram da marca">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">@</span>
              <input className={`${inp} pl-7`} value={f.instagram} placeholder="suamarca" onChange={set("instagram")} autoCapitalize="none" />
            </div>
          </Field>
          <Field label="Razão social"><input className={inp} value={f.legalName} onChange={set("legalName")} /></Field>
          <Field label="CNPJ" hint="Se não tiver, deixe em branco e informe o CPF">
            <input className={inp} value={f.cnpj} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={set("cnpj", cnpjMask)} />
          </Field>
          <Field label="Conta um pouco da história da marca" hint="Como começou, o que vende, para quem. Ajuda muito o nosso time." className="sm:col-span-2">
            <textarea rows={4} className={inp} value={f.story} onChange={set("story")} />
          </Field>
        </Section>

        <Section title="Endereço">
          <Field label="CEP">
            <input required className={inp} value={f.zipCode} inputMode="numeric" placeholder="00000-000"
              onChange={(e) => { const v = cepMask(e.target.value); setF((s) => s && { ...s, zipCode: v }); lookupCep(v); }} />
          </Field>
          <Field label="Rua / Avenida"><input required className={inp} value={f.street} onChange={set("street")} autoComplete="address-line1" /></Field>
          <Field label="Número"><input required className={inp} value={f.number} onChange={set("number")} /></Field>
          <Field label="Complemento" hint="Opcional"><input className={inp} value={f.complement} onChange={set("complement")} /></Field>
          <Field label="Bairro"><input className={inp} value={f.neighborhood} onChange={set("neighborhood")} /></Field>
          <Field label="Cidade"><input required className={inp} value={f.city} onChange={set("city")} autoComplete="address-level2" /></Field>
          <Field label="Estado">
            <select required className={inp} value={f.state} onChange={set("state")}>
              <option value="">Selecione</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
        </Section>

        <Section title="Para a Dua">
          <Field label="Quer deixar algum recado para a gente?" hint="Opcional" className="sm:col-span-2">
            <textarea rows={3} className={inp} value={f.feedback} onChange={set("feedback")} />
          </Field>
        </Section>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

        <button type="submit" disabled={sending}
          className="w-full py-3.5 rounded-xl font-bold text-neutral-950 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: LIME }}>
          {sending && <Loader2 className="w-4 h-4 animate-spin" />}
          {updating ? "Atualizar cadastro" : "Enviar cadastro"}
        </button>
        <p className="text-[11px] text-neutral-400 text-center">Seus dados ficam só com a Dua Criativa e são usados para o nosso contrato e atendimento.</p>
      </form>
    </Shell>
  );
}
