import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BETTER_AUTH, type Auth } from './auth.factory';
import type { AuthUser } from './auth-user';

/**
 * Richiede una sessione Better Auth valida (`Authorization: Bearer <token>`,
 * convertito dal plugin bearer) e mette l'utente in `request.user`, con la
 * stessa forma che aveva col vecchio JwtAuthGuard.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Sessione mancante o scaduta');
    }
    // Solo l'header Authorization, mai i cookie: con un Bearer non valido
    // Better Auth ricadrebbe sul cookie di sessione, che il browser manda da
    // solo (CSRF) se app e API stanno sullo stesso dominio.
    const session = await this.auth.api.getSession({ headers: new Headers({ authorization }) });

    if (!session) {
      throw new UnauthorizedException('Sessione mancante o scaduta');
    }

    request.user = {
      publicId: session.user.publicId as string,
      nickName: session.user.name,
      email: session.user.email,
    };
    return true;
  }
}
