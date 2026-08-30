import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ExpenseModule } from './expense/expense.module';


@Module({
  imports: [UserModule, PrismaModule, AuthModule, ExpenseModule],
  controllers: [AppController],
  providers: [AppService, PrismaModule],
  exports: [PrismaModule],
})

export class AppModule {}
