import { Module } from '@nestjs/common';
import { PipelinesController } from './pipelines.controller';
import { FunnelService } from './funnel.service';
import { MetaConversionsService } from './meta-conversions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [PipelinesController],
  providers: [FunnelService, MetaConversionsService, EncryptionService],
  exports: [FunnelService, MetaConversionsService],
})
export class PipelinesModule {}
