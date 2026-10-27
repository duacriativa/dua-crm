import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
type ContactSegment = 'NEW' | 'ACTIVE' | 'VIP' | 'AT_RISK' | 'DORMANT';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters?: {
    type?: 'LEAD' | 'CLIENT';
    segment?: ContactSegment;
    tags?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (filters?.type) where.type = filters.type;
    if (filters?.segment) where.segment = filters.segment;
    if (filters?.tags?.length) where.tags = { hasSome: filters.tags };
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take: limit,
        // Enum ContactSegment é declarado como NEW, ACTIVE, VIP, AT_RISK, DORMANT —
        // ordenar 'asc' por ele naturalmente joga os inativos (DORMANT) pro final,
        // sem misturar com os clientes ativos no topo da lista.
        orderBy: [{ segment: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          phone: true,
          instagramHandle: true,
          email: true,
          tags: true,
          segment: true,
          type: true,
          clientSince: true,
          totalSpent: true,
          orderCount: true,
          lastPurchaseAt: true,
          createdAt: true,
          notes: true,
          contracts: {
            where: { status: 'ACTIVE' },
            select: { monthlyValue: true, serviceType: true },
            take: 1,
          },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { contacts, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 10 },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { id: true, channel: true, status: true, updatedAt: true },
        },
        // Contratos ativos: mostram a marca/serviço de quem já é cliente
        contracts: {
          where: { status: 'ACTIVE' },
          orderBy: { startsAt: 'desc' },
          select: { id: true, clientName: true, serviceType: true, monthlyValue: true },
        },
      },
    });

    if (!contact) throw new NotFoundException('Contato não encontrado.');
    return contact;
  }

  /**
   * Tudo que o contato já comprou: vendas ganhas no funil (serviço pontual),
   * contratos (recorrentes) e pedidos pagos do Plano 90 dias.
   */
  async purchaseHistory(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, tenantId }, select: { id: true, name: true } });
    if (!contact) throw new NotFoundException('Contato não encontrado.');

    const [sales, contracts, plans] = await Promise.all([
      this.prisma.pipelineLead.findMany({
        where: { contactId, wonAt: { not: null }, lostAt: null, stage: { pipeline: { tenantId } } },
        select: { id: true, value: true, wonItem: true, wonAt: true, stage: { select: { pipeline: { select: { name: true } } } } },
      }),
      this.prisma.contract.findMany({
        // Contrato cadastrado pelo card do cliente não grava contactId: casa também pelo nome
        where: { tenantId, OR: [{ contactId }, { contactId: null, clientName: { equals: contact.name.trim(), mode: 'insensitive' } }] },
        select: {
          id: true, serviceType: true, description: true, monthlyValue: true, status: true,
          startsAt: true, endsAt: true, cancelledAt: true,
          financialEntries: { where: { isCommission: false }, select: { value: true, status: true } },
        },
      }),
      this.prisma.planOrder.findMany({
        where: { contactId, tenantId, paidAt: { not: null } },
        select: { id: true, productName: true, value: true, paidAt: true, status: true },
      }),
    ]);

    const now = new Date();
    const items = [
      ...sales.map((l) => ({
        kind: 'SALE' as const,
        id: l.id,
        date: l.wonAt!,
        title: l.wonItem || 'Venda fechada',
        detail: `Funil ${l.stage.pipeline.name}`,
        value: l.value ?? 0,
        estimated: false,
        status: 'WON',
      })),
      ...contracts.map((c) => {
        // Valor já pago pelas cobranças; contrato cadastrado à mão sem cobranças
        // usa mensalidade × meses ativos (marcado como estimado)
        const paid = c.financialEntries.filter((e) => e.status === 'PAID').reduce((sum, e) => sum + e.value, 0);
        const end = c.cancelledAt ?? (c.endsAt && c.endsAt < now ? c.endsAt : now);
        const months = Math.max(1, (end.getFullYear() - c.startsAt.getFullYear()) * 12 + end.getMonth() - c.startsAt.getMonth() + 1);
        const estimated = c.financialEntries.length === 0 && c.startsAt <= now;
        return {
          kind: 'CONTRACT' as const,
          id: c.id,
          date: c.startsAt,
          title: c.description?.trim() || c.serviceType,
          serviceType: c.serviceType,
          detail: `R$ ${c.monthlyValue.toLocaleString('pt-BR')}/mês`,
          value: estimated ? c.monthlyValue * months : paid,
          estimated,
          status: c.status,
        };
      }),
      ...plans.map((o) => ({
        kind: 'PLAN' as const,
        id: o.id,
        date: o.paidAt!,
        title: o.productName,
        detail: 'Pago no Pix',
        value: o.value,
        estimated: false,
        status: o.status,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const total = items.reduce((sum, i) => sum + i.value, 0);
    return { total, count: items.length, hasEstimate: items.some((i) => i.estimated), items };
  }

  /**
   * Recalcula o segmento do contato baseado no histórico de compras.
   * Chamado após cada novo pedido.
   */
  async recalculateSegment(tenantId: string, contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact || contact.tenantId !== tenantId) return;

    const now = new Date();
    const daysSinceLastPurchase = contact.lastPurchaseAt
      ? (now.getTime() - contact.lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24)
      : null;

    let segment: ContactSegment;

    if (contact.orderCount === 0) {
      segment = 'NEW';
    } else if (daysSinceLastPurchase !== null && daysSinceLastPurchase > 60) {
      segment = 'DORMANT';
    } else if (daysSinceLastPurchase !== null && daysSinceLastPurchase > 30) {
      segment = 'AT_RISK';
    } else if (contact.totalSpent >= 1000 && contact.orderCount >= 3) {
      segment = 'VIP';
    } else {
      segment = 'ACTIVE';
    }

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { segment },
    });
  }
}
