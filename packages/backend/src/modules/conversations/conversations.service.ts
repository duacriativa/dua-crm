import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get evolutionHeaders() {
    return {
      apikey: process.env.EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
    };
  }

  async findAll(
    tenantId: string,
    filters?: { status?: string; search?: string; page?: number; limit?: number },
  ) {
    const page = filters?.page ?? 1;
    const limit = Math.min(filters?.limit ?? 30, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.contact = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
        ],
      };
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          contact: {
            select: { id: true, name: true, phone: true, email: true, tags: true, segment: true },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { content: true, direction: true, sentAt: true },
          },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Conta não lidas (mensagens INBOUND sem readAt)
    const convsWithMeta = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            direction: 'INBOUND',
            readAt: null,
          },
        });
        return {
          ...conv,
          lastMessage: conv.messages[0]?.content ?? null,
          unreadCount,
          messages: undefined, // não retorna array completo
        };
      }),
    );

    return { conversations: convsWithMeta, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id, tenantId },
      include: {
        contact: {
          select: { id: true, name: true, phone: true, email: true, tags: true, segment: true },
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');
    return conv;
  }

  async getMessages(
    tenantId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const skip = (page - 1) * limit;
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        content: true,
        direction: true,
        type: true,
        mediaUrl: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
      },
    });

    // Marca como lidas as mensagens INBOUND desta conversa
    await this.prisma.message.updateMany({
      where: { conversationId, direction: 'INBOUND', readAt: null },
      data: { readAt: new Date() },
    });

    return messages;
  }

  async sendMessage(
    tenantId: string,
    conversationId: string,
    content: string,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const phone = conv.externalId.replace(/\D/g, '');

    // Envia via Evolution API (instanceName = tenant slug)
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const instanceName = tenant?.slug ?? tenantId;
    const evolutionUrl = `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`;
    const body = { number: phone, textMessage: { text: content } };
    console.log('Evolution API send:', evolutionUrl, JSON.stringify(body));
    try {
      const resp = await axios.post(evolutionUrl, body, { headers: this.evolutionHeaders });
      console.log('Evolution API send ok:', resp.status);
    } catch (err: any) {
      console.error('Evolution API send error:', JSON.stringify(err?.response?.data ?? err.message));
    }

    // Salva no banco
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content,
        sentAt: new Date(),
      },
    });

    // Atualiza updatedAt da conversa
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async remove(tenantId: string, conversationId: string) {
    await this.prisma.conversation.deleteMany({
      where: { id: conversationId, tenantId },
    });
    return { ok: true };
  }

  async startConversation(
    tenantId: string,
    phone: string,
    name?: string,
    firstMessage?: string,
  ) {
    // Normaliza telefone para formato +55...
    const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;
    const digits = normalized.replace(/\D/g, '');

    // Busca ou cria contato
    let contact = await this.prisma.contact.findFirst({
      where: { tenantId, phone: normalized },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: name || normalized,
          phone: normalized,
        },
      });
    }

    // Busca ou cria conversa (tenta por externalId com e sem +)
    let conv = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        OR: [
          { externalId: normalized },
          { externalId: digits },
          { contactId: contact.id },
        ],
      },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true, tags: true, segment: true } },
      },
    });

    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: {
          tenantId,
          contactId: contact.id,
          channel: 'WHATSAPP',
          externalId: normalized,
          status: 'OPEN',
        },
        include: {
          contact: { select: { id: true, name: true, phone: true, email: true, tags: true, segment: true } },
        },
      });
    }

    // Envia primeira mensagem se fornecida
    if (firstMessage?.trim()) {
      await this.sendMessage(tenantId, conv.id, firstMessage.trim());
    }

    return conv;
  }

  async updateStatus(tenantId: string, conversationId: string, status: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: status as any },
    });
  }
}
