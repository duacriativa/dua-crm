import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Coloca contatos no funil de vendas automaticamente.
 * Usado pelos canais de mensagem (WhatsApp) para que todo lead novo
 * que chamar caia na primeira etapa do funil principal.
 */
@Injectable()
export class FunnelService {
  private readonly logger = new Logger(FunnelService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Funil principal do tenant = o mais antigo. Se não existir nenhum,
   * cria "Funil de Vendas" com as etapas padrão.
   */
  private async getMainPipeline(tenantId: string) {
    const existing = await this.prisma.pipeline.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    if (existing) return existing;

    this.logger.log(`[Funnel] Tenant ${tenantId} sem funil — criando "Funil de Vendas"`);
    return this.prisma.pipeline.create({
      data: {
        tenantId,
        name: 'Funil de Vendas',
        stages: {
          create: [
            { name: 'Novo Lead', color: '#6366F1', position: 0 },
            { name: 'Em Andamento', color: '#F59E0B', position: 1 },
            { name: 'Fechado', color: '#10B981', position: 2, kind: 'WON' },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  /**
   * Garante que o contato tem um card no funil principal.
   * Não mexe em quem já está no funil e ignora quem já é cliente.
   */
  async ensureLead(tenantId: string, contactId: string, notes?: string) {
    try {
      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, tenantId },
        select: { id: true, type: true },
      });
      if (!contact || contact.type === 'CLIENT') return;

      const pipeline = await this.getMainPipeline(tenantId);
      const firstStage = pipeline.stages[0];
      if (!firstStage) return;

      const existing = await this.prisma.pipelineLead.findFirst({
        where: { contactId, stage: { pipelineId: pipeline.id } },
        select: { id: true },
      });
      if (existing) return;

      const count = await this.prisma.pipelineLead.count({ where: { stageId: firstStage.id } });
      await this.prisma.pipelineLead.create({
        data: { stageId: firstStage.id, contactId, position: count, notes: notes ?? null },
      });
      this.logger.log(`[Funnel] Contato ${contactId} adicionado em "${pipeline.name}" → "${firstStage.name}"`);
    } catch (err: any) {
      this.logger.warn(`[Funnel] Falha ao adicionar contato ${contactId}: ${err.message}`);
    }
  }
}
