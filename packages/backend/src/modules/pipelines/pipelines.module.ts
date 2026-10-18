import { Module } from '@nestjs/common';
import { PipelinesController } from './pipelines.controller';
import { FunnelService } from './funnel.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PipelinesController],
  providers: [FunnelService],
  exports: [FunnelService],
})
export class PipelinesModule {}
