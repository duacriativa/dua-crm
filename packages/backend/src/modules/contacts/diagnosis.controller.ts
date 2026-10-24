import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DiagnosisService } from './diagnosis.service';

/** Página pública /diagnostico/[token] (sem login). */
@Controller('public/diagnostico')
export class PublicDiagnosisController {
  constructor(private readonly diagnosis: DiagnosisService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Param('token') token: string, @Query('preview') preview?: string) {
    return this.diagnosis.publicView(token, preview === '1');
  }
}
