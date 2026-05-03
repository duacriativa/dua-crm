import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // Lê sempre do process.env em cada chamada (evita problema de inicialização)
  private get evolutionUrl() {
    return process.env.EVOLUTION_API_URL;
  }

  private get headers() {
    return { apikey: process.env.EVOLUTION_API_KEY, 'Content-Type': 'application/json' };
  }

  /**
   * Normaliza o número de telefone para o padrão internacional (E.164).
   * Se for um número brasileiro (10 ou 11 dígitos) sem DDI, adiciona +55.
   */
  static formatPhone(phone: string): string {
    if (!phone) return '';
    
    // Remove tudo que não é dígito
    let cleaned = phone.replace(/\D/g, '');

    // Se estiver no formato lid:..., não mexe
    if (phone.startsWith('lid:')) return phone;

    // Se começar com 0, remove o zero inicial (comum em alguns cadastros)
    if (cleaned.startsWith('0') && cleaned.length > 10) {
      cleaned = cleaned.substring(1);
    }

    // Regra para Brasil: se tem 10 ou 11 dígitos e não começa com 55, assume que é BR
    // Caso especial: se começa com 55 mas tem apenas 10/11 dígitos no total, 
    // pode ser um DDD 55 (interior RS). Mas o padrão mais seguro é checar o tamanho.
    if ((cleaned.length === 10 || cleaned.length === 11) && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    // Se não tem o +, adiciona por padrão para o DB, 
    // mas a Evolution API costuma preferir sem o + no body do number.
    return cleaned;
  }

  async connect(instanceName: string) {
    const timeout = 30000;
    const url = this.evolutionUrl;
    const key = process.env.EVOLUTION_API_KEY;

    this.logger.log(`[connect] instância=${instanceName} url=${url} key=${key?.substring(0, 8)}...`);

    if (!url || !key) {
      throw new HttpException(
        'Variáveis EVOLUTION_API_URL ou EVOLUTION_API_KEY não configuradas no servidor.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      // Passo 1: verifica se a instância já existe
      let instanceExists = false;
      try {
        const fetchRes = await axios.get(
          `${url}/instance/fetchInstances`,
          { headers: this.headers, timeout },
        );
        const instances: any[] = Array.isArray(fetchRes.data) ? fetchRes.data : [];
        instanceExists = instances.some(
          (i) => i?.instance?.instanceName === instanceName || i?.instanceName === instanceName,
        );
        this.logger.log(`[connect] fetchInstances ok — instância ${instanceExists ? 'JÁ EXISTE' : 'não existe'}`);
      } catch (fetchErr: any) {
        const status = fetchErr?.response?.status;
        this.logger.warn(`[connect] fetchInstances falhou (${status ?? fetchErr.message}) — prosseguindo`);
        // Se for 403, a chave pode estar errada — lançar erro antes de tentar criar
        if (status === 403) {
          throw new HttpException(
            `Acesso negado pela Evolution API (403). Verifique a variável EVOLUTION_API_KEY no Railway. Key usada: ${key?.substring(0, 8)}...`,
            HttpStatus.BAD_GATEWAY,
          );
        }
      }

      // Passo 2: cria instância apenas se não existir
      if (!instanceExists) {
        this.logger.log(`[connect] Criando instância ${instanceName}...`);
        try {
          const createRes = await axios.post(
            `${url}/instance/create`,
            { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS", reject_call: false },
            { headers: this.headers, timeout: 30000 },
          );
          this.logger.log(`[connect] Instância criada. Status: ${createRes.status}`);

          // Verifica se o QR já veio na resposta de criação
          const createQr = createRes.data?.qrcode?.base64 || createRes.data?.base64;
          if (createQr) {
            this.logger.log('[connect] QR code obtido na criação');
            return { qrCode: createQr.startsWith('data:') ? createQr : `data:image/png;base64,${createQr}` };
          }
        } catch (createErr: any) {
          const status = createErr?.response?.status;
          const detail = JSON.stringify(createErr?.response?.data ?? '');
          this.logger.warn(`[connect] Criação retornou ${status} — ${detail}`);
          if (status === 422 || status === 409 || status === 403) {
            // 422/409 = instância já existe; 403 também tratamos como "tenta continuar"
            this.logger.warn(`[connect] Tratando ${status} como instância já existente — continuando`);
          } else {
            throw new HttpException(
              `Não foi possível criar a instância WhatsApp: ${createErr?.response?.data?.message ?? createErr.message}`,
              HttpStatus.BAD_GATEWAY,
            );
          }
        }
      } else {
        this.logger.log(`[connect] Pulando criação — instância já existe`);
      }

      // Passo 3: configura webhook
      const webhookUrl = process.env.WEBHOOK_URL ||
        `https://renewed-youth-production-7d32.up.railway.app/api/v1/whatsapp/webhook`;
      this.logger.log(`[connect] Configurando webhook -> ${webhookUrl}`);
      await axios.post(
        `${url}/webhook/set/${instanceName}`,
        {
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
        { headers: this.headers, timeout },
      ).then(() => this.logger.log('[connect] Webhook configurado'))
       .catch((e) => this.logger.warn('[connect] Webhook falhou (não crítico):', JSON.stringify(e?.response?.data ?? e.message)));

      // Passo 4: busca QR code — v1.8.x retorna imediatamente, tentar até 4x com 1s de intervalo
      this.logger.log(`[connect] Buscando QR via /instance/connect/${instanceName}...`);
      for (let attempt = 1; attempt <= 4; attempt++) {
        if (attempt > 1) await new Promise((r) => setTimeout(r, 1000));
        try {
          const res = await axios.get(
            `${url}/instance/connect/${instanceName}`,
            { headers: this.headers, timeout },
          );
          const raw = JSON.stringify(res.data)?.substring(0, 200);
          this.logger.log(`[connect] Attempt ${attempt}: ${raw}`);

          const qrCode =
            res.data?.base64 ||
            res.data?.qrcode?.base64 ||
            res.data?.qrCode;

          if (qrCode) {
            this.logger.log('[connect] QR code obtido com sucesso');
            return { qrCode: qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}` };
          }

          const state = res.data?.instance?.state || res.data?.state;
          if (state === 'open') {
            this.logger.log('[connect] Instância já conectada (state=open)');
            return { connected: true };
          }
        } catch (pollErr: any) {
          this.logger.warn(`[connect] Attempt ${attempt} falhou: ${pollErr.message}`);
        }
      }

      this.logger.warn('[connect] QR não obtido após 4 tentativas — retornando connected:false');
      return { connected: false, message: 'QR code não gerado. Tente novamente.' };

    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`[connect] Erro inesperado: ${err.message}`);
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
      const state = res.data?.instance?.state || res.data?.state || res.data?.status || res.data?.instance?.status;
      this.logger.log(`[getStatus] instância=${instanceName} status=${state}`);
      return { connected: state === 'open' || state === 'connected' };
    } catch (err: any) {
      this.logger.warn(`[getStatus] erro ao buscar status de ${instanceName}: ${err.message}`);
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
      // ignora se não estiver conectada
    }
    try {
      await axios.delete(
        `${this.evolutionUrl}/instance/delete/${instanceName}`,
        { headers: this.headers },
      );
      this.logger.log(`Instância ${instanceName} deletada com sucesso para recriar na próxima conexão.`);
    } catch (err: any) {
      this.logger.error('Erro ao desconectar/deletar:', err.message);
    }
  }

  async sendTextMessage(instanceName: string, to: string, text: string) {
    const phone = WhatsAppService.formatPhone(to);
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
      // A Evolution API pode enviar a mensagem aninhada em messages[0] ou direto no data
      if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
        let msg = payload?.data?.messages?.[0] || payload?.data;
        if (msg && !msg.key && msg.message?.key) msg = msg.message;

        this.logger.log(`[Webhook] MSG OBJECT: ${JSON.stringify(msg).substring(0, 300)}`);
        
        if (!msg || !msg.key) {
          this.logger.warn(`[Webhook] msg is empty or missing key`);
          return;
        }

        const isFromMe = msg.key?.fromMe === true;
        const remoteJid = msg.key?.remoteJid || '';
        this.logger.log(`[Webhook] isFromMe=${isFromMe} remoteJid=${remoteJid}`);
        if (remoteJid.endsWith('@g.us')) return;

        const rawId = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
        const isLid = remoteJid.endsWith('@lid');
        const phone = isLid ? `lid:${rawId}` : `+${rawId}`;
        const pushName = msg.pushName || phone;

        const tenant = await this.prisma.tenant.findFirst({
          where: {
            OR: [
              { slug: instance },
              { id: instance }
            ]
          }
        });
        if (!tenant) {
          this.logger.warn(`[Webhook] Tenant com identificador ${instance} não encontrado! Abortando.`);
          return;
        }

        let msgType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' = 'TEXT';
        let mediaUrl: string | null = null;
        let quotedContent: string | null = null;
        let quotedExternalId: string | null = null;
        let quotedType: string | null = null;

        const m = msg.message;
        let content = '';

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
          mediaUrl = m?.audioMessage?.url || m?.ptvMessage?.url || null;
        } else if (m?.documentMessage) {
          msgType = 'DOCUMENT';
          content = m.documentMessage.fileName || m.documentMessage.caption || '[documento]';
        } else if (m?.stickerMessage) {
          msgType = 'IMAGE';
          content = '[figurinha]';
        } else {
          content = '[mídia]';
        }

        this.logger.log(`Mensagem de ${phone} fromMe=${isFromMe} [${msgType}]: ${content}`);

        const msgExternalId = msg.key?.id;

        // Verifica duplicata antes de qualquer coisa
        if (msgExternalId) {
          const already = await this.prisma.message.findFirst({ where: { externalId: msgExternalId } });
          if (already) {
            this.logger.log(`Duplicata ignorada: ${msgExternalId}`);
            return;
          }
        }

        let conversationId: string;

        // Busca a conversa por telefone usando o Contato
        const phoneVariants = [phone];
        if (!isLid && rawId.startsWith('55') && rawId.length === 12) {
          phoneVariants.push(`+${rawId.slice(0, 4)}9${rawId.slice(4)}`);
        } else if (!isLid && rawId.startsWith('55') && rawId.length === 13) {
          phoneVariants.push(`+${rawId.slice(0, 4)}${rawId.slice(5)}`);
        }

        let conv = await this.prisma.conversation.findFirst({
          where: {
            tenantId: tenant.id,
            channel: 'WHATSAPP',
            contact: {
              phone: { in: phoneVariants }
            }
          }
        });

        if (!conv) {
          this.logger.log(`[Webhook] Conversa não encontrada para ${phone}. Criando nova conversa.`);
          
          let contact = await this.prisma.contact.findFirst({
            where: {
              tenantId: tenant.id,
              phone: { in: phoneVariants },
            },
          });

          if (!contact) {
            contact = await this.prisma.contact.create({
              data: {
                tenantId: tenant.id,
                name: pushName,
                phone,
                leadScore: 0,
                status: 'COLD',
              },
            });
          }

          conv = await this.prisma.conversation.create({
            data: {
              tenantId: tenant.id,
              channel: 'WHATSAPP',
              status: 'OPEN',
              contactId: contact.id,
              externalId: remoteJid,
            },
          });
        } else {
          // Atualiza a data de updatedAt para que suba na lista de conversas
          await this.prisma.conversation.update({
            where: { id: conv.id },
            data: {
              updatedAt: new Date(),
            },
          });
        }

        conversationId = conv.id;

        await this.prisma.message.create({
          data: {
            conversationId,
            direction: isFromMe ? 'OUTBOUND' : 'INBOUND',
            type: msgType,
            content,
            mediaUrl,
            externalId: msgExternalId,
            quotedContent,
            quotedExternalId,
            quotedType,
          },
        });

        this.logger.log(`Mensagem salva na conversa ${conversationId}`);
      }
    } catch (err: any) {
      this.logger.error('Erro no webhook:', err.message);
    }
  }
}
