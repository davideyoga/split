import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [FriendController],
  providers: [FriendService, PrismaService],
  exports: [FriendService],
})
export class FriendModule {}
