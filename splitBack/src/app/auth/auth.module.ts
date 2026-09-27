import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { BETTER_AUTH, createAuth } from './auth.factory';
import { SessionAuthGuard } from './session-auth.guard';

/**
 * Login con Better Auth. Le rotte /api/auth/* non passano da un controller
 * Nest: main.ts monta l'handler di Better Auth direttamente su Express, prima
 * del body parser di Nest (Better Auth legge il body da se').
 */
@Module({
  imports: [MailModule],
  providers: [
    {
      provide: BETTER_AUTH,
      // PrismaService viene dal PrismaModule globale.
      useFactory: (prisma: PrismaService, mail: MailService) => createAuth(prisma, mail),
      inject: [PrismaService, MailService],
    },
    SessionAuthGuard,
  ],
  exports: [BETTER_AUTH, SessionAuthGuard],
})
export class AuthModule {}
