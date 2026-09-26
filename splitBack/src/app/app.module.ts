import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ExpenseModule } from './expense/expense.module';
import { GroupModule } from './group/group.module';
import { CategoryModule } from './category/category.module';
import { SettlementModule } from './settlement/settlement.module';


@Module({
  imports: [
    UserModule,
    PrismaModule,
    AuthModule,
    ExpenseModule,
    GroupModule,
    CategoryModule,
    SettlementModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaModule],
  exports: [PrismaModule],
})

export class AppModule {}
