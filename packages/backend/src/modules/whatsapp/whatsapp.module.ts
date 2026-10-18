import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [PrismaModule, PipelinesModule, NotificationsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, EncryptionService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
