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
import { NotificationService } from './notification.service';

// Il SessionAuthGuard mette l'utente del token in `request.user`.
type AuthRequest = Request & { user: AuthUser };

// Le notifiche si leggono e si segnano come lette, non si creano da qui: le
// creano i servizi delle azioni (spese, gruppi, rimborsi).
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

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
  markRead(
    @Req() request: AuthRequest,
    @Body(new ValidationPipe({ whitelist: true })) dto: MarkReadDto,
  ) {
    return this.notificationService.markRead(request.user.publicId, dto.publicIds);
  }
}
