import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { appUrl } from '../scheduling/scheduling.service';
import { askClaude, parseJsonObject } from './claude';

/** Página de agendamento para onde o CTA do diagnóstico leva. */
const BOOKING_SLUG = process.env.DIAGNOSIS_BOOKING_SLUG || 'especialista';

export interface DiagnosisContent {
  resumo: string;
  pontos_fortes: string[];
  oportunidades: string[];
  proximos_passos: { titulo: string; descricao: string }[];
}

/**
 * "Diagnóstico gratuito" do Instagram para nutrir leads: reescreve a análise interna
 * (que tem alertas duros e estratégia de venda) num texto para o próprio cliente ler,
 * publicado em /diagnostico/[token] sem login.
 */
@Injectable()
export class DiagnosisService {
  constructor(private readonly prisma: PrismaService) {}

  url(token: string) { return `${appUrl()}/diagnostico/${token}`; }

  /** Gera um diagnóstico novo a partir da análise (do corpo ou a salva no contato). */
  async create(tenantId: string, contactId: string, analysisText?: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, name: true, instagramHandle: true, analysisInstagram: true },
    });
    if (!contact) throw new NotFoundException('Contato não encontrado.');
    if (!contact.instagramHandle) throw new BadRequestException('Contato sem Instagram cadastrado.');

    const analysis = parseJsonObject(analysisText?.trim() || contact.analysisInstagram || '');
    if (!analysis) throw new BadRequestException('Gere a análise do Instagram antes do diagnóstico.');
    const score = typeof analysis.score === 'number' ? Math.max(0, Math.min(100, Math.round(analysis.score))) : null;
    if (score === null) {
      throw new BadRequestException('A análise não tem dados reais do perfil (sem nota). Gere de novo quando o perfil estiver acessível.');
    }

    const handle = contact.instagramHandle.replace(/^@/, '').trim();
    const content = await this.rewriteForClient(handle, analysis);

    const diagnosis = await this.prisma.instagramDiagnosis.create({
      data: {
        tenantId, contactId: contact.id, instagramHandle: handle, score,
        content: content as any, token: crypto.randomBytes(24).toString('base64url'),
      },
    });
    return this.teamView(diagnosis, contact.name);
  }

  /** Último diagnóstico do contato (para o CRM mostrar link e se o cliente abriu). */
  async latest(tenantId: string, contactId: string) {
    const d = await this.prisma.instagramDiagnosis.findFirst({
      where: { tenantId, contactId },
      orderBy: { createdAt: 'desc' },
      include: { contact: { select: { name: true } } },
    });
    return d ? this.teamView(d, d.contact.name) : null;
  }

  /** Página pública. Visitas com preview=true (a equipe conferindo) não contam como abertura. */
  async publicView(token: string, preview: boolean) {
    const d = await this.prisma.instagramDiagnosis.findUnique({ where: { token: String(token ?? '') } });
    if (!d) throw new NotFoundException('Diagnóstico não encontrado.');
    if (!preview) {
      await this.prisma.instagramDiagnosis.update({
        where: { id: d.id },
        data: { viewCount: { increment: 1 }, firstViewedAt: d.firstViewedAt ?? new Date(), lastViewedAt: new Date() },
      });
    }
    return {
      instagramHandle: d.instagramHandle,
      score: d.score,
      ...(d.content as unknown as DiagnosisContent),
      createdAt: d.createdAt,
      bookingUrl: `/agendar/${BOOKING_SLUG}`,
    };
  }

  private teamView(d: { token: string; instagramHandle: string; score: number | null; viewCount: number; firstViewedAt: Date | null; lastViewedAt: Date | null; createdAt: Date }, contactName: string) {
    const url = this.url(d.token);
    return {
      url,
      score: d.score,
      viewCount: d.viewCount,
      firstViewedAt: d.firstViewedAt,
      lastViewedAt: d.lastViewedAt,
      createdAt: d.createdAt,
      message: this.whatsappMessage(contactName, d.instagramHandle, url),
    };
  }

  private whatsappMessage(name: string, handle: string, url: string) {
    const first = (name || '').trim().split(/\s+/)[0];
    return [
      `Oi${first ? `, ${first}` : ''}! Tudo bem? 😊`,
      `Aqui é da Dua Criativa. Preparamos um diagnóstico gratuito do Instagram da @${handle}, com o que já está funcionando e 3 próximos passos para vender mais:`,
      url,
      `Se quiser conversar sobre ele, é só responder aqui.`,
    ].join('\n');
  }

  /** Reescreve a análise interna em tom de consultoria para a dona/o dono da marca. */
  private async rewriteForClient(handle: string, analysis: any): Promise<DiagnosisContent> {
    const interna = {
      score: analysis.score,
      resumo: analysis.resumo,
      pontos_fortes: analysis.pontos_fortes,
      oportunidades: analysis.oportunidades,
      alertas: analysis.alertas,
      estrategia_recomendada: analysis.estrategia_recomendada,
    };
    const prompt =
      `Abaixo está a análise INTERNA que a agência Dua Criativa fez do Instagram @${handle}. ` +
      `Transforme-a num diagnóstico gratuito para a própria dona ou o próprio dono da marca ler.\n\n` +
      `${JSON.stringify(interna, null, 2)}\n\n` +
      `Regras de tom: fale direto com a pessoa ("você", "sua marca"), acolhedor, encorajador e prático, sem jargão de marketing. ` +
      `Nunca critique de forma dura nem use palavras como "erro", "fraco", "ruim" ou "problema": os alertas viram oportunidades de melhoria, ` +
      `ditas com cuidado. Não invente números ou fatos que não estejam na análise. Não fale de preços nem tente vender a agência. ` +
      `Os 3 próximos passos devem ser ações concretas que a marca consegue começar sozinha nas próximas semanas, em ordem de impacto.\n\n` +
      `Retorne APENAS um JSON válido (sem markdown) com: resumo (2-3 frases, começando pelo que a marca faz bem), ` +
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
    return { resumo: out.resumo, pontos_fortes: list(out.pontos_fortes), oportunidades: list(out.oportunidades), proximos_passos: steps };
  }
}
