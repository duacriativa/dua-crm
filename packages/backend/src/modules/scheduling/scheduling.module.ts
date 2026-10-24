import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncryptionService } from '../../common/services/encryption.service';
import { GoogleCalendarService } from './google-calendar.service';
import { SchedulingService } from './scheduling.service';
import { GoogleController, PublicBookingController, SchedulingController } from './scheduling.controller';

@Module({
  imports: [PrismaModule, PipelinesModule, NotificationsModule],
  controllers: [PublicBookingController, SchedulingController, GoogleController],
  providers: [GoogleCalendarService, SchedulingService, EncryptionService],
  exports: [SchedulingService],
})
export class SchedulingModule {}
