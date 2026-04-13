import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request,
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
    @Body() body: { name?: string; phone?: string; email?: string; tags?: string[]; notes?: string },
  ) {
    const tenantId = req.user.tenantId;

    // Se o telefone está sendo atualizado, busca o telefone antigo para sincronizar a conversa
    if (body.phone) {
      const existing = await this.prisma.contact.findFirst({ where: { id, tenantId } });
      if (existing?.phone && existing.phone !== body.phone) {
        // Atualiza externalId de todas as conversas do contato que usavam o telefone antigo
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
      },
    });
  }

  /** POST /contacts/resolve-lids — tenta mapear contatos LID para número real via Evolution API */
  @Post('resolve-lids')
  async resolveLids(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const instanceName = tenant?.slug ?? tenantId;
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;

    // Busca todos os contatos LID do tenant
    const lidContacts = await this.prisma.contact.findMany({
      where: { tenantId, phone: { startsWith: 'lid:' } },
    });

    if (!lidContacts.length) return { resolved: 0, total: 0 };

    // Busca lista de contatos da Evolution API (tem pushName + JID real)
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

    // Monta mapa nome → número real (apenas @s.whatsapp.net com pushName)
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

      // Verifica se já não existe contato com esse número
      const existing = await this.prisma.contact.findFirst({ where: { tenantId, phone: realPhone } });
      if (existing) continue;

      // Atualiza contato e conversa
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
