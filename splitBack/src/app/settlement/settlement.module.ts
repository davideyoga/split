import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma/prisma.service';
import { SettlementController } from './settlement.controller';
import { SettlementService } from './settlement.service';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [SettlementController],
  providers: [SettlementService, PrismaService],
})
export class SettlementModule {}
