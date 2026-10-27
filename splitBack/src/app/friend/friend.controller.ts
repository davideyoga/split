import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { FriendService } from './friend.service';

// Il SessionAuthGuard mette l'utente del token in `request.user`.
type AuthRequest = Request & { user: AuthUser };

// Le amicizie non si chiedono da qui: nascono aggiungendo qualcuno a una
// spesa o a un gruppo (richiesta implicita) e si accettano da qui o
// accettando un gruppo.
@Controller('friend')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  list(@Req() request: AuthRequest) {
    return this.friendService.list(request.user.publicId);
  }

  @Get('requests')
  @UseGuards(SessionAuthGuard)
  requests(@Req() request: AuthRequest) {
    return this.friendService.requests(request.user.publicId);
  }

  // Accetta la persona: amici, e tutte le sue spese in attesa contano.
  @Post(':publicId/accept')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  accept(@Req() request: AuthRequest, @Param('publicId') publicId: string) {
    return this.friendService.accept(request.user.publicId, publicId);
  }
}
