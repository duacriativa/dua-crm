import { Module } from '@nestjs/common';
import { KommoController } from './kommo.controller';

@Module({
  controllers: [KommoController],
})
export class KommoModule {}
