import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import { askClaude, parseJsonObject } from './claude';
import { DiagnosisService } from './diagnosis.service';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
    private readonly diagnosis: DiagnosisService,
  ) {}

  /** GET /contacts/stats — stats para o dashboard de Clientes */
  @Get('stats')
  async stats(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalClients,
      newThisMonth,
      renewalsSoon,
      mrrResult,
      leadStats,
      clientSegmentStats,
      cancelledThisMonth,
      activeAtStartOfMonth,
    ] = await Promise.all([
      // Total de clientes (type = CLIENT)
      this.prisma.contact.count({ where: { tenantId, type: 'CLIENT' } }),

      // Novos clientes este mês
      this.prisma.contact.count({
        where: { tenantId, type: 'CLIENT', clientSince: { gte: startOfMonth } },
      }),

      // Contratos que vencem nos próximos 30 dias
      this.prisma.contract.count({
        where: {
          tenantId,
          status: 'ACTIVE',
          endsAt: { gte: now, lte: in30Days },
        },
      }),

      // MRR: soma dos monthlyValue de contratos ativos
      this.prisma.contract.aggregate({
        where: { tenantId, status: 'ACTIVE' },
        _sum: { monthlyValue: true },
      }),

      // Stats de leads para o funil
      this.prisma.contact.groupBy({
        by: ['qualification'],
        where: { tenantId, type: 'LEAD' },
        _count: true,
      }),

      // Contagens por segmento (para as tabs de Clientes)
      this.prisma.contact.groupBy({
        by: ['segment'],
        where: { tenantId, type: 'CLIENT' },
        _count: true,
      }),

      // Contratos cancelados no mês atual
      this.prisma.contract.count({
        where: {
          tenantId,
          status: 'CANCELLED',
          cancelledAt: { gte: startOfMonth },
        },
      }),

      // Base de contratos ativos no início do mês (para cálculo de churn)
      // = contratos assinados antes do mês que ainda estavam ativos no dia 1
      this.prisma.contract.count({
        where: {
          tenantId,
          signedAt: { lt: startOfMonth },
          OR: [
            { status: 'ACTIVE' },
            { status: 'CANCELLED', cancelledAt: { gte: startOfMonth } },
            { status: 'FINISHED', updatedAt: { gte: startOfMonth } },
          ],
        },
      }),
    ]);

    const mrr = mrrResult._sum.monthlyValue ?? 0;

    const segCount = (seg: string) =>
      clientSegmentStats.find(r => r.segment === seg)?._count ?? 0;

    const activeClients = segCount('ACTIVE');
    const atRiskClients = segCount('AT_RISK');

    const churnRate = activeAtStartOfMonth > 0
      ? (cancelledThisMonth / activeAtStartOfMonth) * 100
      : 0;

    return {
      // Métricas legadas (mantidas p/ compatibilidade com outros consumidores)
      totalClients,
      newThisMonth,
      renewalsSoon,
      mrr,

      // Novas métricas dos cards
      activeClients,
      atRiskClients,
      cancelledThisMonth,
      churnRate: Number(churnRate.toFixed(2)),

      // Contagens por segmento (para tabs)
      segmentCounts: {
        ALL: totalClients,
        NEW: segCount('NEW'),
        ACTIVE: activeClients,
        VIP: segCount('VIP'),
        AT_RISK: atRiskClients,
        DORMANT: segCount('DORMANT'),
      },

      leads: {
        total: leadStats.reduce((s, r) => s + r._count, 0),
        ultra: leadStats.find(r => r.qualification === 'ULTRA')?._count ?? 0,
        qualified: leadStats.find(r => r.qualification === 'QUALIFIED')?._count ?? 0,
        cold: leadStats.find(r => r.qualification === 'COLD')?._count ?? 0,
        unqualified: leadStats.find(r => r.qualification === 'UNQUALIFIED')?._count ?? 0,
      },
    };
  }

  /** GET /contacts?type=CLIENT&segment=VIP&search=ana&page=1&limit=20 */
  @Get()
  findAll(
    @Request() req: any,
    @Query('type') type?: string,
    @Query('segment') segment?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactsService.findAll(req.user.tenantId, {
      type: type as any,
      segment: segment as any,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /** GET /contacts/:id */
  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.contactsService.findOne(req.user.tenantId, id);
  }

  /** POST /contacts */
  @Post()
  create(
    @Request() req: any,
    @Body() body: { name: string; phone?: string; email?: string; tags?: string[] },
  ) {
    return this.prisma.contact.create({
      data: {
        tenantId: req.user.tenantId,
        name: body.name,
        phone: body.phone ?? null,
        email: body.email ?? null,
        tags: body.tags ?? [],
        segment: 'NEW',
        type: 'CLIENT',
        clientSince: new Date(),
      },
    });
  }

  /** PATCH /contacts/:id */
  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      phone?: string;
      email?: string;
      instagramHandle?: string | null;
      tags?: string[];
      notes?: string;
      analysisInstagram?: string;
      qualification?: 'ULTRA' | 'QUALIFIED' | 'COLD' | 'UNQUALIFIED';
      type?: 'LEAD' | 'CLIENT';
      segment?: 'NEW' | 'ACTIVE' | 'VIP' | 'AT_RISK' | 'DORMANT';
      leadOrigin?: 'ADS' | 'ORGANIC' | 'REFERRAL' | 'OTHER' | null;
    },
  ) {
    const tenantId = req.user.tenantId;
    if (body.leadOrigin !== undefined && body.leadOrigin !== null && !['ADS', 'ORGANIC', 'REFERRAL', 'OTHER'].includes(body.leadOrigin)) {
      throw new BadRequestException('Origem inválida');
    }

    if (body.phone) {
      const existing = await this.prisma.contact.findFirst({ where: { id, tenantId } });
      if (existing?.phone && existing.phone !== body.phone) {
        await this.prisma.conversation.updateMany({
          where: { tenantId, contactId: id, externalId: existing.phone },
          data: { externalId: body.phone },
        });
      }
    }

    // Quando promover para CLIENT, registrar clientSince se ainda não tiver
    const promotingToClient = body.type === 'CLIENT';

    const contactBeforeUpdate = body.segment !== undefined
      ? await this.prisma.contact.findFirst({ where: { id, tenantId } })
      : null;

    const result = await this.prisma.contact.updateMany({
      where: { id, tenantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.instagramHandle !== undefined && { instagramHandle: body.instagramHandle }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.analysisInstagram !== undefined && { analysisInstagram: body.analysisInstagram }),
        ...(body.qualification !== undefined && { qualification: body.qualification }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.segment !== undefined && { segment: body.segment }),
        ...(body.leadOrigin !== undefined && { leadOrigin: body.leadOrigin }),
        ...(promotingToClient && { clientSince: new Date() }),
      },
    });

    // Marcar cliente como Inativo (DORMANT) cancela automaticamente os
    // contratos ativos dele — evita que ele continue cobrando no Financeiro
    // mesmo depois de já ter sido dado como inativo na tela de Clientes.
    if (body.segment === 'DORMANT' && contactBeforeUpdate?.segment !== 'DORMANT' && contactBeforeUpdate?.name) {
      await this.cancelActiveContractsForClient(tenantId, contactBeforeUpdate.name);
    }

    return result;
  }

  /** Cancela contratos ativos cujo clientName bate (exato ou por contenção) com o nome do contato. */
  private async cancelActiveContractsForClient(tenantId: string, contactName: string) {
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    const target = normalize(contactName);
    if (!target) return;

    const activeContracts = await this.prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, clientName: true },
    });

    const matches = activeContracts.filter((c) => {
      const key = normalize(c.clientName);
      return key === target || (key.length >= 3 && target.length >= 3 && (key.includes(target) || target.includes(key)));
    });

    if (matches.length > 0) {
      await this.prisma.contract.updateMany({
        where: { id: { in: matches.map((m) => m.id) } },
        data: { status: 'CANCELLED' },
      });
    }
  }

  /** PATCH /contacts/:id/qualify — qualificação manual (para leads do WhatsApp) */
  @Patch(':id/qualify')
  async qualify(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { qualification: 'ULTRA' | 'QUALIFIED' | 'COLD' | 'UNQUALIFIED' },
  ) {
    const tenantId = req.user.tenantId;
    return this.prisma.contact.updateMany({
      where: { id, tenantId },
      data: { qualification: body.qualification },
    });
  }

  /**
   * POST /contacts/:id/analyze-instagram
   * Usa Claude (Anthropic) para analisar o perfil do Instagram.
   */
  @Post(':id/analyze-instagram')
  async analyzeInstagram(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;

    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      select: { instagramHandle: true, name: true },
    });

    if (!contact) throw new BadRequestException('Contato não encontrado.');
    if (!contact.instagramHandle) throw new BadRequestException('Contato sem Instagram cadastrado.');

    if (!process.env.ANTHROPIC_API_KEY) throw new InternalServerErrorException('IA não configurada: defina ANTHROPIC_API_KEY no servidor.');

    const instagram = this.normalizeInstagramHandle(contact.instagramHandle);
    const profile = await this.fetchInstagramProfile(instagram);

    const dados = profile.data
      ? `Dados reais do perfil, obtidos agora pela API oficial do Instagram:\n${JSON.stringify(profile.data, null, 2)}\n` +
        `Baseie a análise SOMENTE nesses dados (bio, números, legendas, formatos, frequência e engajamento dos posts). ` +
        `Cite números concretos quando ajudar.`
      : `Não foi possível obter dados reais do perfil (${profile.reason}). Não invente números nem fatos sobre a marca: ` +
        `deixe isso claro no resumo, use score null e foque em pontos a verificar.`;

    const prompt =
      `Você é especialista em marketing digital para moda brasileira da agência Dua Criativa (Fortaleza). ` +
      `Analise o perfil @${instagram} no Instagram.\n\n${dados}\n\n` +
      `Retorne APENAS um JSON válido (sem markdown, sem explicação extra) com: score (0-100), resumo (2-3 frases), ` +
      `pontos_fortes (array, até 5 itens de 1 frase), oportunidades (array, até 5 itens de 1-2 frases), ` +
      `alertas (array, até 4 itens de 1 frase), estrategia_recomendada (1 parágrafo), mensagem_whatsapp (mensagem casual e personalizada, ` +
      `máx 4 linhas, assine como Equipe Dua Criativa).`;

    const analysisText = await askClaude({
      system: 'Você é especialista em marketing digital para moda brasileira. Retorne sempre JSON válido, sem markdown.',
      prompt,
      // Com dados reais do perfil a análise fica mais longa; 2048 cortava o JSON no meio
      maxTokens: 4096,
    });
    const parsed = parseJsonObject(analysisText);

    return { analysis: analysisText, parsed, profileFetched: !!profile.data, profileError: profile.reason };
  }

  /**
   * POST /contacts/:id/diagnosis — gera o "diagnóstico gratuito" (página pública para o cliente)
   * a partir da análise do Instagram. Body opcional: { analysis } (texto atual da tela, mesmo sem salvar).
   */
  @Post(':id/diagnosis')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createDiagnosis(@Request() req: any, @Param('id') id: string, @Body() body: { analysis?: string }) {
    return this.diagnosis.create(req.user.tenantId, id, typeof body?.analysis === 'string' ? body.analysis : undefined);
  }

  /** GET /contacts/:id/diagnosis — último diagnóstico gerado (link, mensagem e se o cliente abriu) */
  @Get(':id/diagnosis')
  latestDiagnosis(@Request() req: any, @Param('id') id: string) {
    return this.diagnosis.latest(req.user.tenantId, id);
  }

  /** Aceita "@loja", "loja" ou URL do perfil e devolve só o username. */
  private normalizeInstagramHandle(raw: string): string {
    const semUrl = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0];
    return semUrl.replace(/^@/, '').toLowerCase();
  }

  private igBusinessId: string | null = null;

  /**
   * Busca bio, números e últimos posts de um perfil comercial/criador via Business Discovery
   * (Graph API), usando o Instagram da Dua. Requer INSTAGRAM_ACCESS_TOKEN (usuário de sistema
   * com instagram_basic + pages_show_list); INSTAGRAM_BUSINESS_ID é opcional.
   * Nunca lança erro: sem dados, devolve o motivo para a IA não inventar.
   */
  private async fetchInstagramProfile(username: string): Promise<{ data: any | null; reason?: string }> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return { data: null, reason: 'integração com o Instagram não configurada' };
    const graph = 'https://graph.facebook.com/v21.0';

    try {
      if (!this.igBusinessId) {
        this.igBusinessId = process.env.INSTAGRAM_BUSINESS_ID || null;
        if (!this.igBusinessId) {
          const r = await fetch(`${graph}/me/accounts?fields=instagram_business_account&access_token=${encodeURIComponent(token)}`,
            { signal: AbortSignal.timeout(15000) });
          const pages: any = await r.json();
          this.igBusinessId = pages.data?.find((p: any) => p.instagram_business_account)?.instagram_business_account?.id ?? null;
          if (!this.igBusinessId) return { data: null, reason: 'conta do Instagram da Dua não encontrada no token' };
        }
      }

      const fields =
        `business_discovery.username(${username}){username,name,biography,website,followers_count,follows_count,media_count,` +
        `media.limit(12){caption,media_type,media_product_type,like_count,comments_count,timestamp}}`;
      const r = await fetch(`${graph}/${this.igBusinessId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(15000) });
      const body: any = await r.json();
      if (!r.ok || !body.business_discovery) {
        const msg: string = body.error?.error_user_msg || body.error?.message || `HTTP ${r.status}`;
        // Perfis pessoais ou inexistentes não são visíveis pelo Business Discovery
        const reason = /cannot be found|invalid user id|not.*business/i.test(msg)
          ? 'perfil pessoal, privado ou inexistente (a API só enxerga contas comerciais e de criador)'
          : `erro na API do Instagram: ${msg.slice(0, 200)}`;
        return { data: null, reason };
      }

      const p = body.business_discovery;
      const posts = (p.media?.data ?? []).map((m: any) => ({
        data: m.timestamp?.slice(0, 10),
        formato: m.media_product_type === 'REELS' ? 'REELS' : m.media_type,
        curtidas: m.like_count,
        comentarios: m.comments_count,
        legenda: (m.caption ?? '').slice(0, 300),
      }));
      const interacoes = posts.reduce((s: number, m: any) => s + (m.curtidas ?? 0) + (m.comentarios ?? 0), 0);
      const engajamento = posts.length && p.followers_count
        ? `${((interacoes / posts.length / p.followers_count) * 100).toFixed(2)}%`
        : null;

      return {
        data: {
          username: p.username, nome: p.name, bio: p.biography, site: p.website,
          seguidores: p.followers_count, seguindo: p.follows_count, total_posts: p.media_count,
          engajamento_medio_por_post: engajamento, ultimos_posts: posts,
        },
      };
    } catch (err: any) {
      return { data: null, reason: `falha ao consultar o Instagram: ${err.message}` };
    }
  }

  /** POST /contacts/import-asaas — importa clientes do Asaas para a base de contatos */
  @Post('import-asaas')
  async importFromAsaas(@Request() req: any) {
    const tenantId = req.user.tenantId;
    let created = 0;
    let updated = 0;

    const customers = await this.asaas.getAllCustomers();

    for (const c of customers) {
      const phone = c.mobilePhone
        ? `+${c.mobilePhone.replace(/\D/g, '')}`
        : c.phone
        ? `+${c.phone.replace(/\D/g, '')}`
        : null;

      const email = c.email || null;
      const name = c.name || 'Sem nome';

      // Tenta encontrar por phone ou email
      const orConditions: any[] = [];
      if (phone) orConditions.push({ phone });
      if (email) orConditions.push({ email });

      const existing = orConditions.length > 0
        ? await this.prisma.contact.findFirst({ where: { tenantId, OR: orConditions } })
        : null;

      if (existing) {
        await this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            email: email || existing.email,
            phone: phone || existing.phone,
            type: 'CLIENT', // promove LEAD → CLIENT
          },
        });
        updated++;
      } else {
        // Verifica duplicata por nome antes de criar
        const byName = await this.prisma.contact.findFirst({
          where: { tenantId, name },
        });
        if (byName) {
          await this.prisma.contact.update({
            where: { id: byName.id },
            data: {
              email: email || byName.email,
              phone: phone || byName.phone,
              type: 'CLIENT',
            },
          });
          updated++;
        } else {
          await this.prisma.contact.create({
            data: { tenantId, name, phone, email, type: 'CLIENT', clientSince: new Date() },
          });
          created++;
        }
      }
    }

    return { ok: true, created, updated, total: created + updated };
  }

  /** POST /contacts/sync-brevo — envia leads/clientes com email para o Brevo */
  @Post('sync-brevo')
  async syncBrevo(
    @Request() req: any,
    @Body() body: { contactType?: 'LEAD' | 'CLIENT' | 'ALL' },
  ) {
    const tenantId = req.user.tenantId;
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('BREVO_API_KEY não configurada.');

    const where: any = { tenantId, email: { not: null } };
    if (body.contactType === 'LEAD') where.type = 'LEAD';
    else if (body.contactType === 'CLIENT') where.type = 'CLIENT';

    const contacts = await this.prisma.contact.findMany({
      where,
      select: { name: true, email: true, phone: true, type: true },
    });

    const withEmail = contacts.filter(c => c.email);
    if (!withEmail.length) return { ok: true, synced: 0 };

    // Brevo bulk import (CSV inline)
    const header = 'EMAIL;FIRSTNAME;SMS';
    const rows = withEmail.map(c => {
      const firstName = (c.name || '').replace(/;/g, ' ');
      const phone = (c.phone || '').replace(/;/g, '');
      return `${c.email};${firstName};${phone}`;
    }).join('\n');

    const res = await fetch('https://api.brevo.com/v3/contacts/import', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBody: `${header}\n${rows}`,
        updateEnabled: true,
        emailBlacklist: false,
        smsBlacklist: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new InternalServerErrorException(`Brevo retornou ${res.status}: ${err.slice(0, 200)}`);
    }

    return { ok: true, synced: withEmail.length };
  }

  /** DELETE /contacts/:id — deleta cascata manual */
  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    // Verifica que o contato pertence ao tenant
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId: req.user.tenantId },
    });
    if (!contact) return { ok: false, error: 'Contato não encontrado' };

    // Exclui registros dependentes manualmente (sem cascade no schema)
    await this.prisma.$transaction([
      // Nulifica vínculo em contratos (mantém histórico financeiro)
      this.prisma.contract.updateMany({ where: { contactId: id }, data: { contactId: null } }),
      // Remove leads no funil
      this.prisma.pipelineLead.deleteMany({ where: { contactId: id } }),
      // Remove mensagens e conversas
      this.prisma.message.deleteMany({ where: { conversation: { contactId: id } } }),
      this.prisma.conversation.deleteMany({ where: { contactId: id } }),
      // Remove pedidos
      this.prisma.order.deleteMany({ where: { contactId: id } }),
      // Por fim, remove o contato
      this.prisma.contact.delete({ where: { id } }),
    ]);

    return { ok: true };
  }
}
