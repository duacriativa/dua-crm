import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SalesTasksService, TaskFilter } from './sales-tasks.service';

@Controller('sales-tasks')
@UseGuards(JwtAuthGuard)
export class SalesTasksController {
  constructor(private readonly tasks: SalesTasksService) {}

  /** Lista: filter=today|overdue|all (abertas) ou status=CLOSED (fechadas nos últimos 14 dias) */
  @Get()
  list(@Request() req: any, @Query('filter') filter?: string, @Query('status') status?: string) {
    const f: TaskFilter = filter === 'today' || filter === 'overdue' ? filter : 'all';
    return this.tasks.list(req.user.tenantId, f, status === 'CLOSED' ? 'CLOSED' : 'OPEN');
  }

  /** Contador do menu */
  @Get('count')
  count(@Request() req: any) {
    return this.tasks.counts(req.user.tenantId);
  }

  /** Resumo da semana (leitura de segunda) */
  @Get('summary')
  summary(@Request() req: any) {
    return this.tasks.weeklySummary(req.user.tenantId).then((s) => s ?? {});
  }

  /** Roda as regras agora (botão "Atualizar") */
  @Post('run')
  run(@Request() req: any) {
    return this.tasks.runRules(req.user.tenantId);
  }

  @Post(':id/done')
  done(@Request() req: any, @Param('id') id: string) {
    return this.tasks.close(req.user.tenantId, req.user.id, id, 'DONE');
  }

  @Post(':id/dismiss')
  dismiss(@Request() req: any, @Param('id') id: string) {
    return this.tasks.close(req.user.tenantId, req.user.id, id, 'DISMISSED');
  }

  @Post(':id/reopen')
  reopen(@Request() req: any, @Param('id') id: string) {
    return this.tasks.reopen(req.user.tenantId, id);
  }
}
