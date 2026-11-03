import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { AsaasSyncService } from './asaas-sync.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('financial')
@UseGuards(JwtAuthGuard)
export class FinancialController {
  constructor(
    private readonly financialService: FinancialService,
    private readonly asaasSync: AsaasSyncService,
  ) {}

  @Get('summary')
  getSummary(@Request() req: any) {
    return this.financialService.getSummary(req.user.tenantId);
  }

  @Get('dashboard')
  getDashboard(@Request() req: any) {
    return this.financialService.getDashboardMetrics(req.user.tenantId);
  }

  @Get('clientes')
  getClientes(@Request() req: any, @Query('month') month?: string) {
    return this.financialService.getClientes(req.user.tenantId, month);
  }

  @Post('entries')
  createEntry(@Request() req: any, @Body() body: { contractId: string; value: number; dueDate: string; description?: string }) {
    return this.financialService.createEntry(req.user.tenantId, body);
  }

  @Patch('entries/:id/pay')
  togglePay(@Request() req: any, @Param('id') id: string, @Body() body: { paid: boolean }) {
    return this.financialService.togglePay(req.user.tenantId, id, body.paid);
  }

  /** Puxa as cobranças do Asaas para o banco (padrão: 2 meses atrás → mês que vem). */
  @Post('asaas/sync')
  syncAsaas(@Query('monthsBack') monthsBack?: string) {
    const n = Math.min(Math.max(parseInt(monthsBack ?? '2', 10) || 2, 0), 12);
    return this.asaasSync.syncDefaultRange(n);
  }

  @Get('asaas/vinculos')
  getLinks(@Request() req: any) {
    return this.asaasSync.getLinks(req.user.tenantId);
  }

  @Patch('asaas/vinculos/:contractId')
  setLink(@Request() req: any, @Param('contractId') contractId: string, @Body() body: { asaasCustomerId: string | null }) {
    return this.asaasSync.setLink(req.user.tenantId, contractId, body.asaasCustomerId || null);
  }
}
