import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { FinancialService } from './financial.service';
import { AsaasSyncService } from './asaas-sync.service';
import { AsaasModule } from '../asaas/asaas.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { MetaAdsModule } from '../meta-ads/meta-ads.module';

@Module({
  imports: [AsaasModule, PrismaModule, MetaAdsModule],
  controllers: [FinancialController],
  providers: [FinancialService, AsaasSyncService],
  exports: [FinancialService, AsaasSyncService],
})
export class FinancialModule {}
