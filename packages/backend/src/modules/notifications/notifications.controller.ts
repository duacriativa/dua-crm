import { Controller, Get, Post, Put, Body, Query, Sse, UseGuards, Request, MessageEvent } from '@nestjs/common';
import { Observable, fromEvent, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotifyService } from './notify.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly events: EventEmitter2,
    private readonly notify: NotifyService,
  ) {}

  /** Sino: últimos avisos (não lidos + 30 dias) e contador de não lidos */
  @Get()
  list(@Request() req: any, @Query('limit') limit?: string) {
    return this.notify.list(req.user.tenantId, Number(limit) || 30);
  }

  /** Marca um aviso como lido ({ id }) ou todos (sem id) */
  @Post('read')
  read(@Request() req: any, @Body() body: { id?: string }) {
    return this.notify.markRead(req.user.tenantId, body?.id);
  }

  @Get('preferences')
  async preferences(@Request() req: any) {
    return { catalog: this.notify.catalog(), prefs: await this.notify.getPrefs(req.user.tenantId) };
  }

  @Put('preferences')
  savePreferences(@Request() req: any, @Body() body: any) {
    return this.notify.savePrefs(req.user.tenantId, body ?? {});
  }

  @Sse('stream')
  stream(@Request() req: any): Observable<MessageEvent> {
    return fromEvent(this.events, 'asaas.payment').pipe(
      map((data: any) => ({
        data: JSON.stringify(data),
        type: data.type,
      })),
    );
  }
}
