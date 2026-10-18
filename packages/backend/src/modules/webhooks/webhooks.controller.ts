import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FunnelService } from '../pipelines/funnel.service';
import { normalizePhone, phoneVariants } from '../../common/phone.util';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly funnel: FunnelService,
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

  @Post('kommo')
  @HttpCode(200)
  async receiveKommo(@Body() body: any) {
    try {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: 'dua-criativa' } });
      if (!tenant) return { ok: true };

      const tenantId = tenant.id;

      const processLeads = async (leads: any[], status?: string) => {
        for (const lead of leads) {
          const kommoId = parseInt(lead.id, 10);
          if (!kommoId) continue;
          await this.prisma.$executeRaw`
            INSERT INTO "KommoLead" ("id", "tenantId", "kommoId", "name", "stageId", "stageName", "status", "value", "updatedAt")
            VALUES (gen_random_uuid()::text, ${tenantId}, ${kommoId}, ${lead.name ?? 'Lead'}, ${lead.status_id ? parseInt(lead.status_id, 10) : null}, ${lead.pipeline_id ?? null}, ${status ?? 'active'}, ${lead.price ? parseInt(lead.price, 10) : 0}, NOW())
            ON CONFLICT ("tenantId", "kommoId") DO UPDATE
              SET "name" = EXCLUDED."name",
                  "stageId" = COALESCE(EXCLUDED."stageId", "KommoLead"."stageId"),
                  "status" = EXCLUDED."status",
                  "value" = EXCLUDED."value",
                  "updatedAt" = NOW()
          `;
        }
      };

      const leadsData = body?.leads ?? {};
      if (leadsData.add?.length)    await processLeads(leadsData.add, 'active');
      if (leadsData.update?.length) await processLeads(leadsData.update);
      if (leadsData.status?.length) await processLeads(leadsData.status);
      if (leadsData.delete?.length) {
        for (const lead of leadsData.delete) {
          const kommoId = parseInt(lead.id, 10);
          if (kommoId) await this.prisma.$executeRaw`DELETE FROM "KommoLead" WHERE "tenantId" = ${tenantId} AND "kommoId" = ${kommoId}`;
        }
      }

      return { ok: true };
    } catch (err: any) {
      this.logger.error('Kommo webhook error: ' + err.message);
      return { ok: true };
    }
  }

  @Post('lead')
  @HttpCode(200)
  async receiveLead(@Body() body: any) {
    try {
      const slug = body.clientSlug || 'dua-criativa';
      const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!tenant) return { ok: false, error: 'Tenant não encontrado' };

      // Mesmo formato do WhatsApp (+55...), senão quem preenche o form e depois
      // chama no WhatsApp vira dois contatos
      const phone = body.whatsapp ? normalizePhone(String(body.whatsapp)) : null;
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null;

      // O site manda UTMs em camelCase com "-" quando não há; aceita os dois formatos
      const utm = (snake: string, camel: string) => {
        const v = body[snake] ?? body[camel];
        return typeof v === 'string' && v.trim() && v.trim() !== '-' ? v.trim() : null;
      };
      const utmSource = utm('utm_source', 'utmSource');
      const utmMedium = utm('utm_medium', 'utmMedium');
      const utmCampaign = utm('utm_campaign', 'utmCampaign');
      const faturamento = body.faturamento_mensal || body.faturamento || null;
      const modelo = body.modelo_venda || body.modelo || null;

      // Procura pelo telefone (com/sem nono dígito) e, sem telefone, pelo e-mail
      const existing = phone
        ? await this.prisma.contact.findFirst({ where: { tenantId: tenant.id, phone: { in: phoneVariants(phone) } } })
        : email
          ? await this.prisma.contact.findFirst({ where: { tenantId: tenant.id, email: { equals: email, mode: 'insensitive' } } })
          : null;

      const contact = existing
        ? await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              // Contato criado pelo WhatsApp fica com o número/perfil como nome; o do form é melhor
              name: body.name && (!existing.name || existing.name === existing.phone) ? body.name : undefined,
              email: email ?? undefined,
              instagramHandle: existing.instagramHandle ? undefined : body.instagram || undefined,
              monthlyRevenue: faturamento ?? undefined,
              saleModel: modelo ?? undefined,
              utmSource: utmSource ?? undefined,
              utmMedium: utmMedium ?? undefined,
              utmCampaign: utmCampaign ?? undefined,
              tags: [...new Set([...(existing.tags ?? []), faturamento, modelo].filter(Boolean) as string[])],
            },
          })
        : await this.prisma.contact.create({
            data: {
              tenantId: tenant.id,
              type: 'LEAD',
              name: body.name,
              phone,
              email,
              instagramHandle: body.instagram || null,
              monthlyRevenue: faturamento,
              saleModel: modelo,
              utmSource,
              utmMedium,
              utmCampaign,
              tags: [faturamento, modelo].filter(Boolean) as string[],
            },
          });

      // Cai na primeira etapa do funil principal, igual aos leads do WhatsApp.
      // Clique anônimo no botão de WhatsApp (sem telefone nem e-mail) não vira card:
      // a conversa em si já entra no funil pelo canal do WhatsApp.
      if (phone || email) {
        const leadNotes = [
          'Origem: Site',
          faturamento ? `Faturamento: ${faturamento}` : '',
          modelo ? `Modelo: ${modelo}` : '',
          utmSource ? `UTM: ${[utmSource, utmMedium, utmCampaign].filter(Boolean).join('/')}` : '',
        ].filter(Boolean).join(' | ');
        await this.funnel.ensureLead(tenant.id, contact.id, leadNotes);
      }

      return { ok: true, contactId: contact.id };
    } catch (err: any) {
      this.logger.error('Webhook lead error: ' + err.message);
      return { ok: false, error: err.message };
    }
  }
}
