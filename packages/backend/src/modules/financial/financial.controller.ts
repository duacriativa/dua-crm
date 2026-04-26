import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
}
