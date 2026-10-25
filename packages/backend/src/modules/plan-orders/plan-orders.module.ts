import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InstagramProfileService } from '../contacts/instagram-profile.service';
import { PlanOrdersService } from './plan-orders.service';
import { PlanOrdersController, PublicPlanController } from './plan-orders.controller';

@Module({
  imports: [PrismaModule, AsaasModule, PipelinesModule, NotificationsModule],
  controllers: [PublicPlanController, PlanOrdersController],
  providers: [PlanOrdersService, InstagramProfileService],
  exports: [PlanOrdersService],
})
export class PlanOrdersModule {}
