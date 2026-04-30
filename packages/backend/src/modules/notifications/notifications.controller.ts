import { Controller, Get, Sse, UseGuards, Request, MessageEvent } from '@nestjs/common';
import { Observable, fromEvent, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly events: EventEmitter2) {}

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
