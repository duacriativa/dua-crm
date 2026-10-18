import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Dua CRM",
  description: "Como a Dua Criativa trata os dados no Dua CRM e no atendimento via WhatsApp.",
};

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Quem somos",
    body: [
      "O Dua CRM é a ferramenta interna de atendimento e gestão comercial da Dua Criativa (duacriativa.com.br). Esta política explica quais dados tratamos quando você conversa com a Dua pelo WhatsApp ou preenche nossos formulários.",
    ],
  },
  {
    title: "2. Dados que coletamos",
    body: [
      "Nome e número de telefone informados no WhatsApp, e a foto de perfil quando disponível.",
      "O conteúdo das mensagens trocadas com a Dua (textos, áudios, imagens, vídeos e documentos).",
      "Dados enviados em formulários: e-mail, @ do Instagram, faturamento, modelo de venda e origem da campanha (UTM).",
    ],
  },
  {
    title: "3. Para que usamos",
    body: [
      "Responder seu atendimento e dar continuidade às conversas.",
      "Organizar o relacionamento comercial (funil de vendas, propostas, contratos e cobranças).",
      "Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing.",
    ],
  },
  {
    title: "4. Com quem compartilhamos",
    body: [
      "Meta Platforms (WhatsApp Business Platform), que transmite as mensagens.",
      "Provedores de infraestrutura que hospedam o sistema (servidores e banco de dados), sob obrigação de confidencialidade.",
      "Asaas, apenas para clientes com cobrança ativa.",
    ],
  },
  {
    title: "5. Armazenamento e segurança",
    body: [
      "Os dados ficam em servidores com acesso restrito à equipe da Dua, protegidos por autenticação. Credenciais de integração são armazenadas criptografadas.",
      "Mantemos os dados enquanto houver relacionamento comercial ou obrigação legal, e os excluímos quando deixam de ser necessários.",
    ],
  },
  {
    title: "6. Seus direitos (LGPD)",
    body: [
      "Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento.",
      "Para solicitar a exclusão, envie no WhatsApp da Dua a mensagem \"EXCLUIR MEUS DADOS\" ou fale com a gente pelo site duacriativa.com.br. Atendemos em até 15 dias.",
    ],
  },
  {
    title: "7. Alterações",
    body: ["Podemos atualizar esta política. A versão vigente fica sempre publicada nesta página."],
  },
];

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12">
      <article className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-10">Dua Criativa · Dua CRM · atualizada em 18/10/2026</p>
        {SECTIONS.map((s) => (
          <section key={s.title} id={s.title.startsWith("6") ? "exclusao" : undefined} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{s.title}</h2>
            <ul className="space-y-2 text-sm leading-relaxed text-foreground/80">
              {s.body.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </section>
        ))}
      </article>
    </main>
  );
}
