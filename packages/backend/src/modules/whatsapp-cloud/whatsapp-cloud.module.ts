import { Module } from '@nestjs/common';
import { WhatsAppCloudController } from './whatsapp-cloud.controller';
import { WhatsAppCloudService } from './whatsapp-cloud.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [PrismaModule, PipelinesModule, NotificationsModule],
  controllers: [WhatsAppCloudController],
  providers: [WhatsAppCloudService, EncryptionService],
  exports: [WhatsAppCloudService],
})
export class WhatsAppCloudModule {}
