// File: src/user/user.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountDeletionService } from './account-deletion.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, AccountDeletionService, PrismaService], // Aggiungi PrismaService qui
})
export class UserModule {}
