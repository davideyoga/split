import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupMembersDto } from './dto/group-members.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupService } from './group.service';

@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  @UseGuards(SessionAuthGuard)
  create(
    @Req() request: Request,
    @Body(new ValidationPipe()) dto: CreateGroupDto,
  ) {
    const user = request['user'] as AuthUser;
    return this.groupService.create(user.publicId, dto);
  }

  @Get()
  @UseGuards(SessionAuthGuard)
  findMine(@Req() request: Request) {
    const user = request['user'] as AuthUser;
    return this.groupService.findMine(user.publicId);
  }

  @Get('/:publicId')
  @UseGuards(SessionAuthGuard)
  findOne(@Req() request: Request, @Param('publicId') publicId: string) {
    const user = request['user'] as AuthUser;
    return this.groupService.findOne(user.publicId, publicId);
  }

  @Patch('/:publicId')
  @UseGuards(SessionAuthGuard)
  rename(
    @Req() request: Request,
    @Param('publicId') publicId: string,
    @Body(new ValidationPipe()) dto: UpdateGroupDto,
  ) {
    const user = request['user'] as AuthUser;
    return this.groupService.rename(user.publicId, publicId, dto);
  }

  @Post('/:publicId/members')
  @UseGuards(SessionAuthGuard)
  addMembers(
    @Req() request: Request,
    @Param('publicId') publicId: string,
    @Body(new ValidationPipe()) dto: GroupMembersDto,
  ) {
    const user = request['user'] as AuthUser;
    return this.groupService.addMembers(user.publicId, publicId, dto);
  }

  @Delete('/:publicId/members/:userPublicId')
  @UseGuards(SessionAuthGuard)
  removeMember(
    @Req() request: Request,
    @Param('publicId') publicId: string,
    @Param('userPublicId') userPublicId: string,
  ) {
    const user = request['user'] as AuthUser;
    return this.groupService.removeMember(user.publicId, publicId, userPublicId);
  }
}
