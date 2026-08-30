import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';

@Module({
  imports: [AuthModule],
  controllers: [GroupController],
  providers: [GroupService, PrismaService],
})
export class GroupModule {}
