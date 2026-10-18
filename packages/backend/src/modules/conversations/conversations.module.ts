import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsAppCloudModule } from '../whatsapp-cloud/whatsapp-cloud.module';

@Module({
  imports: [PrismaModule, WhatsAppModule, WhatsAppCloudModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
