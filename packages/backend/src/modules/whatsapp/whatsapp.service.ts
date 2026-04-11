import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
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
    const timeout = 15000; // 15s timeout por chamada
    this.logger.log(`[connect] Iniciando conexão para instância: ${instanceName}`);
    this.logger.log(`[connect] Evolution URL: ${this.evolutionUrl}`);

    try {
      // Passo 1: verifica se a instância já existe
      this.logger.log(`[connect] Verificando se instância já existe via GET /instance/fetchInstances...`);
      let instanceExists = false;
      try {
        const fetchRes = await axios.get(
          `${this.evolutionUrl}/instance/fetchInstances`,
          { headers: this.headers, timeout, params: { instanceName } },
        );
        const instances: any[] = Array.isArray(fetchRes.data) ? fetchRes.data : [];
        instanceExists = instances.some(
          (i) => i?.instance?.instanceName === instanceName || i?.instanceName === instanceName,
        );
        this.logger.log(`[connect] Instância ${instanceExists ? 'JÁ EXISTE' : 'não existe'} na Evolution API`);
      } catch (fetchErr: any) {
        this.logger.warn(`[connect] Não foi possível verificar instâncias existentes: ${fetchErr?.response?.status ?? fetchErr.message} — prosseguindo com criação`);
      }

      // Passo 2: cria instância apenas se não existir
      if (!instanceExists) {
        this.logger.log(`[connect] Criando instância...`);
        try {
          const createRes = await axios.post(
            `${this.evolutionUrl}/instance/create`,
            { instanceName, qrcode: true },
            { headers: this.headers, timeout },
          );
          this.logger.log(`[connect] Instância criada. Status: ${createRes.status}`);

          // Verifica se o QR já veio na resposta de criação
          const createQr = createRes.data?.qrcode?.base64 || createRes.data?.base64;
          if (createQr) {
            this.logger.log('[connect] QR code obtido na criação da instância');
            return { qrCode: createQr.startsWith('data:') ? createQr : `data:image/png;base64,${createQr}` };
          }
        } catch (createErr: any) {
          const status = createErr?.response?.status;
          if (status === 422 || status === 409) {
            this.logger.warn(`[connect] Criação retornou ${status} (instância já existe) — continuando`);
          } else {
            this.logger.error(`[connect] Erro ao criar instância: ${status ?? createErr.message}`);
            this.logger.error(`[connect] Detalhes: ${JSON.stringify(createErr?.response?.data ?? '')}`);
            throw new HttpException(
              `Não foi possível criar a instância WhatsApp: ${createErr?.response?.data?.message ?? createErr.message}`,
              HttpStatus.BAD_GATEWAY,
            );
          }
        }
      } else {
        this.logger.log(`[connect] Pulando criação — instância já existe`);
      }

      // Passo 4: configura webhook
      const webhookUrl = process.env.WEBHOOK_URL ||
        `https://renewed-youth-production-7d32.up.railway.app/api/v1/whatsapp/webhook`;
      const webhookBody = {
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      };
      this.logger.log(`[connect] Configurando webhook -> ${webhookUrl}`);
      await axios.post(
        `${this.evolutionUrl}/webhook/set/${instanceName}`,
        webhookBody,
        { headers: this.headers, timeout },
      ).then(() => this.logger.log('[connect] Webhook configurado'))
       .catch((e) => this.logger.error('[connect] Webhook falhou:', JSON.stringify(e?.response?.data ?? e.message)));

      // Passo 5: busca QR code
      this.logger.log(`[connect] Buscando QR code via GET /instance/connect/${instanceName}...`);
      const res = await axios.get(
        `${this.evolutionUrl}/instance/connect/${instanceName}`,
        { headers: this.headers, timeout },
      );
      this.logger.log(`[connect] Resposta /instance/connect: ${JSON.stringify(res.data)?.substring(0, 200)}`);

      // Passo 6: retorna QR code se disponível
      const qrCode = res.data?.base64 || res.data?.qrcode?.base64;
      if (qrCode) {
        this.logger.log('[connect] QR code obtido com sucesso');
        return { qrCode: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}` };
      }

      // Passo 7: instância já está conectada (open)
      const state = res.data?.instance?.state || res.data?.state;
      if (state === 'open') {
        this.logger.log('[connect] Instância já está conectada (state=open)');
        return { connected: true };
      }

      this.logger.log('[connect] Nenhum QR code e estado não é "open" — assumindo conectado');
      return { connected: true };

    } catch (err: any) {
      // Re-lança HttpException sem encapsular
      if (err instanceof HttpException) throw err;

      this.logger.error(`[connect] Erro inesperado: ${err.message}`);
      this.logger.error(`[connect] Detalhes: ${JSON.stringify(err?.response?.data ?? '')}`);
      throw new HttpException(
        `Não foi possível gerar o QR code: ${err.message}`,
        HttpStatus.BAD_GATEWAY,
      );
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
      { number: phone, text },
      { headers: this.headers },
    );
    return res.data;
  }

  async processWebhook(payload: any) {
    try {
      const event = payload?.event;
      const instance = payload?.instance;
      this.logger.log(`Webhook recebido: event=${event} instance=${instance}`);

      if (event === 'messages.upsert') {
        const msg = payload?.data?.messages?.[0] || payload?.data;
        if (!msg || msg.key?.fromMe) return;

        const remoteJid = msg.key?.remoteJid || '';
        // Ignora grupos
        if (remoteJid.endsWith('@g.us')) return;

        // Suporte a @lid (WhatsApp Business multi-device) e @s.whatsapp.net
        const rawId = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
        const phone = remoteJid.endsWith('@lid') ? `lid:${rawId}` : `+${rawId}`;
        const pushName = msg.pushName || phone;

        // Detecta tipo e conteúdo
        let content = '';
        let msgType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'TEXT';
        let mediaUrl: string | null = null;
        let quotedContent: string | null = null;
        let quotedExternalId: string | null = null;
        let quotedType: string | null = null;

        const m = msg.message;

        // Extrai mensagem citada (reply) de qualquer tipo de mensagem
        const ctx = m?.extendedTextMessage?.contextInfo
          || m?.imageMessage?.contextInfo
          || m?.videoMessage?.contextInfo
          || m?.documentMessage?.contextInfo
          || m?.audioMessage?.contextInfo;
        if (ctx?.stanzaId && ctx?.quotedMessage) {
          quotedExternalId = ctx.stanzaId;
          const qm = ctx.quotedMessage;
          quotedContent = qm.conversation || qm.extendedTextMessage?.text
            || qm.imageMessage?.caption || qm.videoMessage?.caption
            || qm.documentMessage?.fileName || '[mídia]';
          if (qm.imageMessage) quotedType = 'IMAGE';
          else if (qm.videoMessage) quotedType = 'VIDEO';
          else if (qm.audioMessage) quotedType = 'AUDIO';
          else if (qm.documentMessage) quotedType = 'DOCUMENT';
          else quotedType = 'TEXT';
        }

        if (m?.conversation) {
          content = m.conversation;
        } else if (m?.extendedTextMessage?.text) {
          content = m.extendedTextMessage.text;
        } else if (m?.imageMessage) {
          msgType = 'IMAGE';
          content = m.imageMessage.caption || '[imagem]';
          const thumb = m.imageMessage.jpegThumbnail;
          if (thumb) mediaUrl = `data:image/jpeg;base64,${thumb}`;
        } else if (m?.videoMessage) {
          msgType = 'VIDEO';
          content = m.videoMessage.caption || '[vídeo]';
          const thumb = m.videoMessage.jpegThumbnail;
          if (thumb) mediaUrl = `data:image/jpeg;base64,${thumb}`;
        } else if (m?.audioMessage || m?.ptvMessage) {
          msgType = 'AUDIO';
          content = '[áudio]';
        } else if (m?.documentMessage) {
          msgType = 'DOCUMENT';
          content = m.documentMessage.fileName || m.documentMessage.caption || '[documento]';
        } else if (m?.stickerMessage) {
          msgType = 'IMAGE';
          content = '[figurinha]';
        } else {
          content = '[mídia]';
        }

        this.logger.log(`Mensagem de ${phone} (${pushName}) [${msgType}]: ${content}`);

        // Encontra tenant pela instância (instanceName = tenant slug)
        const tenant = await this.prisma.tenant.findFirst({ where: { slug: instance } });
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

        // Deduplica: ignora se já temos essa mensagem pelo externalId
        const msgExternalId = msg.key?.id;
        if (msgExternalId) {
          const already = await this.prisma.message.findFirst({
            where: { externalId: msgExternalId },
          });
          if (already) {
            this.logger.log(`Mensagem duplicada ignorada: ${msgExternalId}`);
            return;
          }
        }

        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            type: msgType,
            content,
            mediaUrl,
            externalId: msgExternalId,
            quotedContent,
            quotedExternalId,
            quotedType,
          },
        });

        this.logger.log(`Mensagem de ${phone} salva`);
      }
    } catch (err: any) {
      this.logger.error('Erro no webhook:', err.message);
    }
  }
}
