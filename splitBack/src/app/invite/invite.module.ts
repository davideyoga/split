import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GroupModule } from '../group/group.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';

@Module({
  imports: [AuthModule, GroupModule, NotificationModule],
  controllers: [InviteController],
  providers: [InviteService, PrismaService],
})
export class InviteModule {}
