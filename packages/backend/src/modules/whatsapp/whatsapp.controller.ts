import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, Logger } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly prisma: PrismaService,
  ) {}

  private async getInstanceName(tenantId: string, bodyName?: string): Promise<string> {
    if (bodyName) return bodyName;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    return tenant?.slug ?? tenantId;
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connect(@Body() body: any, @Req() req: any) {
    const instanceName = await this.getInstanceName(req.user.tenantId, body.instanceName);
    return this.whatsapp.connect(instanceName);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@Req() req: any) {
    const instanceName = await this.getInstanceName(req.user.tenantId);
    return this.whatsapp.getStatus(instanceName);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Req() req: any) {
    const instanceName = await this.getInstanceName(req.user.tenantId);
    return this.whatsapp.disconnect(instanceName);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async sync(@Req() req: any) {
    const instanceName = await this.getInstanceName(req.user.tenantId);
    this.whatsapp.syncContacts(instanceName, req.user.tenantId).catch(console.error);
    return { success: true, message: 'Sincronização iniciada' };
  }

  /** POST /whatsapp/cleanup-media — limpa blobs base64 grandes do banco para liberar espaço */
  @Post('cleanup-media')
  @UseGuards(JwtAuthGuard)
  async cleanupMedia() {
    const logger = new Logger('CleanupMedia');
    const result = await this.prisma.$executeRaw`
      UPDATE "Message" SET "mediaUrl" = NULL
      WHERE length("mediaUrl") > 51200
    `;
    logger.log(`Cleanup: ${result} registros limpos`);
    const remaining = await this.prisma.message.count({ where: { mediaUrl: { not: null } } });
    return { ok: true, cleaned: result, remainingWithMedia: remaining };
  }

  /** POST /whatsapp/emergency-cleanup — limpeza de emergência sem auth (token fixo) */
  @Post('emergency-cleanup')
  @HttpCode(200)
  async emergencyCleanup(@Body() body: any) {
    if (body?.secret !== 'dua2026clean') {
      return { ok: false, error: 'unauthorized' };
    }
    const logger = new Logger('EmergencyCleanup');
    const result = await this.prisma.$executeRaw`
      UPDATE "Message" SET "mediaUrl" = NULL
      WHERE length("mediaUrl") > 51200
    `;
    logger.log(`[EMERGENCY] Cleanup: ${result} registros limpos`);
    return { ok: true, cleaned: result };
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() payload: any) {
    console.log(`[WEBHOOK RAW] event=${payload?.event} instance=${payload?.instance} keys=${Object.keys(payload || {}).join(',')}`);
    this.whatsapp.processWebhook(payload).catch(err => console.error('[WEBHOOK ERROR]', err.message));
    return { received: true };
  }
}
