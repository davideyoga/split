import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushDeviceService } from './push/push-device.service';
import { PushDispatcher } from './push/push-dispatcher';
import { PushFlushMiddleware } from './push/push-flush.middleware';
import { PushSender } from './push/push-sender';

// Un modulo solo, importato da spese, gruppi, inviti e rimborsi: Nest ne crea
// un'istanza sola, quindi anche un solo PushDispatcher (che manda un giro di
// push alla volta).
@Module({
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService, PrismaService, PushSender, PushDispatcher, PushDeviceService],
  exports: [NotificationService],
})
export class NotificationModule implements NestModule {
  // Su tutte le rotte di Nest: qualsiasi azione puo' creare notifiche. Il
  // costo per una richiesta che non ne crea e' un oggetto e un listener.
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PushFlushMiddleware).forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
