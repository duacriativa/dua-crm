import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
type ContactSegment = 'NEW' | 'ACTIVE' | 'VIP' | 'AT_RISK' | 'DORMANT';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters?: {
    segment?: ContactSegment;
    tags?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 20, 100); // máx 100 por página
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

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
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          instagramHandle: true,
          email: true,
          tags: true,
          segment: true,
          totalSpent: true,
          orderCount: true,
          lastPurchaseAt: true,
          createdAt: true,
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
      },
    });

    if (!contact) throw new NotFoundException('Contato não encontrado.');
    return contact;
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
