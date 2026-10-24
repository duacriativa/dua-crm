import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlanOrdersService } from './plan-orders.service';
import { renderPlanPdf } from './plan-pdf';

async function sendPdf(res: Response, order: Parameters<typeof renderPlanPdf>[0], inline = false) {
  const file = await renderPlanPdf(order);
  const name = `plano-90-dias-${order.instagramHandle.toLowerCase().replace(/[^a-z0-9._-]/g, '')}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
    'Content-Length': String(file.length),
    'Cache-Control': 'private, no-store',
  });
  res.end(file);
}

/** Página de venda /plano-90-dias e acompanhamento do pedido (sem login). */
@Controller('public/plano')
export class PublicPlanController {
  constructor(private readonly orders: PlanOrdersService) {}

  @Get()
  info(@Query('d') diagnosisToken?: string) {
    return this.orders.publicInfo(diagnosisToken);
  }

  @Post('pedido')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() body: any) {
    return this.orders.create(body);
  }

  @Get('pedido/:token')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  order(@Param('token') token: string) {
    return this.orders.publicOrder(token);
  }

  @Get('pedido/:token/pdf')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async pdf(@Param('token') token: string, @Res() res: Response) {
    await sendPdf(res, await this.orders.publicPdfOrder(token));
  }
}

/** Tela "Planos 90 dias" do CRM: pedidos, revisão e entrega. */
@Controller('plan-orders')
@UseGuards(JwtAuthGuard)
export class PlanOrdersController {
  constructor(private readonly orders: PlanOrdersService) {}

  @Get()
  list(@Request() req: any, @Query('status') status?: string) {
    return this.orders.list(req.user.tenantId, status || undefined);
  }

  @Get(':id')
  get(@Request() req: any, @Param('id') id: string) {
    return this.orders.get(req.user.tenantId, id);
  }

  @Post(':id/generate')
  generate(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.orders.generateFromTeam(req.user.tenantId, id, body?.part || undefined);
  }

  @Patch(':id/plan')
  updatePlan(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.orders.updatePlan(req.user.tenantId, id, body?.plan);
  }

  @Post(':id/approve')
  approve(@Request() req: any, @Param('id') id: string) {
    return this.orders.approve(req.user.tenantId, id, req.user.name ?? req.user.email ?? 'Equipe');
  }

  @Patch(':id/status')
  status(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.orders.setStatus(req.user.tenantId, id, String(body?.status ?? '') as any);
  }

  @Post(':id/simulate-payment')
  simulate(@Request() req: any, @Param('id') id: string) {
    return this.orders.simulatePayment(req.user.tenantId, id);
  }

  /** PDF para a equipe conferir (inclusive antes da aprovação). */
  @Get(':id/pdf')
  async pdf(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    await sendPdf(res, await this.orders.teamPdfOrder(req.user.tenantId, id), true);
  }
}
