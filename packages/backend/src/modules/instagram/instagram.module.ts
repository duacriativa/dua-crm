import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [PrismaModule, PipelinesModule, NotificationsModule],
  controllers: [InstagramController],
  providers: [InstagramService, EncryptionService],
  exports: [InstagramService],
})
export class InstagramModule {}
