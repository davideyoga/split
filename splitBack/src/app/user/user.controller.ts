import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { UserService } from './user.service';

// Gli utenti non si creano da qui: con il login via codice (Better Auth,
// signup disabilitato) li aggiunge solo splitBack/prisma/seed.ts. Il vecchio
// POST /api/user, aperto a chiunque, e' stato rimosso il 2026-09-27.
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('/:nickname')//TODO: fare in modo di cercare solo utenti gia' registrati
  @UseGuards(SessionAuthGuard)
  findUsers(@Param('nickname') nickname: string) {
    return this.userService.getUser(nickname);
  }
}
