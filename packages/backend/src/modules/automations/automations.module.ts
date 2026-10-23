import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsAppCloudModule } from '../whatsapp-cloud/whatsapp-cloud.module';
import { AutomationsController } from './automations.controller';
import { AutomationRunner } from './automation-runner.service';

@Module({
  imports: [PrismaModule, WhatsAppCloudModule],
  controllers: [AutomationsController],
  providers: [AutomationRunner],
})
export class AutomationsModule {}
