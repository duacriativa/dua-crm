import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AsaasModule } from '../asaas/asaas.module';

@Module({
  imports: [PrismaModule, AsaasModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
