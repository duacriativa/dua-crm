import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

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

  /** DELETE /contacts/:id */
  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.prisma.contact.deleteMany({
      where: { id, tenantId: req.user.tenantId },
    });
  }
}
