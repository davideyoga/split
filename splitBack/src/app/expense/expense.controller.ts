import { Body, Controller, Get, Post, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
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

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() request: Request, @Body(new ValidationPipe()) dto: CreateExpenseDto) {
    const creator = request['user'] as AuthUser;
    return this.expenseService.create(creator.publicId, dto);
  }
}
