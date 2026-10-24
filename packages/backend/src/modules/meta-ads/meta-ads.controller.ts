import { Body, Controller, Delete, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MetaAdsService } from './meta-ads.service';

/** Botão "Conectar Meta Ads" em Configurações → Integrações. */
@Controller('meta-ads')
@UseGuards(JwtAuthGuard)
export class MetaAdsController {
  constructor(private readonly meta: MetaAdsService) {}

  @Get('status')
  status(@Request() req: any) {
    return this.meta.status(req.user.tenantId);
  }

  @Get('auth-url')
  authUrl(@Request() req: any, @Query('redirectUri') redirectUri: string) {
    return { url: this.meta.authUrl(req.user.tenantId, String(redirectUri ?? '')) };
  }

  @Post('connect')
  connect(@Request() req: any, @Body() body: any) {
    return this.meta.connect(req.user.tenantId, String(body?.code ?? ''), String(body?.state ?? ''), String(body?.redirectUri ?? ''));
  }

  @Get('accounts')
  accounts(@Request() req: any) {
    return this.meta.accounts(req.user.tenantId);
  }

  @Post('account')
  selectAccount(@Request() req: any, @Body() body: any) {
    return this.meta.selectAccount(req.user.tenantId, String(body?.accountId ?? ''));
  }

  @Delete()
  async disconnect(@Request() req: any) {
    await this.meta.disconnect(req.user.tenantId);
    return { connected: false };
  }
}
