import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  async publicKey() {
    return { publicKey: await this.push.publicKey() };
  }

  @Post('subscribe')
  subscribe(@Req() req: any, @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.push.subscribe(req.user.tenantId, req.user.id, body, req.headers['user-agent']);
  }

  @Post('unsubscribe')
  unsubscribe(@Body() body: { endpoint: string }) {
    return this.push.unsubscribe(body.endpoint);
  }

  @Post('test')
  async test(@Req() req: any) {
    await this.push.sendToTenant(req.user.tenantId, {
      title: 'Dua CRM',
      body: 'Notificações ativadas neste aparelho ✅',
      url: '/dashboard/conversas',
    });
    return { ok: true };
  }
}
