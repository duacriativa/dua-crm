import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /webhooks/lead
   * Endpoint público (sem JWT) — recebe leads do site marketingdemoda.
   * Cria contato + lead no primeiro funil do tenant dua-criativa.
   */
  @Post('lead')
  @HttpCode(200)
  async receiveLead(@Body() body: {
    name: string;
    whatsapp?: string;
    email?: string;
    instagram?: string;
    faturamento?: string;
    modelo?: string;
    clientSlug?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    stageName?: string;
  }) {
    try {
      const slug = body.clientSlug || 'dua-criativa';

      const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return { ok: false, error: 'Tenant não encontrado' };

      // Formata o telefone
      const phone = body.whatsapp
        ? `+${body.whatsapp.replace(/\D/g, '')}`
        : null;

      // Cria ou atualiza contato
      const contact = await this.prisma.contact.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: phone || '' } },
        create: {
          tenantId: tenant.id,
          name: body.name,
          phone,
          email: body.email || null,
          tags: [
            ...(body.instagram ? [`ig:${body.instagram}`] : []),
            ...(body.faturamento ? [body.faturamento] : []),
            ...(body.modelo ? [body.modelo] : []),
          ],
        },
        update: {
          email: body.email || undefined,
        },
      }).catch(async () => {
        // Se phone for null, não tem unique — cria direto
        return this.prisma.contact.create({
          data: {
            tenantId: tenant.id,
            name: body.name,
            phone,
            email: body.email || null,
            tags: [
              ...(body.instagram ? [`ig:${body.instagram}`] : []),
              ...(body.faturamento ? [body.faturamento] : []),
              ...(body.modelo ? [body.modelo] : []),
            ],
          },
        });
      });

      // Busca o pipeline e a etapa correta
      const pipeline = await this.prisma.pipeline.findFirst({
        where: { tenantId: tenant.id },
        include: { stages: { orderBy: { position: 'asc' } } },
      });

      if (pipeline && pipeline.stages.length > 0) {
        // Tenta encontrar a etapa pelo nome (case-insensitive), senão usa a primeira
        const targetStage = body.stageName
          ? (pipeline.stages.find(
              (s) => s.name.toLowerCase() === body.stageName!.toLowerCase(),
            ) ?? pipeline.stages[0])
          : pipeline.stages[0];

        const count = await this.prisma.pipelineLead.count({ where: { stageId: targetStage.id } });

        await this.prisma.pipelineLead.create({
          data: {
            stageId: targetStage.id,
            contactId: contact.id,
            position: count,
            notes: [
              body.faturamento ? `Faturamento: ${body.faturamento}` : '',
              body.modelo ? `Modelo: ${body.modelo}` : '',
              body.utmSource ? `UTM: ${body.utmSource}/${body.utmMedium}/${body.utmCampaign}` : '',
            ].filter(Boolean).join(' | ') || null,
          },
        });
      }

      return { ok: true, contactId: contact.id };
    } catch (err: any) {
      console.error('Webhook lead error:', err.message);
      return { ok: false, error: err.message };
    }
  }
}
