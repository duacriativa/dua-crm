import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';

@Module({
  imports: [PrismaModule, PipelinesModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
