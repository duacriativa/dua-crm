import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { PublicDiagnosisController } from './diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [PrismaModule, AsaasModule],
  controllers: [ContactsController, PublicDiagnosisController],
  providers: [ContactsService, DiagnosisService],
  exports: [ContactsService],
})
export class ContactsModule {}
