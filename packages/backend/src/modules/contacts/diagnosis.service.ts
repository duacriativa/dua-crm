import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InstagramDiagnosis } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { appUrl } from '../scheduling/scheduling.service';
import { askClaude, parseJsonObject } from './claude';
import { InstagramProfileService } from './instagram-profile.service';

/** Página de agendamento para onde o CTA do diagnóstico leva. */
const BOOKING_SLUG = process.env.DIAGNOSIS_BOOKING_SLUG || 'especialista';
/** WhatsApp da Dua que aparece no PDF. */
export const DUA_WHATSAPP = process.env.DIAGNOSIS_CONTACT_WHATSAPP || '(85) 8901-1558';

export interface DiagnosisMetrics {
  seguidores: number | null;
  posts: number | null;
  engajamento: string | null; // média de curtidas + comentários por post ÷ seguidores
  melhorPost: { data: string | null; formato: string; curtidas: number; comentarios: number; legenda: string } | null;
}

export interface DiagnosisContent {
  resumo: string;
  nota_explicacao: string;
  pontos_fortes: string[];
  oportunidades: string[];
  proximos_passos: { titulo: string; descricao: string }[];
  metricas: DiagnosisMetrics | null;
  sourceHash?: string; // hash da análise de origem: mesma análise → reaproveita o diagnóstico
}

/** Frase da nota sempre positiva: o diagnóstico é para nutrir, não para assustar. */
export function scoreLabel(score: number) {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Muito bom';
  if (score >= 50) return 'Bom começo';
  return 'Muito espaço para crescer';
}

export const bookingUrl = () => `${appUrl()}/agendar/${BOOKING_SLUG}`;

/**
 * Oferta do produto pago (plano de 3 meses, página /plano-90-dias). Mesmas variáveis e padrões do
 * plan.config.ts do módulo de planos, para trocar nome, preço e prazo sem mexer no código.
 * `?d=<token>` faz a página de venda preencher os dados do contato.
 */
export function planOffer(token: string) {
  const price = Number(process.env.PLAN_PRICE || 297);
  const path = `/plano-90-dias?d=${encodeURIComponent(token)}`;
  return {
    name: process.env.PLAN_PRODUCT_NAME || 'Plano de Conteúdo 90 Dias',
    priceLabel: price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: Number.isInteger(price) ? 0 : 2 }),
    deliveryHours: Number(process.env.PLAN_DELIVERY_HOURS || 24),
    pitch: 'Um plano de 3 meses só para a sua marca: o que postar, roteiros, stories e o que contratar.',
    path,
    url: `${appUrl()}${path}`,
  };
}

/**
 * "Diagnóstico gratuito" do Instagram para nutrir leads: reescreve a análise interna
 * (que tem alertas duros e estratégia de venda) num texto para o próprio cliente ler.
 * Sai como página pública /diagnostico/[token], PDF e texto para colar no WhatsApp Business.
 */
