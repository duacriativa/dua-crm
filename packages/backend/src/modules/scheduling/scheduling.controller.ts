import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SchedulingService } from './scheduling.service';
import { GoogleCalendarService } from './google-calendar.service';

/** Página pública /agendar/[slug] e link do cliente /reuniao/[token] (sem login). */
@Controller('public/booking')
export class PublicBookingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('manage/:token')
  manage(@Param('token') token: string) {
    return this.scheduling.manageView(token);
  }

  @Get('manage/:token/slots')
  manageSlots(@Param('token') token: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.scheduling.manageSlots(token, from, to);
  }

  @Post('manage/:token/cancel')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@Param('token') token: string, @Body() body: any) {
    return this.scheduling.cancelByToken(token, body?.reason);
  }

  @Post('manage/:token/reschedule')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reschedule(@Param('token') token: string, @Body() body: any) {
    return this.scheduling.rescheduleByToken(token, String(body?.startAt ?? ''));
  }

  @Get(':slug')
  async page(@Param('slug') slug: string) {
    return this.scheduling.publicView(await this.scheduling.publicPage(slug));
  }

  @Get(':slug/slots')
  async slots(@Param('slug') slug: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.scheduling.slots(await this.scheduling.publicPage(slug), from, to);
  }

  @Post(':slug/book')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  book(@Param('slug') slug: string, @Body() body: any) {
    return this.scheduling.book(slug, {
      startAt: String(body?.startAt ?? ''), name: body?.name, phone: body?.phone, email: body?.email, notes: body?.notes,
    });
  }
}

/** Configurações do agendamento e tela "Reuniões" (Agenda). */
@Controller('scheduling')
@UseGuards(JwtAuthGuard)
export class SchedulingController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('pages')
  pages(@Request() req: any) {
    return this.scheduling.listPages(req.user.tenantId);
  }

  @Patch('pages/:id')
  updatePage(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.scheduling.updatePage(req.user.tenantId, id, body ?? {});
  }

  @Get('meetings')
  meetings(@Request() req: any, @Query() q: any) {
    return this.scheduling.list(req.user.tenantId, q ?? {});
  }

  @Patch('meetings/:id/status')
  status(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.scheduling.setStatus(req.user.tenantId, id, String(body?.status ?? ''));
  }

  @Post('meetings/:id/cancel')
  cancel(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.scheduling.cancelByTeam(req.user.tenantId, id, body?.reason);
  }

  @Get('meetings/:id/slots')
  slots(@Request() req: any, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.scheduling.slotsForMeeting(req.user.tenantId, id, from, to);
  }

  @Post('meetings/:id/reschedule')
  reschedule(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.scheduling.rescheduleByTeam(req.user.tenantId, id, String(body?.startAt ?? ''));
  }
}

/** Botão "Conectar Google" em Configurações → Integrações. */
@Controller('google')
@UseGuards(JwtAuthGuard)
export class GoogleController {
  constructor(private readonly google: GoogleCalendarService) {}

  @Get('status')
  status(@Request() req: any) {
    return this.google.status(req.user.tenantId);
  }

  @Get('auth-url')
  authUrl(@Request() req: any, @Query('redirectUri') redirectUri: string) {
    return { url: this.google.authUrl(req.user.tenantId, String(redirectUri ?? '')) };
  }

  @Post('connect')
  connect(@Request() req: any, @Body() body: any) {
    return this.google.connect(req.user.tenantId, String(body?.code ?? ''), String(body?.state ?? ''), String(body?.redirectUri ?? ''));
  }

  @Delete()
  async disconnect(@Request() req: any) {
    await this.google.disconnect(req.user.tenantId);
    return { connected: false };
  }
}
