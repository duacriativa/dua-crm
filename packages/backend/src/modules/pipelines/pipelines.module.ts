import { Module } from '@nestjs/common';
import { PipelinesController } from './pipelines.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PipelinesController],
})
export class PipelinesModule {}
