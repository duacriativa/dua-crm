import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

const META_API_VERSION = 'v19.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Processa eventos recebidos via webhook da Meta.
   * Suporta: mensagens recebidas, status de entrega/leitura.
   */
  async processWebhookEvent(payload: any) {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;

    if (!changes) return;

    const phoneNumberId = changes.metadata?.phone_number_id;

    // Encontra o tenant pelo phoneNumberId
    const credential = await this.prisma.metaCredential.findFirst({
      where: { phoneNumberId },
    });

    if (!credential) {
      this.logger.warn(`Webhook sem tenant para phoneNumberId: ${phoneNumberId}`);
      return;
    }

    // Processa mensagens recebidas
    if (changes.messages?.length) {
      for (const msg of changes.messages) {
        await this.handleIncomingMessage(credential.tenantId, msg, changes.contacts?.[0]);
      }
    }

    // Processa atualizações de status (enviado, entregue, lido)
    if (changes.statuses?.length) {
      for (const status of changes.statuses) {
        await this.handleStatusUpdate(status);
      }
    }
  }

  private async handleIncomingMessage(
    tenantId: string,
    msg: any,
    metaContact: any,
  ) {
    const phone = `+${msg.from}`;
    const name = metaContact?.profile?.name ?? phone;

    // Upsert do contato
    const contact = await this.prisma.contact.upsert({
      where: { tenantId_phone: { tenantId, phone } },
      create: { tenantId, phone, name },
      update: {},
    });

    // Upsert da conversa (uma por contato/canal)
    const conversation = await this.prisma.conversation.upsert({
      where: { tenantId_externalId: { tenantId, externalId: contact.id } },
      create: {
        tenantId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        externalId: contact.id,
        status: 'OPEN',
      },
      update: { status: 'OPEN', updatedAt: new Date() },
    });

    const type = msg.type ?? 'text';
    const content = this.extractMessageContent(msg);

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        type: type.toUpperCase() as any,
        content,
        externalId: msg.id,
      },
    });

    this.logger.log(`[${tenantId}] Mensagem recebida de ${phone}`);
  }

  private async handleStatusUpdate(status: any) {
    const now = new Date();
    const update: any = {};

    if (status.status === 'delivered') update.deliveredAt = now;
    if (status.status === 'read') update.readAt = now;
    if (status.status === 'failed') update.errorCode = status.errors?.[0]?.code?.toString();

    if (Object.keys(update).length === 0) return;

    await this.prisma.message.updateMany({
      where: { externalId: status.id },
      data: update,
    });
  }

  /**
   * Envia mensagem de texto simples via Meta Cloud API.
   */
  async sendTextMessage(tenantId: string, to: string, text: string) {
    const { token, phoneNumberId } = await this.getCredentials(tenantId);

    const response = await axios.post(
      `${META_BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return response.data;
  }

  /**
   * Envia template aprovado pela Meta (necessário para mensagens ativas).
   */
  async sendTemplate(
    tenantId: string,
    to: string,
    templateName: string,
    languageCode = 'pt_BR',
    components: any[] = [],
  ) {
    const { token, phoneNumberId } = await this.getCredentials(tenantId);

    const response = await axios.post(
      `${META_BASE_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    return response.data;
  }

  private async getCredentials(tenantId: string) {
    const cred = await this.prisma.metaCredential.findUnique({
      where: { tenantId },
    });

    if (!cred) throw new Error(`Credenciais Meta não configuradas para tenant ${tenantId}`);

    const token = this.encryption.decrypt(cred.accessToken);
    return { token, phoneNumberId: cred.phoneNumberId };
  }

  private extractMessageContent(msg: any): string {
    switch (msg.type) {
      case 'text': return msg.text?.body ?? '';
      case 'image': return msg.image?.caption ?? '[imagem]';
      case 'audio': return '[áudio]';
      case 'video': return msg.video?.caption ?? '[vídeo]';
      case 'document': return msg.document?.filename ?? '[documento]';
      default: return `[${msg.type}]`;
    }
  }
}
