import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards, HttpCode, Headers, ForbiddenException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InstagramService } from './instagram.service';

@Controller('instagram')
export class InstagramController {
  constructor(private readonly ig: InstagramService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@Req() req: any) {
    return this.ig.getStatus(req.user.tenantId);
  }

  /** POST /instagram/connect — usa o token do corpo ou INSTAGRAM_ACCESS_TOKEN (usuário de sistema) */
  @Post('connect')
  @UseGuards(JwtAuthGuard)
  connect(@Req() req: any, @Body() body: { accessToken?: string; pageId?: string }) {
    return this.ig.connect(req.user.tenantId, body?.accessToken, body?.pageId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  disconnect(@Req() req: any) {
    return this.ig.disconnect(req.user.tenantId);
  }

  /** GET /instagram/media — últimos posts e reels (para a regra de comentário) */
  @Get('media')
  @UseGuards(JwtAuthGuard)
  media(@Req() req: any) {
    return this.ig.listMedia(req.user.tenantId);
  }

  @Get('automations')
  @UseGuards(JwtAuthGuard)
  listAutomations(@Req() req: any) {
    return this.ig.listAutomations(req.user.tenantId);
  }

  /** GET /instagram/automations/comments — últimos comentários respondidos pelas regras */
  @Get('automations/comments')
  @UseGuards(JwtAuthGuard)
  listCommentReplies(@Req() req: any) {
    return this.ig.listCommentReplies(req.user.tenantId);
  }

  @Post('automations')
  @UseGuards(JwtAuthGuard)
  createAutomation(@Req() req: any, @Body() body: any) {
    return this.ig.createAutomation(req.user.tenantId, body);
  }

  @Patch('automations/:id')
  @UseGuards(JwtAuthGuard)
  updateAutomation(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.ig.updateAutomation(req.user.tenantId, id, body);
  }

  @Delete('automations/:id')
  @UseGuards(JwtAuthGuard)
  removeAutomation(@Req() req: any, @Param('id') id: string) {
    return this.ig.removeAutomation(req.user.tenantId, id);
  }

  /** GET /instagram/webhook — verificação do webhook pela Meta */
  @Get('webhook')
  @SkipThrottle()
  verify(@Query() q: any, @Res() res: any) {
    const expected = process.env.IG_WEBHOOK_VERIFY_TOKEN || process.env.WA_WEBHOOK_VERIFY_TOKEN;
    if (q['hub.mode'] === 'subscribe' && expected && q['hub.verify_token'] === expected) {
      return res.status(200).send(q['hub.challenge']);
    }
    return res.status(403).send('forbidden');
  }

  /** POST /instagram/webhook — DMs, comentários, respostas e menções a stories */
  @Post('webhook')
  @SkipThrottle()
  @HttpCode(200)
  webhook(@Req() req: any, @Body() payload: any, @Headers('x-hub-signature-256') signature: string) {
    if (!this.ig.verifySignature(req.rawBody, signature)) {
      throw new ForbiddenException('assinatura inválida');
    }
    this.ig.processWebhook(payload).catch((err) => console.error('[IG WEBHOOK ERROR]', err.message));
    return { received: true };
  }
}
