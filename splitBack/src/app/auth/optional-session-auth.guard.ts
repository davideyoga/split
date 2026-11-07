import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { BETTER_AUTH, type Auth } from './auth.factory';
import type { AuthUser } from './auth-user';

/**
 * Come SessionAuthGuard, ma per le rotte pubbliche: con una sessione valida
 * mette l'utente in `request.user`, senza non blocca niente. Lo usa
 * l'anteprima dei link d'invito, che a chi e' gia' membro dice di esserlo.
 */
@Injectable()
export class OptionalSessionAuthGuard implements CanActivate {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      return true;
    }
    // Solo l'header Authorization, mai i cookie (vedi SessionAuthGuard).
    const session = await this.auth.api.getSession({ headers: new Headers({ authorization }) });
    if (session) {
      request.user = {
        publicId: session.user.publicId as string,
        nickName: session.user.name,
        email: session.user.email,
      };
    }
    return true;
  }
}
