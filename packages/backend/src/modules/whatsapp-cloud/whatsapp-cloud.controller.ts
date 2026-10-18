import { Controller, Get, Post, Body, Query, Req, Res, UseGuards, HttpCode, Headers, ForbiddenException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WhatsAppCloudService } from './whatsapp-cloud.service';

@Controller('whatsapp-cloud')
export class WhatsAppCloudController {
  constructor(private readonly cloud: WhatsAppCloudService) {}

  /** GET /whatsapp-cloud/config — appId/configId para o Embedded Signup */
  @Get('config')
  @UseGuards(JwtAuthGuard)
  config() {
    return this.cloud.publicConfig();
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@Req() req: any) {
    return this.cloud.getStatus(req.user.tenantId);
  }

  /** POST /whatsapp-cloud/embedded-signup — finaliza o onboarding (coexistência) */
  @Post('embedded-signup')
  @UseGuards(JwtAuthGuard)
  embeddedSignup(@Req() req: any, @Body() body: { code: string; wabaId: string; phoneNumberId: string; coexistence?: boolean }) {
    return this.cloud.completeEmbeddedSignup(req.user.tenantId, body.code, body.wabaId, body.phoneNumberId, body.coexistence !== false);
  }

  /** POST /whatsapp-cloud/manual — conecta com token de System User */
  @Post('manual')
  @UseGuards(JwtAuthGuard)
  manual(@Req() req: any, @Body() body: { phoneNumberId: string; wabaId: string; accessToken: string }) {
    return this.cloud.connectManual(req.user.tenantId, body.phoneNumberId, body.wabaId, body.accessToken);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  disconnect(@Req() req: any) {
    return this.cloud.disconnect(req.user.tenantId);
  }

  /** GET /whatsapp-cloud/webhook — verificação do webhook pela Meta */
  @Get('webhook')
  @SkipThrottle()
  verify(@Query() q: any, @Res() res: any) {
    const expected = process.env.WA_WEBHOOK_VERIFY_TOKEN;
    if (q['hub.mode'] === 'subscribe' && expected && q['hub.verify_token'] === expected) {
      return res.status(200).send(q['hub.challenge']);
    }
    return res.status(403).send('forbidden');
  }

  /** POST /whatsapp-cloud/webhook — eventos da Meta (mensagens, status, coexistência) */
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(200)
  webhook(@Req() req: any, @Body() payload: any, @Headers('x-hub-signature-256') signature: string) {
    if (!this.cloud.verifySignature(req.rawBody, signature)) {
      throw new ForbiddenException('assinatura inválida');
    }
    this.cloud.processWebhook(payload).catch((err) => console.error('[CLOUD WEBHOOK ERROR]', err.message));
    return { received: true };
  }
}
