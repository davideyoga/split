import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { BlockUserDto } from './dto/block-user.dto';
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

  // Ricerca esatta per nickname o email: GET /api/user?q=Pippo. Era
  // GET /api/user/:nickname, ma un testo libero nel path si rompe con `/`,
  // `?`, `#`, e `..` viene normalizzato dal browser (chiamava /api invece
  // della ricerca).
  @Get()
  @UseGuards(SessionAuthGuard)
  findUsers(@Req() request: AuthRequest, @Query('q') q?: unknown) {
    // `?q=a&q=b` arriva come array: lo si tratta come una ricerca vuota.
    return this.userService.getUser(typeof q === 'string' ? q : '', request.user.publicId);
  }

  @Get('contacts')
  @UseGuards(SessionAuthGuard)
  contacts(@Req() request: AuthRequest) {
    return this.userService.contacts(request.user.publicId);
  }

  // "Blocca" (2026-11-07): effetti in blocks.ts.
  @Get('blocks')
  @UseGuards(SessionAuthGuard)
  blocks(@Req() request: AuthRequest) {
    return this.userService.blocks(request.user.publicId);
  }

  @Post('blocks')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async block(@Req() request: AuthRequest, @Body(new ValidationPipe({ whitelist: true })) dto: BlockUserDto) {
    await this.userService.block(request.user.publicId, dto.publicId);
  }

  @Delete('blocks/:publicId')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async unblock(@Req() request: AuthRequest, @Param('publicId') publicId: string) {
    await this.userService.unblock(request.user.publicId, publicId);
  }

  // Unico modo di cambiare il nickname: /update-user di Better Auth e'
  // disabilitato perche' salterebbe le regole di nickname.ts.
  @Patch('me')
  @UseGuards(SessionAuthGuard)
  updateMe(@Req() request: AuthRequest, @Body(new ValidationPipe()) dto: UpdateMeDto) {
    return this.userService.updateMe(request.user.publicId, dto.nickName);
  }
}
