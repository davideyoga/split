import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SEARCHES = 30;

/**
 * Al massimo 30 ricerche utente (GET /api/user?q=) all'ora per utente. La
 * ricerca esatta per email dice se un indirizzo ha un account: con la
 * registrazione aperta chiunque potrebbe farsi un account e provarne tanti.
 * Chi aggiunge persone a mano ne fa poche, e quelle con cui divide gia' spese
 * le trova fra i contatti senza cercare.
 *
 * Va dopo SessionAuthGuard (conta per `request.user`). In memoria, come il rate
 * limit di Better Auth: si azzera a ogni riavvio e vale per un solo processo.
 * Per utente e non per IP: per provare indirizzi bisogna essere loggati, e
 * ogni account in piu' costa una casella email.
 */
@Injectable()
export class SearchRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { start: number; count: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const now = Date.now();
    const key = request.user.publicId;

    let window = this.windows.get(key);
    if (!window || now - window.start >= WINDOW_MS) {
      this.forgetExpired(now);
      window = { start: now, count: 0 };
      this.windows.set(key, window);
    }
    window.count++;
    if (window.count > MAX_SEARCHES) {
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'SEARCH_RATE_LIMITED', message: 'SEARCH_RATE_LIMITED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  // Solo quando si apre una finestra nuova: la mappa non cresce senza limite.
  private forgetExpired(now: number) {
    for (const [key, window] of this.windows) {
      if (now - window.start >= WINDOW_MS) {
        this.windows.delete(key);
      }
    }
  }
}
