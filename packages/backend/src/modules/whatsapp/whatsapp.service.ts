import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly evolutionUrl = process.env.EVOLUTION_API_URL;
  private readonly evolutionKey = process.env.EVOLUTION_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private get headers() {
    return { apikey: this.evolutionKey, 'Content-Type': 'application/json' };
  }

  async connect(instanceName: string) {
    try {
      // Tenta criar instância na Evolution API
      await axios.post(
        `${this.evolutionUrl}/instance/create`,
        { instanceName, qrcode: true },
        { headers: this.headers },
      ).catch(() => {}); // ignora se já existir

      // Busca QR code
      const res = await axios.get(
        `${this.evolutionUrl}/instance/connect/${instanceName}`,
        { headers: this.headers },
      );

      const qrCode = res.data?.base64 || res.data?.qrcode?.base64;
      if (qrCode) {
        return { qrCode: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}` };
      }

      // Se já está conectado
      return { connected: true };
    } catch (err: any) {
      this.logger.error('Erro ao conectar Evolution API:', err.message);
      throw new Error('Não foi possível gerar o QR code. Verifique a Evolution API.');
    }
  }

  async getStatus(instanceName: string) {
    try {
      const res = await axios.get(
        `${this.evolutionUrl}/instance/connectionState/${instanceName}`,
        { headers: this.headers },
      );
      const state = res.data?.instance?.state || res.data?.state;
      return { connected: state === 'open' };
    } catch {
      return { connected: false };
    }
  }

  async disconnect(instanceName: string) {
    try {
      await axios.delete(
        `${this.evolutionUrl}/instance/logout/${instanceName}`,
        { headers: this.headers },
      );
    } catch (err: any) {
      this.logger.error('Erro ao desconectar:', err.message);
    }
  }

  async sendTextMessage(instanceName: string, to: string, text: string) {
    const phone = to.replace(/\D/g, '');
    const res = await axios.post(
      `${this.evolutionUrl}/message/sendText/${instanceName}`,
      { number: phone, textMessage: { text } },
      { headers: this.headers },
    );
    return res.data;
  }

  async processWebhook(payload: any) {
    try {
      const event = payload?.event;
      const instance = payload?.instance;

      if (event === 'messages.upsert') {
        const msg = payload?.data?.messages?.[0] || payload?.data;
        if (!msg || msg.key?.fromMe) return;

        const phone = `+${msg.key?.remoteJid?.replace('@s.whatsapp.net', '')}`;
        const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '[mídia]';
        const pushName = msg.pushName || phone;

        // Encontra tenant pela instância (instanceName = tenantId)
        const tenant = await this.prisma.tenant.findFirst({ where: { id: instance } });
        if (!tenant) return;

        // Upsert contato
        const contact = await this.prisma.contact.upsert({
          where: { tenantId_phone: { tenantId: tenant.id, phone } },
          create: { tenantId: tenant.id, phone, name: pushName },
          update: {},
        });

        // Upsert conversa
        const conversation = await this.prisma.conversation.upsert({
          where: { tenantId_externalId: { tenantId: tenant.id, externalId: phone } },
          create: { tenantId: tenant.id, contactId: contact.id, channel: 'WHATSAPP', externalId: phone, status: 'OPEN' },
          update: { status: 'OPEN', updatedAt: new Date() },
        });

        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            type: 'TEXT',
            content,
            externalId: msg.key?.id,
          },
        });

        this.logger.log(`Mensagem de ${phone} salva`);
      }
    } catch (err: any) {
      this.logger.error('Erro no webhook:', err.message);
    }
  }
}
