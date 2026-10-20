import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppCloudService } from '../whatsapp-cloud/whatsapp-cloud.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloud: WhatsAppCloudService,
  ) {}

  /** Número do contato para a Cloud API (sem LID/grupo). */
  private cloudRecipient(conv: { externalId: string | null; contact: { phone: string | null } }) {
    const ext = conv.externalId || '';
    if (ext.endsWith('@g.us')) throw new BadRequestException('A API oficial não envia mensagens para grupos.');
    const digits = (conv.contact.phone || '').replace(/\D/g, '') || (ext.endsWith('@s.whatsapp.net') ? ext.replace(/\D/g, '') : '');
    if (!digits) throw new BadRequestException('Contato sem número de telefone válido para a API oficial.');
    return digits;
  }

  private async ensureCloudConnected(tenantId: string) {
    if (!(await this.cloud.isConnected(tenantId))) {
      throw new BadRequestException('WhatsApp oficial não conectado. Conecte o número na tela do WhatsApp.');
    }
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
            select: { id: true, name: true, phone: true, email: true, tags: true, segment: true, profilePicUrl: true, qualification: true, type: true },
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

    // Conta não lidas (mensagens INBOUND sem readAt) numa única consulta
    const unread = conversations.length
      ? await this.prisma.message.groupBy({
          by: ['conversationId'],
          where: { conversationId: { in: conversations.map((c) => c.id) }, direction: 'INBOUND', readAt: null },
          _count: { _all: true },
        })
      : [];
    const unreadByConv = new Map(unread.map((u) => [u.conversationId, u._count._all]));

    const convsWithMeta = conversations.map((conv) => ({
      ...conv,
      contactName: conv.contact.name,
      contactPhone: conv.contact.phone,
      profilePicUrl: conv.profilePicUrl || conv.contact.profilePicUrl,
      isGroup: conv.externalId?.endsWith('@g.us'),
      lastMessage: conv.messages[0]?.content ?? null,
      unreadCount: unreadByConv.get(conv.id) ?? 0,
      messages: undefined, // não retorna array completo
    }));

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
      orderBy: { sentAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        externalId: true,
        content: true,
        direction: true,
        type: true,
        mediaUrl: true,
        senderName: true,
        quotedContent: true,
        quotedExternalId: true,
        quotedType: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        errorCode: true,
      },
    });

    // Marca como lidas as mensagens INBOUND desta conversa
    await this.prisma.message.updateMany({
      where: { conversationId, direction: 'INBOUND', readAt: null },
      data: { readAt: new Date() },
    });

    return messages.reverse();
  }

  async sendMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    quotedExternalId?: string,
    quotedContent?: string,
    quotedType?: string,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    await this.ensureCloudConnected(tenantId);
    const { externalId } = await this.cloud.sendText(tenantId, this.cloudRecipient(conv), content, quotedExternalId);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content,
        sentAt: new Date(),
        externalId,
        quotedContent: quotedContent || null,
        quotedExternalId: quotedExternalId || null,
        quotedType: quotedType || null,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  }

  async sendMedia(
    tenantId: string,
    conversationId: string,
    base64: string,
    mediatype: 'image' | 'video' | 'document' | 'audio',
    filename: string,
    caption: string,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: { select: { phone: true } } },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const msgTypeOf = (t: string) => (t === 'image' ? 'IMAGE' : t === 'video' ? 'VIDEO' : t === 'audio' ? 'AUDIO' : 'DOCUMENT');

    await this.ensureCloudConnected(tenantId);
    const { externalId, mediaId } = await this.cloud.sendMedia(tenantId, this.cloudRecipient(conv), base64, mediatype, filename, caption);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: msgTypeOf(mediatype),
        content: caption || filename,
        sentAt: new Date(),
        externalId,
        mediaId,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return message;
  }

  async remove(tenantId: string, conversationId: string) {
    await this.prisma.conversation.deleteMany({
      where: { id: conversationId, tenantId },
    });
    return { ok: true };
  }

  async clearHistory(tenantId: string) {
    // Apaga todas as mensagens de todas as conversas do tenant
    const convIds = await this.prisma.conversation.findMany({
      where: { tenantId },
      select: { id: true },
    });
    const ids = convIds.map(c => c.id);
    if (ids.length > 0) {
      await this.prisma.message.deleteMany({ where: { conversationId: { in: ids } } });
    }
    await this.prisma.conversation.deleteMany({ where: { tenantId } });
    return { ok: true, deleted: ids.length };
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

  async redownloadMedia(tenantId: string, conversationId: string, messageId: string) {
    // Verifica que a conversa pertence ao tenant
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!msg) throw new NotFoundException('Mensagem não encontrada.');

    // Mídia da API oficial: baixa sob demanda pelo media id
    if (msg.mediaId) {
      try {
        const dataUri = await this.cloud.downloadMedia(tenantId, msg.mediaId);
        await this.prisma.message.update({ where: { id: messageId }, data: { mediaUrl: dataUri } });
        return { mediaUrl: dataUri };
      } catch (err: any) {
        throw new NotFoundException(`Não foi possível carregar a mídia: ${err?.response?.data?.error?.message ?? err.message}`);
      }
    }

    throw new NotFoundException('Mídia indisponível: só mensagens recebidas pela API oficial podem ser recarregadas.');
  }
}
