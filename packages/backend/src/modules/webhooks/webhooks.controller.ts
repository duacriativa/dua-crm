import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Post('asaas')
  @HttpCode(200)
  async receiveAsaas(@Body() body: any) {
    const event = body?.event;
    const payment = body?.payment;

    this.logger.log(`Asaas webhook: ${event} — ${payment?.id} R$${payment?.value}`);

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

      // Emite evento SSE para notificação no browser
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        this.events.emit('asaas.payment', {
          type: 'payment_received',
          customerName: payment.customerName ?? payment.customer,
          value: payment.value,
          description: payment.description,
          paidAt: new Date().toISOString(),
        });
        this.logger.log(`💰 Pagamento recebido: ${payment.customer} R$${payment.value}`);
      }

      if (event === 'PAYMENT_OVERDUE') {
        this.events.emit('asaas.payment', {
          type: 'payment_overdue',
          customerName: payment.customerName ?? payment.customer,
          value: payment.value,
          dueDate: payment.dueDate,
        });
      }

    } catch (err: any) {
      this.logger.error('Asaas webhook error: ' + err.message);
    }

    return { ok: true };
  }

  @Post('lead')
  @HttpCode(200)
  async receiveLead(@Body() body: any) {
    try {
      const slug = body.clientSlug || 'dua-criativa';
      const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return { ok: false, error: 'Tenant não encontrado' };

      const phone = body.whatsapp ? `+${body.whatsapp.replace(/\D/g, '')}` : null;

      const contact = await this.prisma.contact.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: phone || '' } },
        create: {
          tenantId: tenant.id,
          name: body.name,
          phone,
          email: body.email || null,
          instagramHandle: body.instagram || null,
          monthlyRevenue: body.faturamento_mensal || body.faturamento || null,
          saleModel: body.modelo_venda || body.modelo || null,
          utmSource: body.utm_source || null,
          utmMedium: body.utm_medium || null,
          utmCampaign: body.utm_campaign || null,
          tags: [
            body.faturamento_mensal || body.faturamento,
            body.modelo_venda || body.modelo,
          ].filter(Boolean) as string[],
        },
        update: {
          email: body.email || undefined,
          monthlyRevenue: body.faturamento_mensal || body.faturamento || undefined,
          saleModel: body.modelo_venda || body.modelo || undefined,
          utmSource: body.utm_source || undefined,
          utmMedium: body.utm_medium || undefined,
          utmCampaign: body.utm_campaign || undefined,
        },
      }).catch(async () => {
        return this.prisma.contact.create({
          data: {
            tenantId: tenant.id,
            name: body.name,
            phone,
            email: body.email || null,
            instagramHandle: body.instagram || null,
            monthlyRevenue: body.faturamento_mensal || body.faturamento || null,
            saleModel: body.modelo_venda || body.modelo || null,
            utmSource: body.utm_source || null,
            utmMedium: body.utm_medium || null,
            utmCampaign: body.utm_campaign || null,
            tags: [body.faturamento_mensal || body.faturamento, body.modelo_venda || body.modelo].filter(Boolean) as string[],
          },
        });
      });

      const pipeline = await this.prisma.pipeline.findFirst({
        where: { tenantId: tenant.id },
        include: { stages: { orderBy: { position: 'asc' } } },
      });

      if (pipeline && pipeline.stages.length > 0) {
        const targetStage = body.stageName
          ? (pipeline.stages.find((s) => s.name.toLowerCase() === body.stageName.toLowerCase()) ?? pipeline.stages[0])
          : pipeline.stages[0];

        const count = await this.prisma.pipelineLead.count({ where: { stageId: targetStage.id } });
        await this.prisma.pipelineLead.create({
          data: {
            stageId: targetStage.id,
            contactId: contact.id,
            position: count,
            notes: [
              body.faturamento_mensal ? `Faturamento: ${body.faturamento_mensal}` : '',
              body.modelo_venda ? `Modelo: ${body.modelo_venda}` : '',
              body.utm_source ? `UTM: ${body.utm_source}/${body.utm_medium}` : '',
            ].filter(Boolean).join(' | ') || null,
          },
        });
      }

      return { ok: true, contactId: contact.id };
    } catch (err: any) {
      this.logger.error('Webhook lead error: ' + err.message);
      return { ok: false, error: err.message };
    }
  }
}
