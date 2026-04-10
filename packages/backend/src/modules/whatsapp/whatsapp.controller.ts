import { Controller, Post, Get, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
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

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() payload: any) {
    this.whatsapp.processWebhook(payload).catch(console.error);
    return { received: true };
  }
}
