"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, Copy, Download, Loader2, Timer } from "lucide-react";

interface Order {
  productName: string;
  value: number;
  name: string;
  instagramHandle: string;
  status: "AWAITING_PAYMENT" | "IN_PRODUCTION" | "IN_REVIEW" | "DELIVERED" | "CANCELED";
  paid: boolean;
  paidAt: string | null;
  dueAt: string | null;
  deliveryHours: number;
  pix: { payload: string | null; qrImage: string | null; expiresAt: string | null } | null;
  pdfUrl: string | null;
}

const LIME = "#B5FB3D";
const WHATSAPP = "558589011558";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0 });
const when = (s: string) =>
  new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 px-4 py-6 sm:py-12">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2.5 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.svg" alt="" className="w-8 h-8 rounded-md" />
          <span className="font-bold tracking-tight">Dua Criativa</span>
        </div>
        {children}
        <p className="text-center text-[11px] text-neutral-400 mt-6">
          Dúvidas? <a className="underline" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">Fale com a Dua no WhatsApp</a>
        </p>
      </div>
    </main>
  );
}

/** Acompanhamento do pedido: Pix enquanto não pagou, depois o prazo e, aprovado, o PDF. */
export default function PedidoPage({ params }: { params: { token: string } }) {
  const [o, setO] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch(`/api/v1/public/plano/pedido/${encodeURIComponent(params.token)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: Order) => {
          if (stop) return;
          setO(d);
          // Enquanto espera o Pix, confere a cada 5s; depois, a cada minuto
          timer = setTimeout(load, d.status === "AWAITING_PAYMENT" ? 5000 : 60_000);
        })
        .catch((s) => {
          if (s === 404) setNotFound(true);
          else if (!stop) timer = setTimeout(load, 10_000);
        });
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [params.token]);

  const copy = async () => {
    if (!o?.pix?.payload) return;
    await navigator.clipboard.writeText(o.pix.payload).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (notFound) {
    return <Shell><div className="bg-white rounded-2xl shadow-sm p-8 text-center"><p className="font-semibold">Pedido não encontrado.</p><p className="text-sm text-neutral-500 mt-1">Confira o link ou fale com a gente.</p></div></Shell>;
  }
  if (!o) return <Shell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div></Shell>;

  if (o.status === "CANCELED") {
    return <Shell><div className="bg-white rounded-2xl shadow-sm p-8 text-center"><p className="font-semibold">Este pedido foi cancelado.</p><p className="text-sm text-neutral-500 mt-1">Se foi um engano, fale com a gente pelo WhatsApp.</p></div></Shell>;
  }

  if (o.status === "AWAITING_PAYMENT" && o.pix) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <p className="text-sm text-neutral-500">{o.productName} · @{o.instagramHandle}</p>
          <h1 className="text-2xl font-black tracking-tight mt-1">Pague {brl(o.value)} no Pix</h1>
          <p className="text-sm text-neutral-600 mt-2">
            Abra o app do seu banco, escolha <b>Pix → Ler QR Code</b> ou <b>Pix copia e cola</b>. A confirmação aparece aqui sozinha.
          </p>
          {o.pix.qrImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${o.pix.qrImage}`} alt="QR Code do Pix" className="w-56 h-56 mx-auto mt-6 rounded-lg border border-neutral-200" />
          )}
          {o.pix.payload && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-neutral-500 mb-1.5">Pix copia e cola</p>
              <div className="flex gap-2">
                <input readOnly value={o.pix.payload} onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 px-3 py-2.5 text-xs font-mono bg-neutral-100 border border-neutral-200 rounded-lg" />
                <button onClick={copy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-neutral-950 text-white text-sm font-semibold shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          )}
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-neutral-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Aguardando o pagamento...
          </p>
        </div>
      </Shell>
    );
  }

  const ready = !!o.pdfUrl;
  return (
    <Shell>
      <div className="bg-neutral-950 text-white rounded-2xl p-6 sm:p-8">
        <CheckCircle2 className="w-10 h-10" style={{ color: LIME }} />
        <h1 className="text-2xl font-black tracking-tight mt-4">
          {ready ? "Seu plano está pronto!" : "Pagamento confirmado!"}
        </h1>
        <p className="text-white/70 mt-2 leading-relaxed">
          {ready
            ? `O ${o.productName} da @${o.instagramHandle} foi revisado pela nossa equipe. Baixe o PDF abaixo: ele também vai chegar no seu WhatsApp.`
            : `Obrigado, ${o.name.split(" ")[0]}! A equipe da Dua já está montando o ${o.productName} da @${o.instagramHandle}.`}
        </p>
        {!ready && o.dueAt && (
          <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-white/10">
            <Timer className="w-4 h-4" style={{ color: LIME }} /> Entrega até {when(o.dueAt)} no seu WhatsApp
          </p>
        )}
        {ready && (
          <a href={o.pdfUrl!} download className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-neutral-950" style={{ background: LIME }}>
            <Download className="w-4 h-4" /> Baixar o plano em PDF
          </a>
        )}
      </div>
      {!ready && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mt-4 text-sm text-neutral-600 leading-relaxed">
          Você pode fechar esta página. Guarde o link se quiser acompanhar: quando o plano for aprovado, o botão para baixar o PDF aparece aqui.
        </div>
      )}
    </Shell>
  );
}
