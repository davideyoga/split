import { Body, Controller, Get, Patch, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { SearchRateLimitGuard } from './search-rate-limit.guard';
import { UserService } from './user.service';

// Il SessionAuthGuard mette l'utente del token in `request.user`.
type AuthRequest = Request & { user: AuthUser };

// Gli utenti non si creano da qui: li crea Better Auth al primo login quando
// la registrazione e' aperta (AUTH_SIGN_UP=open, vedi auth.factory.ts),
// altrimenti solo splitBack/prisma/seed.ts e add-users.mts. Il vecchio
// POST /api/user, aperto a chiunque, e' stato rimosso il 2026-09-27.
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Ricerca esatta per nickname o email: GET /api/user?q=Pippo. Era
  // GET /api/user/:nickname, ma un testo libero nel path si rompe con `/`,
  // `?`, `#`, e `..` viene normalizzato dal browser (chiamava /api invece
  // della ricerca).
  @Get()
  @UseGuards(SessionAuthGuard, SearchRateLimitGuard)
  findUsers(@Req() request: AuthRequest, @Query('q') q?: unknown) {
    // `?q=a&q=b` arriva come array: lo si tratta come una ricerca vuota.
    return this.userService.getUser(typeof q === 'string' ? q : '', request.user.publicId);
  }

  // Unico modo di cambiare il nickname: /update-user di Better Auth e'
  // disabilitato perche' salterebbe le regole di nickname.ts.
  @Patch('me')
  @UseGuards(SessionAuthGuard)
  updateMe(@Req() request: AuthRequest, @Body(new ValidationPipe()) dto: UpdateMeDto) {
    return this.userService.updateMe(request.user.publicId, dto.nickName);
  }
}
