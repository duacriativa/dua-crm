import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppCloudService } from '../whatsapp-cloud/whatsapp-cloud.service';
import { InstagramService } from '../instagram/instagram.service';
import { NotifyService } from '../notifications/notify.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloud: WhatsAppCloudService,
    private readonly instagram: InstagramService,
    private readonly notify: NotifyService,
    private readonly events: EventEmitter2,
  ) {}

  /** Mensagem enviada por alguém do time: bots em andamento com esse contato param. */
  private humanSent(tenantId: string, conversationId: string) {
    this.events.emit('conversation.human_message', { tenantId, conversationId });
  }

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

    // "Todas" não mostra as ignoradas (ARCHIVED); elas têm aba própria
    const status = this.normalizeStatus(filters?.status);
    where.status = status ?? { not: 'ARCHIVED' };

    if (filters?.search) {
      where.contact = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search } },
          { instagramHandle: { contains: filters.search.replace(/^@/, ''), mode: 'insensitive' } },
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
            select: { id: true, name: true, phone: true, instagramHandle: true, email: true, tags: true, segment: true, profilePicUrl: true, qualification: true, type: true },
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

    // Instagram: janela de 24h e, até 7 dias, a tag de atendimento humano (sem citação de mensagem)
    let externalId: string | null;
    if (conv.channel === 'INSTAGRAM') {
      ({ externalId } = await this.instagram.sendFromInbox(tenantId, conv, content));
      quotedExternalId = quotedContent = quotedType = undefined;
    } else {
      await this.ensureCloudConnected(tenantId);
      ({ externalId } = await this.cloud.sendText(tenantId, this.cloudRecipient(conv), content, quotedExternalId));
    }
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
    this.humanSent(tenantId, conversationId);
    return message;
  }

  async sendTemplate(
    tenantId: string,
    conversationId: string,
    name: string,
    language: string,
    components: any[],
    preview?: string,
  ) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');
    if (!name) throw new BadRequestException('Escolha um template.');
    if (conv.channel === 'INSTAGRAM') throw new BadRequestException('Templates são só do WhatsApp: no Instagram, responda em até 7 dias depois da última mensagem do contato.');

    await this.ensureCloudConnected(tenantId);
    const { externalId } = await this.cloud.sendTemplate(tenantId, this.cloudRecipient(conv), name, language || 'pt_BR', components);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        type: 'TEMPLATE',
        // Texto já com as variáveis preenchidas (montado no front), para exibir no balão
        content: preview?.trim() || `[template: ${name}]`,
        sentAt: new Date(),
        externalId,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    this.humanSent(tenantId, conversationId);
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
    if (conv.channel === 'INSTAGRAM') throw new BadRequestException('Envio de arquivos pelo Instagram ainda não está disponível no CRM: mande pelo app do Instagram.');

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
    this.humanSent(tenantId, conversationId);
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

  // ── Linha do tempo: notas internas (ficam no contato, não vão para o WhatsApp) ──

  private readonly activitySelect = {
    id: true, type: true, content: true, conversationId: true,
    authorId: true, authorName: true, recipientName: true, createdAt: true,
    author: { select: { name: true } },
  } as const;

  /** Notas do contato desta conversa (de todas as conversas dele), da mais antiga à mais nova */
  async getActivities(tenantId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { contactId: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const activities = await this.prisma.activity.findMany({
      where: { tenantId, contactId: conv.contactId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: this.activitySelect,
    });
    return activities.reverse();
  }

  async createNote(
    tenantId: string, userId: string, conversationId: string, content: string,
    authorName?: string, recipientName?: string,
  ) {
    const text = content?.trim();
    if (!text) throw new BadRequestException('A nota está vazia.');

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { contactId: true, contact: { select: { name: true, phone: true } } },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const recipient = recipientName?.trim() || null;
    const note = await this.prisma.activity.create({
      data: {
        tenantId,
        contactId: conv.contactId,
        conversationId,
        type: 'NOTE',
        content: text,
        authorId: userId,
        authorName: authorName?.trim() || null,
        recipientName: recipient,
      },
      select: this.activitySelect,
    });

    // Mensagem para um colega: avisa os aparelhos (o login é compartilhado, então vai para todos)
    if (recipient) {
      const from = note.authorName || note.author?.name || 'Equipe';
      this.notify.send(tenantId, 'team_note', {
        title: `Para ${recipient} — de ${from}`,
        body: `${conv.contact.name || conv.contact.phone || 'Contato'}: ${text.slice(0, 120)}`,
        url: conv.contact.phone ? `/dashboard/conversas?phone=${encodeURIComponent(conv.contact.phone)}` : '/dashboard/conversas',
        tag: `note-${note.id}`,
      });
    }
    return note;
  }

  async removeActivity(tenantId: string, activityId: string) {
    const { count } = await this.prisma.activity.deleteMany({ where: { id: activityId, tenantId } });
    if (!count) throw new NotFoundException('Nota não encontrada.');
    return { ok: true };
  }

  async updateStatus(tenantId: string, conversationId: string, status: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');
    const next = this.normalizeStatus(status);
    if (!next) throw new BadRequestException('Status inválido.');

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: next },
    });
  }

  /**
   * Aberta (OPEN), Aguardando (IN_PROGRESS), Concluída (RESOLVED), Ignorada (ARCHIVED).
   * "PENDING" é o nome antigo de Aguardando, ainda usado por telas em cache.
   */
  private normalizeStatus(status?: string): ConversationStatus | null {
    if (status === 'PENDING') return 'IN_PROGRESS';
    return status && (Object.values(ConversationStatus) as string[]).includes(status) ? (status as ConversationStatus) : null;
  }

  /** Sugere uma resposta com IA (Claude) a partir das últimas mensagens. Não envia nada. */
  async suggestReply(tenantId: string, conversationId: string, previous?: string, draft?: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new BadRequestException('IA não configurada: defina ANTHROPIC_API_KEY no servidor.');

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true },
    });
    if (!conv) throw new NotFoundException('Conversa não encontrada.');

    const recent = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'desc' },
      take: 30,
      select: { direction: true, type: true, content: true, sentAt: true },
    });
    if (recent.length === 0) throw new BadRequestException('Conversa sem mensagens para analisar.');

    const name = conv.contact?.name || 'Cliente';
    const transcript = recent.reverse().map((m) => {
      const who = m.direction === 'OUTBOUND' ? 'Dua' : name;
      const text = m.type === 'TEXT' ? m.content : `[${m.type.toLowerCase()}] ${m.content ?? ''}`;
      return `${who}: ${text}`;
    }).join('\n');

    const system = [
      'Você é atendente da Dua Criativa, agência de marketing (tráfego pago Meta/Google/TikTok, social media, produção de conteúdo e shootings).',
      process.env.AI_REPLY_CONTEXT || '',
      'Escreva UMA resposta curta para o WhatsApp, em português do Brasil, tom próximo e profissional, como uma pessoa real escreveria.',
      'Não invente preços, prazos, links ou informações que não estejam na conversa. Se faltar informação, faça uma pergunta ou diga que vai verificar.',
      'Não use assinatura nem saudação repetida. Responda só com o texto da mensagem, sem aspas.',
    ].filter(Boolean).join('\n');

    let user = `Conversa com ${name}:\n${transcript}\n\nSugira a próxima mensagem da Dua.`;
    if (draft?.trim()) user += `\nO atendente começou a escrever isto, melhore e complete mantendo a intenção: "${draft.trim()}"`;
    if (previous?.trim()) user += `\nDê uma opção diferente desta: "${previous.trim()}"`;

    try {
      const res = await axios.post('https://api.anthropic.com/v1/messages', {
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: user }],
      }, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        timeout: 30000,
      });
      const suggestion = (res.data?.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('').trim();
      return { suggestion };
    } catch (err: any) {
      throw new BadRequestException(`Falha na IA: ${err?.response?.data?.error?.message ?? err.message}`);
    }
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
