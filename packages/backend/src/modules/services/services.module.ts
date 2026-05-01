import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ServicesController],
  providers: [PrismaService],
})
export class ServicesModule {}
