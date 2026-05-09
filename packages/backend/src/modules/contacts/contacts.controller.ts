import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AsaasService } from '../asaas/asaas.service';
import axios from 'axios';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly prisma: PrismaService,
    private readonly asaas: AsaasService,
  ) {}

  /** GET /contacts/stats — stats para o dashboard de Clientes */
  @Get('stats')
  async stats(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalClients, newThisMonth, renewalsSoon, mrrResult, leadStats] = await Promise.all([
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
    ]);

    const mrr = mrrResult._sum.monthlyValue ?? 0;

    return {
      totalClients,
      newThisMonth,
      renewalsSoon,
      mrr,
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
    },
  ) {
    const tenantId = req.user.tenantId;

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

    return this.prisma.contact.updateMany({
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
        ...(promotingToClient && { clientSince: new Date() }),
      },
    });
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
   * Usa Google Gemini 1.5 Flash (gratuito) para analisar o perfil do Instagram.
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

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('GROQ_API_KEY não configurada.');

    const instagram = contact.instagramHandle.replace('@', '');
    const prompt =
      `Você é especialista em marketing digital para moda brasileira da agência Dua Criativa (Fortaleza). ` +
      `Analise o perfil @${instagram} no Instagram. Use todo o conhecimento disponível sobre essa marca/perfil. ` +
      `Retorne APENAS um JSON válido (sem markdown, sem explicação extra) com: score (0-100), resumo (2-3 frases), pontos_fortes (array), oportunidades (array), ` +
      `alertas (array), estrategia_recomendada (parágrafo), mensagem_whatsapp (mensagem casual e personalizada, ` +
      `máx 4 linhas, assine como Equipe Dua Criativa).`;

    let groqRes: any;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2048,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Você é especialista em marketing digital para moda brasileira. Retorne sempre JSON válido, sem markdown.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } catch (err: any) {
      throw new InternalServerErrorException(`Erro ao conectar no Groq: ${err.message}`);
    }

    if (!groqRes.ok) {
      const errBody = await groqRes.text();
      throw new InternalServerErrorException(`Groq retornou ${groqRes.status}: ${errBody.slice(0, 300)}`);
    }

    const data: any = await groqRes.json();
    const analysisText: string = data.choices?.[0]?.message?.content ?? '';

    let parsed: any = null;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // retorna texto bruto se o parse falhar
    }

    return { analysis: analysisText, parsed };
  }

  /** POST /contacts/resolve-lids — tenta mapear contatos LID para número real via Evolution API */
  @Post('resolve-lids')
  async resolveLids(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const instanceName = tenant?.slug ?? tenantId;
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    const lidContacts = await this.prisma.contact.findMany({
      where: { tenantId, phone: { startsWith: 'lid:' } },
    });

    if (!lidContacts.length) return { resolved: 0, total: 0 };

    let evolutionContacts: any[] = [];
    try {
      const res = await axios.post(
        `${evolutionUrl}/chat/findContacts/${instanceName}`,
        {},
        { headers: { apikey: apiKey, 'Content-Type': 'application/json' }, timeout: 10000 },
      );
      evolutionContacts = Array.isArray(res.data) ? res.data : [];
    } catch {
      return { resolved: 0, total: lidContacts.length, error: 'Não foi possível contactar a Evolution API' };
    }

    const nameToPhone = new Map<string, string>();
    for (const ec of evolutionContacts) {
      if (ec.id?.endsWith('@s.whatsapp.net') && ec.pushName) {
        const phone = '+' + ec.id.replace('@s.whatsapp.net', '');
        nameToPhone.set(ec.pushName.toLowerCase().trim(), phone);
      }
    }

    let resolved = 0;
    for (const contact of lidContacts) {
      const key = contact.name?.toLowerCase().trim();
      const realPhone = key ? nameToPhone.get(key) : undefined;
      if (!realPhone) continue;

      const existing = await this.prisma.contact.findFirst({ where: { tenantId, phone: realPhone } });
      if (existing) continue;

      await this.prisma.contact.update({ where: { id: contact.id }, data: { phone: realPhone } });
      await this.prisma.conversation.updateMany({
        where: { tenantId, contactId: contact.id, externalId: contact.phone },
        data: { externalId: realPhone },
      });
      resolved++;
    }

    return { resolved, total: lidContacts.length };
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
