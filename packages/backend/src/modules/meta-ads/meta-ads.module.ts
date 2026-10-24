import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionService } from '../../common/services/encryption.service';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsService } from './meta-ads.service';

@Module({
  imports: [PrismaModule],
  controllers: [MetaAdsController],
  providers: [MetaAdsService, EncryptionService],
  exports: [MetaAdsService],
})
export class MetaAdsModule {}
