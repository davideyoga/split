import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendModule } from '../friend/friend.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

@Module({
  imports: [AuthModule, FriendModule, NotificationModule],
  controllers: [GroupController],
  providers: [GroupService, PrismaService],
})
export class GroupModule {}
