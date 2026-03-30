// File: src/expense/expense.controller.ts
import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('user') // 1. Definisce l'URL base per questo controller (es. /api/expense)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  create(@Body(new ValidationPipe()) createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get('/:nickname')//TODO: fare in modo di cercare solo utenti gia' registrati
  findUsers(@Param('nickname') nickname: string) {
    return this.userService.getUser(nickname);
  }
}
