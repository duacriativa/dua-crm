import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { PlanOrdersModule } from '../plan-orders/plan-orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [PrismaModule, PipelinesModule, PlanOrdersModule, NotificationsModule, FinancialModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
