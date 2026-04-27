import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadQualificationService } from './lead-qualification.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadQualificationService],
  exports: [LeadQualificationService],
})
export class LeadsModule {}