@Injectable()
export class DiagnosisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramProfile: InstagramProfileService,
  ) {}

  url(token: string) { return `${appUrl()}/diagnostico/${token}`; }

  /**
   * Devolve o diagnóstico da análise atual (do corpo ou a salva no contato). Se a análise não
   * mudou desde o último, reaproveita; `force` gera um texto novo mesmo assim.
   */
  async ensure(tenantId: string, contactId: string, analysisText?: string, force = false) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, name: true, phone: true, instagramHandle: true, analysisInstagram: true },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    if (!contact.instagramHandle) throw new BadRequestException('Contato sem Instagram cadastrado.');

    const raw = analysisText?.trim() || contact.analysisInstagram || '';
    const analysis = parseJsonObject(raw);
    if (!analysis) throw new BadRequestException('Gere a análise do Instagram antes do diagnóstico.');
    const score = typeof analysis.score === 'number' ? Math.max(0, Math.min(100, Math.round(analysis.score))) : null;
    if (score === null) {
      throw new BadRequestException('A análise não tem dados reais do perfil (sem nota): o diagnóstico ficaria genérico. Gere de novo quando o perfil estiver acessível.');
    }

    const sourceHash = crypto.createHash('sha256').update(JSON.stringify(analysis)).digest('hex').slice(0, 32);
    if (!force) {
      const last = await this.prisma.instagramDiagnosis.findFirst({ where: { tenantId, contactId }, orderBy: { createdAt: 'desc' } });
      if (last && (last.content as any)?.sourceHash === sourceHash) return this.teamView(last, contact);
    }

    const handle = contact.instagramHandle.replace(/^@/, '').trim();
    const profile = await this.instagramProfile.fetch(handle.toLowerCase());
    const metricas = profile.data ? this.metrics(profile.data) : null;
    const content = await this.rewriteForClient(handle, analysis, metricas);

    const diagnosis = await this.prisma.instagramDiagnosis.create({
      data: {
        tenantId, contactId: contact.id, instagramHandle: handle, score,
        content: { ...content, metricas, sourceHash } as any, token: crypto.randomBytes(24).toString('base64url'),
      },
    });
    return this.teamView(diagnosis, contact);
  }

  /** Último diagnóstico do contato (para o CRM mostrar o link e se o cliente abriu). */
  async latest(tenantId: string, contactId: string) {
    const d = await this.prisma.instagramDiagnosis.findFirst({
      where: { tenantId, contactId },
      orderBy: { createdAt: 'desc' },
      include: { contact: { select: { name: true, phone: true } } },
    });
    return d ? this.teamView(d, d.contact) : null;
  }

  /** Busca pelo token (página pública e PDF). Visitas com preview (a equipe conferindo) não contam como abertura. */
  async byToken(token: string, countView: boolean) {
    const d = await this.prisma.instagramDiagnosis.findUnique({ where: { token: String(token ?? '') } });
    if (!d) throw new NotFoundException('Diagnóstico não encontrado.');
    if (countView) {
      await this.prisma.instagramDiagnosis.update({
        where: { id: d.id },
        data: { viewCount: { increment: 1 }, firstViewedAt: d.firstViewedAt ?? new Date(), lastViewedAt: new Date() },
      });
    }
    return d;
  }

  publicView(d: InstagramDiagnosis) {
    const { sourceHash, ...content } = d.content as unknown as DiagnosisContent;
    return {
      instagramHandle: d.instagramHandle,
      score: d.score,
      ...content,
      createdAt: d.createdAt,
      bookingUrl: `/agendar/${BOOKING_SLUG}`,
      plan: (({ url, ...p }) => p)(planOffer(d.token)),
      pdfUrl: `/api/v1/public/diagnostico/${d.token}/pdf`,
    };
  }

  private teamView(d: InstagramDiagnosis, contact: { name: string; phone: string | null }) {
    const url = this.url(d.token);
    return {
      url,
      pdfUrl: `/api/v1/public/diagnostico/${d.token}/pdf?preview=1`,
      instagramHandle: d.instagramHandle,
      score: d.score,
      viewCount: d.viewCount,
      firstViewedAt: d.firstViewedAt,
      lastViewedAt: d.lastViewedAt,
      createdAt: d.createdAt,
      phone: contact.phone,
      whatsappText: this.whatsappText(contact.name, d, url),
    };
  }

  /** Diagnóstico completo para colar no WhatsApp Business (formatação do WhatsApp, poucos emojis). */
  private whatsappText(name: string, d: InstagramDiagnosis, url: string) {
    const c = d.content as unknown as DiagnosisContent;
    const first = (name || '').trim().split(/\s+/)[0];
    const lines = [
      `Oi${first ? `, ${first}` : ''}! Tudo bem? 😊`,
      `Aqui é da *Dua Criativa*. Fizemos uma análise gratuita do Instagram da *@${d.instagramHandle}*:`,
      '',
    ];
    if (d.score !== null) lines.push(`📊 *Nota do perfil: ${d.score}/100* (${scoreLabel(d.score)})`, '');
    lines.push(c.resumo, '');
    if (c.pontos_fortes.length) {
      lines.push('*O que já funciona bem*', ...c.pontos_fortes.slice(0, 3).map((p) => `• ${p}`), '');
    }
    if (c.oportunidades.length) {
      lines.push('*Possíveis pontos de melhoria*', ...c.oportunidades.slice(0, 3).map((o) => `• ${o}`), '');
    }
    lines.push('*Próximos passos*', ...c.proximos_passos.map((p, i) => `${i + 1}. *${p.titulo}*: ${p.descricao}`), '');
    lines.push(`Análise completa: ${url}`, '');
    lines.push(`Quer ajuda para colocar isso em prática? Agende uma conversa gratuita com um especialista: ${bookingUrl()}`, '');
    const plan = planOffer(d.token);
    lines.push(`*Quer o passo a passo pronto?* O *${plan.name}* é um plano de 3 meses só para a sua marca (o que postar, roteiros, stories e o que contratar), por ${plan.priceLabel}, entregue em ${plan.deliveryHours}h: ${plan.url}`);
    return lines.join('\n');
  }

  private metrics(p: any): DiagnosisMetrics {
    const posts: any[] = p.ultimos_posts ?? [];
    const best = posts.reduce<any>((b, m) => {
      const total = (m.curtidas ?? 0) + (m.comentarios ?? 0);
      return !b || total > (b.curtidas ?? 0) + (b.comentarios ?? 0) ? m : b;
    }, null);
    return {
      seguidores: p.seguidores ?? null,
      posts: p.total_posts ?? null,
      engajamento: p.engajamento_medio_por_post ?? null,
      melhorPost: best
        ? {
            data: best.data ?? null,
            formato: best.formato === 'REELS' ? 'Reels' : best.formato === 'CAROUSEL_ALBUM' ? 'Carrossel' : best.formato === 'VIDEO' ? 'Vídeo' : 'Foto',
            curtidas: best.curtidas ?? 0,
            comentarios: best.comentarios ?? 0,
            legenda: String(best.legenda ?? '').slice(0, 120),
          }
        : null,
    };
  }

  /** Reescreve a análise interna em tom de consultoria para a dona/o dono da marca. */
  private async rewriteForClient(handle: string, analysis: any, metricas: DiagnosisMetrics | null) {
    const interna = {
      score: analysis.score,
      resumo: analysis.resumo,
      pontos_fortes: analysis.pontos_fortes,
      oportunidades: analysis.oportunidades,
      alertas: analysis.alertas,
      estrategia_recomendada: analysis.estrategia_recomendada,
    };
    const prompt =
      `Abaixo está a análise INTERNA que a agência Dua Criativa fez do Instagram @${handle}` +
      (metricas ? `, e os números reais do perfil` : '') +
      `. Transforme-a numa análise gratuita para a própria dona ou o próprio dono da marca ler.\n\n` +
      `Análise interna:\n${JSON.stringify(interna, null, 2)}\n\n` +
      (metricas ? `Números reais do perfil:\n${JSON.stringify(metricas, null, 2)}\n\n` : '') +
      `Regras de tom: fale direto com a pessoa ("você", "sua marca"), acolhedor, encorajador e prático, sem jargão de marketing. ` +
      `Nunca critique de forma dura nem use palavras como "erro", "fraco", "ruim" ou "problema": os alertas viram pontos de melhoria, ` +
      `ditos com cuidado. Cite números reais quando ajudarem, mas não invente números ou fatos. Não fale de preços nem tente vender a agência. ` +
      `Não use emojis. Os 3 próximos passos devem ser ações concretas que a marca consegue começar sozinha nas próximas semanas, em ordem de impacto.\n\n` +
      `Retorne APENAS um JSON válido (sem markdown) com: resumo (2-3 frases, começando pelo que a marca faz bem), ` +
      `nota_explicacao (1 frase simples dizendo o que a nota ${analysis.score}/100 significa para essa marca), ` +
      `pontos_fortes (array, 3 a 4 itens de 1 frase), oportunidades (array, 3 a 4 itens de 1-2 frases), ` +
      `proximos_passos (array com exatamente 3 objetos { titulo (até 6 palavras), descricao (1-2 frases) }).`;

    const text = await askClaude({
      system: 'Você é consultora de marketing digital para marcas de moda brasileiras. Retorne sempre JSON válido, sem markdown.',
      prompt,
      maxTokens: 2048,
    });
    const out = parseJsonObject(text);
    const list = (v: any) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, 4) : []);
    const steps = Array.isArray(out?.proximos_passos)
      ? out.proximos_passos
          .filter((p: any) => p && typeof p.titulo === 'string' && typeof p.descricao === 'string')
          .slice(0, 3)
          .map((p: any) => ({ titulo: p.titulo, descricao: p.descricao }))
      : [];
    if (!out || typeof out.resumo !== 'string' || steps.length < 3) {
      throw new BadRequestException('A IA não devolveu o diagnóstico completo. Tente de novo.');
    }
    return {
      resumo: out.resumo,
      nota_explicacao: typeof out.nota_explicacao === 'string' ? out.nota_explicacao : '',
      pontos_fortes: list(out.pontos_fortes),
      oportunidades: list(out.oportunidades),
      proximos_passos: steps,
    };
  }
}
