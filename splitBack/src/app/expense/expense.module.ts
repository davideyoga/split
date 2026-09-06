import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';

@Module({
  imports: [AuthModule, CategoryModule],
  controllers: [ExpenseController],
  providers: [ExpenseService, PrismaService],
})
export class ExpenseModule {}
