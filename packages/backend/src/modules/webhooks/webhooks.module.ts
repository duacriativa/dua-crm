import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PipelinesModule } from '../pipelines/pipelines.module';

@Module({
  imports: [PrismaModule, PipelinesModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
