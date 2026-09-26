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
import type { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementService } from './settlement.service';

// Il JwtAuthGuard mette l'utente del token in `request.user`.
type AuthRequest = Request & { user: AuthUser };

@Controller('settlement')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findMine(@Req() request: AuthRequest) {
    return this.settlementService.findMine(request.user.publicId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Req() request: AuthRequest,
    @Body(new ValidationPipe()) dto: CreateSettlementDto,
  ) {
    return this.settlementService.create(request.user.publicId, dto);
  }

  @Delete(':publicId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  remove(@Req() request: AuthRequest, @Param('publicId') publicId: string) {
    return this.settlementService.remove(request.user.publicId, publicId);
  }
}
