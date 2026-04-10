import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('pipelines')
@UseGuards(JwtAuthGuard)
export class PipelinesController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Pipelines ──────────────────────────────────────────────────────────────

  @Get()
  async findAll(@Request() req: any) {
    return this.prisma.pipeline.findMany({
      where: { tenantId: req.user.tenantId },
      include: {
        stages: {
          orderBy: { position: 'asc' },
          include: {
            leads: {
              include: { contact: { select: { id: true, name: true, phone: true } } },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Post()
  async create(@Request() req: any, @Body() body: { name: string }) {
    return this.prisma.pipeline.create({
      data: {
        tenantId: req.user.tenantId,
        name: body.name,
        stages: {
          create: [
            { name: 'Novo Lead', color: '#6366F1', position: 0 },
            { name: 'Em Andamento', color: '#F59E0B', position: 1 },
            { name: 'Fechado', color: '#10B981', position: 2 },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.prisma.pipeline.deleteMany({ where: { id, tenantId: req.user.tenantId } });
  }

  // ── Stages ─────────────────────────────────────────────────────────────────

  @Post(':pipelineId/stages')
  async createStage(
    @Request() req: any,
    @Param('pipelineId') pipelineId: string,
    @Body() body: { name: string; color?: string },
  ) {
    const count = await this.prisma.pipelineStage.count({ where: { pipelineId } });
    return this.prisma.pipelineStage.create({
      data: { pipelineId, name: body.name, color: body.color || '#6366F1', position: count },
    });
  }

  @Patch('stages/:stageId')
  async updateStage(@Param('stageId') stageId: string, @Body() body: { name?: string; color?: string }) {
    return this.prisma.pipelineStage.update({ where: { id: stageId }, data: body });
  }

  @Delete('stages/:stageId')
  async removeStage(@Param('stageId') stageId: string) {
    return this.prisma.pipelineStage.deleteMany({ where: { id: stageId } });
  }

  // ── Leads ──────────────────────────────────────────────────────────────────

  @Post('stages/:stageId/leads')
  async createLead(
    @Request() req: any,
    @Param('stageId') stageId: string,
    @Body() body: { name: string; phone?: string; email?: string; value?: number; contactId?: string },
  ) {
    const count = await this.prisma.pipelineLead.count({ where: { stageId } });

    let contactId = body.contactId;
    if (!contactId && body.name) {
      const contact = await this.prisma.contact.create({
        data: {
          tenantId: req.user.tenantId,
          name: body.name,
          phone: body.phone || null,
          email: body.email || null,
        },
      });
      contactId = contact.id;
    }

    return this.prisma.pipelineLead.create({
      data: { stageId, contactId: contactId!, value: body.value || null, position: count },
      include: { contact: { select: { id: true, name: true, phone: true } } },
    });
  }

  @Patch('leads/:leadId/move')
  async moveLead(@Param('leadId') leadId: string, @Body() body: { stageId: string }) {
    return this.prisma.pipelineLead.update({
      where: { id: leadId },
      data: { stageId: body.stageId },
    });
  }

  @Patch('leads/:leadId')
  async updateLead(@Param('leadId') leadId: string, @Body() body: { value?: number; notes?: string }) {
    return this.prisma.pipelineLead.update({ where: { id: leadId }, data: body });
  }

  @Delete('leads/:leadId')
  async removeLead(@Param('leadId') leadId: string) {
    return this.prisma.pipelineLead.deleteMany({ where: { id: leadId } });
  }
}
