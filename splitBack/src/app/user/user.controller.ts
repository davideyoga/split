import { Body, Controller, Get, Patch, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { UserService } from './user.service';

// Il SessionAuthGuard mette l'utente del token in `request.user`.
type AuthRequest = Request & { user: AuthUser };

// Gli utenti non si creano da qui: con il login via codice (Better Auth,
// signup disabilitato) li aggiungono solo splitBack/prisma/seed.ts e
// add-users.mts. Il vecchio POST /api/user, aperto a chiunque, e' stato rimosso
// il 2026-09-27.
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Ricerca per nickname: GET /api/user?q=pip. Era GET /api/user/:nickname, ma
  // un testo libero nel path si rompe con `/`, `?`, `#`, e `..` viene
  // normalizzato dal browser (chiamava /api invece della ricerca).
  @Get()
  @UseGuards(SessionAuthGuard)
  findUsers(@Query('q') q?: string) {
    return this.userService.getUser(q ?? '');
  }

  // Unico modo di cambiare il nickname: /update-user di Better Auth e'
  // disabilitato perche' salterebbe le regole di nickname.ts.
  @Patch('me')
  @UseGuards(SessionAuthGuard)
  updateMe(@Req() request: AuthRequest, @Body(new ValidationPipe()) dto: UpdateMeDto) {
    return this.userService.updateMe(request.user.publicId, dto.nickName);
  }
}
