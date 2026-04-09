import { Controller, Post, Get, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connect(@Body() body: any, @Req() req: any) {
    const instanceName = body.instanceName || req.user.tenantId;
    return this.whatsapp.connect(instanceName);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@Req() req: any) {
    return this.whatsapp.getStatus(req.user.tenantId);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@Req() req: any) {
    return this.whatsapp.disconnect(req.user.tenantId);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() payload: any) {
    this.whatsapp.processWebhook(payload).catch(console.error);
    return { received: true };
  }
}
