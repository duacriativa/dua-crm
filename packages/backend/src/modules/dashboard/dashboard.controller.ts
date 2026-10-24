import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /dashboard/overview?from=AAAA-MM-DD&to=AAAA-MM-DD (dias inteiros no horário de Brasília). */
  @Get('overview')
  overview(@Request() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.dashboard.overview(req.user.tenantId, from, to);
  }
}
