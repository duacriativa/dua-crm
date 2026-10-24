import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { DiagnosisService } from './diagnosis.service';
import { renderDiagnosisPdf } from './diagnosis-pdf';

/** Página pública /diagnostico/[token] e o PDF dela (sem login). */
@Controller('public/diagnostico')
export class PublicDiagnosisController {
  constructor(private readonly diagnosis: DiagnosisService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async view(@Param('token') token: string, @Query('preview') preview?: string) {
    return this.diagnosis.publicView(await this.diagnosis.byToken(token, preview !== '1'));
  }

  @Get(':token/pdf')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async pdf(@Param('token') token: string, @Query('preview') preview: string | undefined, @Res() res: Response) {
    const d = await this.diagnosis.byToken(token, preview !== '1');
    const file = await renderDiagnosisPdf(d);
    const name = `analise-perfil-${d.instagramHandle.toLowerCase().replace(/[^a-z0-9._-]/g, '')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(file.length),
      'Cache-Control': 'private, no-store',
    });
    res.end(file);
  }
}
