import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { OptionalSessionAuthGuard } from '../auth/optional-session-auth.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InviteTokenDto } from './dto/invite-token.dto';
import { InviteService } from './invite.service';

type AuthRequest = Request & { user: AuthUser };

const validation = new ValidationPipe({ whitelist: true });

// Link d'invito: le rotte del link di un gruppo stanno sotto /group come le
// altre del gruppo; anteprima e ingresso sotto /invite, perche' il gruppo si
// ricava dal token (nel body, mai nell'URL).
@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Get('group/:publicId/invite')
  @UseGuards(SessionAuthGuard)
  active(@Req() request: AuthRequest, @Param('publicId') publicId: string) {
    return this.inviteService.active(request.user.publicId, publicId);
  }

  @Post('group/:publicId/invite')
  @UseGuards(SessionAuthGuard)
  create(
    @Req() request: AuthRequest,
    @Param('publicId') publicId: string,
    @Body(validation) dto: CreateInviteDto,
  ) {
    return this.inviteService.create(request.user.publicId, publicId, dto.expiresInDays);
  }

  @Delete('group/:publicId/invite')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async revoke(@Req() request: AuthRequest, @Param('publicId') publicId: string) {
    await this.inviteService.revoke(request.user.publicId, publicId);
  }

  // Pubblica: chi apre il link puo' non avere ancora fatto login.
  @Post('invite/preview')
  @HttpCode(200)
  @UseGuards(OptionalSessionAuthGuard)
  preview(@Req() request: Request & { user?: AuthUser }, @Body(validation) dto: InviteTokenDto) {
    return this.inviteService.preview(dto.token, request.user?.publicId);
  }

  @Post('invite/join')
  @HttpCode(200)
  @UseGuards(SessionAuthGuard)
  join(@Req() request: AuthRequest, @Body(validation) dto: InviteTokenDto) {
    return this.inviteService.join(request.user.publicId, dto.token);
  }
}
