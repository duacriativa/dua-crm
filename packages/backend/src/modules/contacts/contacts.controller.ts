import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Request, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly prisma: PrismaService,
  ) {}

  /** GET /contacts/stats — contagem por qualificação para o dashboard */
  @Get('stats')
  async stats(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const [ultra, qualified, cold, unqualified, total] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, qualification: 'ULTRA' } }),
      this.prisma.contact.count({ where: { tenantId, qualification: 'QUALIFIED' } }),
      this.prisma.contact.count({ where: { tenantId, qualification: 'COLD' } }),
      this.prisma.contact.count({ where: { tenantId, qualification: 'UNQUALIFIED' } }),
      this.prisma.contact.count({ where: { tenantId } }),
    ]);
    return { total, ultra, qualified, cold, unqualified };
  }

  /** GET /contacts?segment=VIP&search=ana&page=1&limit=20 */
  @Get()
  findAll(
    @Request() req: any,
    @Query('segment') segment?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactsService.findAll(req.user.tenantId, {
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
      tags?: string[];
      notes?: string;
      analysisInstagram?: string;
      qualification?: 'ULTRA' | 'QUALIFIED' | 'COLD' | 'UNQUALIFIED';
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

    return this.prisma.contact.updateMany({
      where: { id, tenantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.analysisInstagram !== undefined && { analysisInstagram: body.analysisInstagram }),
        ...(body.qualification !== undefined && { qualification: body.qualification }),
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
   * Chama a API da OpenAI (GPT-4o) para analisar o perfil do Instagram do contato.
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('OPENAI_API_KEY não configurada.');

    const instagram = contact.instagramHandle.replace('@', '');
    const prompt =
      `Você é especialista em marketing digital para moda brasileira da agência Dua Criativa (Fortaleza). ` +
      `Analise o perfil @${instagram} no Instagram. Use todo o conhecimento disponível sobre essa marca/perfil. ` +
      `Retorne APENAS um JSON válido (sem markdown, sem explicação extra) com: score (0-100), resumo (2-3 frases), pontos_fortes (array), oportunidades (array), ` +
      `alertas (array), estrategia_recomendada (parágrafo), mensagem_whatsapp (mensagem casual e personalizada, ` +
      `máx 4 linhas, assine como Equipe Dua Criativa).`;

    let openaiRes: any;
    try {
      openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2048,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em marketing digital para marcas de moda brasileira. Retorne sempre JSON válido.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } catch (err: any) {
      throw new InternalServerErrorException(`Erro ao conectar na OpenAI API: ${err.message}`);
    }

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      throw new InternalServerErrorException(`OpenAI API retornou ${openaiRes.status}: ${errBody}`);
    }

    const data: any = await openaiRes.json();
    const analysisText: string = data.choices?.[0]?.message?.content ?? '';

    // Tenta extrair o JSON embutido no texto
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

  /** DELETE /contacts/:id */
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.prisma.contact.deleteMany({
      where: { id, tenantId: req.user.tenantId },
    });
  }
}
