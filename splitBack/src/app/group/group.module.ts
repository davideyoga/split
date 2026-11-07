import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [GroupController],
  providers: [GroupService, PrismaService],
  // InviteModule ne usa memberOf.
  exports: [GroupService],
})
export class GroupModule {}
