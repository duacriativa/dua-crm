import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController, PushController],
  providers: [PushService, EncryptionService],
  exports: [PushService],
})
export class NotificationsModule {}
