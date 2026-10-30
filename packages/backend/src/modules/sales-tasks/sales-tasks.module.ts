import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SalesTasksController } from './sales-tasks.controller';
import { SalesTasksService } from './sales-tasks.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [SalesTasksController],
  providers: [SalesTasksService],
})
export class SalesTasksModule {}
