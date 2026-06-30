import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('financial')
@UseGuards(JwtAuthGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

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
}
