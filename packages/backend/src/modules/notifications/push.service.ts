import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Notificações push para o PWA do CRM (celular/desktop).
 * Chaves VAPID: usa VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY do env; se não houver,
 * gera uma vez e guarda no banco (privada criptografada).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private keys: { publicKey: string; privateKey: string } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  private async getKeys() {
    if (this.keys) return this.keys;

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      this.keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    } else {
      const stored = await this.prisma.appSetting.findUnique({ where: { key: 'vapid' } });
      if (stored) {
        const parsed = JSON.parse(stored.value);
        this.keys = { publicKey: parsed.publicKey, privateKey: this.encryption.decrypt(parsed.privateKey) };
      } else {
        const generated = webpush.generateVAPIDKeys();
        await this.prisma.appSetting.create({
          data: {
            key: 'vapid',
            value: JSON.stringify({ publicKey: generated.publicKey, privateKey: this.encryption.encrypt(generated.privateKey) }),
          },
        });
        this.logger.log('[Push] Chaves VAPID geradas e salvas');
        this.keys = generated;
      }
    }

    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://crm.duacriativa.com.br', this.keys.publicKey, this.keys.privateKey);
    return this.keys;
  }

  async publicKey() {
    return (await this.getKeys()).publicKey;
  }

  async subscribe(tenantId: string, userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
    const data = { tenantId, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent ?? null };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { endpoint: sub.endpoint, ...data },
      update: data,
    });
    return { ok: true };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  /** Envia para todos os aparelhos do tenant. Nunca lança erro. */
  async sendToTenant(tenantId: string, payload: PushPayload) {
    try {
      const subs = await this.prisma.pushSubscription.findMany({ where: { tenantId } });
      if (subs.length === 0) return;
      await this.getKeys();
      const body = JSON.stringify(payload);
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 });
          } catch (err: any) {
            // 404/410 = aparelho desinstalou ou revogou permissão
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await this.prisma.pushSubscription.deleteMany({ where: { id: s.id } });
            } else {
              this.logger.warn(`[Push] Falha ao enviar para ${s.id}: ${err?.statusCode ?? ''} ${err?.message}`);
            }
          }
        }),
      );
    } catch (err: any) {
      this.logger.warn(`[Push] Erro geral: ${err.message}`);
    }
  }
}
