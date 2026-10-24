import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { AsaasModule } from '../asaas/asaas.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MetaAdsModule } from '../meta-ads/meta-ads.module';

@Module({
  imports: [AsaasModule, PrismaModule, MetaAdsModule],
  controllers: [FinancialController],
  providers: [FinancialService],
  exports: [FinancialService],
})
export class FinancialModule {}
