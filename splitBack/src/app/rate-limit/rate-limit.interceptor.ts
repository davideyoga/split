import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { trustedProxies } from '../auth/auth.factory';
import type { AuthUser } from '../auth/auth-user';
import { clientIp, proxyBlockList } from '../auth/client-ip';
import { FixedWindowLimiter, type RateRule } from './fixed-window';
import {
  ALL_REQUESTS,
  EXTRA_RATE_LIMIT,
  PUBLIC_REQUESTS,
  WRITES_PER_DAY,
  WRITES_PER_MINUTE,
} from './rate-limit.rules';

const READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Limiti di frequenza su tutte le rotte Nest (rate-limit.rules.ts). Senza, un
 * account poteva creare spese, rimborsi e gruppi senza fine, e ognuno manda
 * notifiche e push a chiunque di cui si conosca il nickname.
 *
 * - Con una sessione si conta per utente, non per IP: chi abusa ha un account,
 *   e dietro lo stesso IP (una rete aziendale, un operatore mobile) ci sono
 *   tante persone.
 * - Senza sessione (rotte pubbliche) si conta per IP.
 * - E' un interceptor e non una guard: gira dopo SessionAuthGuard, quindi sa
 *   chi e' l'utente. Una richiesta respinta con 401 non arriva qui e non conta.
 * - Risponde 429 con `code: RATE_LIMITED` e Retry-After; il frontend lo mostra
 *   con un toast (auth.interceptor.ts).
 * - API_RATE_LIMIT=off lo spegne: lo usano i test e2e, dove un utente fa in
 *   pochi secondi le richieste di molte sessioni.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);
  private readonly limiter = new FixedWindowLimiter();
  private readonly enabled = process.env['API_RATE_LIMIT'] !== 'off';
  private readonly proxies = proxyBlockList(trustedProxies(), (message) => this.logger.warn(message));

  constructor(private readonly reflector: Reflector) {
    if (!this.enabled) {
      this.logger.warn('API_RATE_LIMIT=off: nessun limite di frequenza sulle rotte dell\'API.');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    if (this.enabled && context.getType() === 'http') {
      this.check(context);
    }
    return next.handle();
  }

  private check(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: AuthUser }>();

    let subject: string;
    let rules: RateRule[];
    if (request.user) {
      subject = request.user.publicId;
      rules = [ALL_REQUESTS];
      if (!READ_METHODS.includes(request.method)) {
        rules.push(WRITES_PER_MINUTE, WRITES_PER_DAY);
      }
      const extra = this.reflector.get<RateRule | undefined>(EXTRA_RATE_LIMIT, context.getHandler());
      if (extra) {
        rules.push(extra);
      }
    } else {
      subject = clientIp(request.socket.remoteAddress, forwardedFor(request), this.proxies);
      rules = [PUBLIC_REQUESTS];
    }

    // Alla prima regola superata ci si ferma: le successive non contano una
    // richiesta che non e' passata.
    for (const rule of rules) {
      const retryAfter = this.limiter.hit(subject, rule);
      if (retryAfter > 0) {
        http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
        throw new HttpException(
          { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'RATE_LIMITED', message: 'RATE_LIMITED' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }
}

// Piu' header X-Forwarded-For nella stessa richiesta: Node li unisce gia' con
// una virgola, ma il tipo ammette l'array.
function forwardedFor(request: Request): string | undefined {
  const value = request.headers['x-forwarded-for'];
  return Array.isArray(value) ? value.join(',') : value;
}
