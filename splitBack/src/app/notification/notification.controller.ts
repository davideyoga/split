import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { MarkReadDto } from './dto/mark-read.dto';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push-subscription.dto';
import { NotificationService } from './notification.service';
import { PushDeviceService } from './push/push-device.service';
import { PushSender } from './push/push-sender';

// Il SessionAuthGuard mette l'utente del token in `request.user`.
type AuthRequest = Request & { user: AuthUser };

const validation = new ValidationPipe({ whitelist: true });

// Le notifiche si leggono e si segnano come lette, non si creano da qui: le
// creano i servizi delle azioni (spese, gruppi, rimborsi). Da qui ogni utente
// accende e spegne le push sui suoi dispositivi (doc/NotifichePush.md).
@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushDevices: PushDeviceService,
    private readonly pushSender: PushSender,
  ) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  findMine(@Req() request: AuthRequest) {
    return this.notificationService.findMine(request.user.publicId);
  }

  // Il numero sulla campanella.
  @Get('unread-count')
  @UseGuards(SessionAuthGuard)
  unreadCount(@Req() request: AuthRequest) {
    return this.notificationService.unreadCount(request.user.publicId);
  }

  @Post('read')
  @HttpCode(200)
  @UseGuards(SessionAuthGuard)
  markRead(@Req() request: AuthRequest, @Body(validation) dto: MarkReadDto) {
    return this.notificationService.markRead(request.user.publicId, dto.publicIds);
  }

  // La chiave pubblica VAPID con cui il browser si iscrive; null = push spente
  // sul server (PUSH_TRANSPORT=off), e il Profilo non mostra l'interruttore.
  @Get('push/config')
  @UseGuards(SessionAuthGuard)
  pushConfig() {
    return { vapidPublicKey: this.pushSender.vapidPublicKey };
  }

  @Post('push/subscribe')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  subscribe(@Req() request: AuthRequest, @Body(validation) dto: PushSubscribeDto) {
    return this.pushDevices.subscribe(request.user.publicId, dto);
  }

  // L'endpoint viaggia nel body e non nell'URL: e' l'indirizzo delle push di
  // quel browser, e non deve finire nei log di accesso.
  @Post('push/unsubscribe')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  unsubscribe(@Req() request: AuthRequest, @Body(validation) dto: PushUnsubscribeDto) {
    return this.pushDevices.unsubscribe(request.user.publicId, dto.endpoint);
  }
}
