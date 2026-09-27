import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateExpenseBatchDto } from './dto/create-expense-batch.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseService } from './expense.service';

@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findMine(@Req() request: Request) {
    const user = request['user'] as AuthUser;
    return this.expenseService.findMine(user.publicId);
  }

  @Get('group/:publicId')
  @UseGuards(JwtAuthGuard)
  findByGroup(@Req() request: Request, @Param('publicId') publicId: string) {
    const user = request['user'] as AuthUser;
    return this.expenseService.findByGroup(user.publicId, publicId);
  }

  @Get(':publicId')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() request: Request, @Param('publicId') publicId: string) {
    const user = request['user'] as AuthUser;
    return this.expenseService.findOne(user.publicId, publicId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() request: Request, @Body(new ValidationPipe()) dto: CreateExpenseDto) {
    const creator = request['user'] as AuthUser;
    return this.expenseService.create(creator.publicId, dto);
  }

  // Tutte o nessuna, in una transazione (vedi ExpenseService.createMany).
  @Post('batch')
  @UseGuards(JwtAuthGuard)
  createMany(
    @Req() request: Request,
    @Body(new ValidationPipe()) dto: CreateExpenseBatchDto,
  ) {
    const creator = request['user'] as AuthUser;
    return this.expenseService.createMany(creator.publicId, dto.expenses);
  }

  @Patch(':publicId')
  @UseGuards(JwtAuthGuard)
  update(
    @Req() request: Request,
    @Param('publicId') publicId: string,
    @Body(new ValidationPipe()) dto: UpdateExpenseDto,
  ) {
    const user = request['user'] as AuthUser;
    return this.expenseService.update(user.publicId, publicId, dto);
  }

  @Delete(':publicId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  remove(@Req() request: Request, @Param('publicId') publicId: string) {
    const user = request['user'] as AuthUser;
    return this.expenseService.remove(user.publicId, publicId);
  }
}
