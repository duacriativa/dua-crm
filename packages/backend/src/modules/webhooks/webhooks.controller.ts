import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /webhooks/asaas
   * Webhook do Asaas — notifica pagamentos confirmados
   * Configurar no Asaas: Integrações → Webhook → URL → /api/v1/webhooks/asaas
   */
  @Post('asaas')
  @HttpCode(200)
  async receiveAsaas(@Body() body: any) {
    const event = body?.event;
    const payment = body?.payment;

    this.logger.log(`Asaas webhook: ${event} — ${payment?.id}`);

    if (!event || !payment) return { ok: true };

    try {
      // Atualiza FinancialEntry se existir
      if (payment.id) {
        const entry = await this.prisma.financialEntry.findUnique({
          where: { asaasPaymentId: payment.id },
        });

        if (entry) {
          if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            await this.prisma.financialEntry.update({
              where: { id: entry.id },
              data: { status: 'PAID', paidAt: new Date() },
            });
          } else if (event === 'PAYMENT_OVERDUE') {
            await this.prisma.financialEntry.update({
              where: { id: entry.id },
              data: { status: 'OVERDUE' },
            });
          }
        }
      }

      // Log do evento para debug
      this.logger.log(
        `Asaas ${event}: cliente=${payment.customer} valor=R$${payment.value} status=${payment.status}`,
      );

    } catch (err: any) {
      this.logger.error('Asaas webhook error: ' + err.message);
    }

    return { ok: true };
  }

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
