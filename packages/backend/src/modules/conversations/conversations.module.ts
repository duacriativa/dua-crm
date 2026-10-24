import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { WhatsAppCloudModule } from '../whatsapp-cloud/whatsapp-cloud.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InstagramModule } from '../instagram/instagram.module';

@Module({
  imports: [PrismaModule, WhatsAppCloudModule, InstagramModule, NotificationsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
