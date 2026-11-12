import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PushDispatcher } from './push-dispatcher';
import { pushRequestStorage, type PushRequestState } from './push-request-state';

/**
 * Fa partire le push quando una richiesta che ha creato notifiche e' finita.
 * La risposta parte solo dopo che il servizio ha finito, quindi dopo il commit
 * della sua transazione: e' il "dopo il commit" senza che i servizi delle
 * azioni (spese, rimborsi, inviti) debbano occuparsene.
 */
@Injectable()
export class PushFlushMiddleware implements NestMiddleware {
  constructor(private readonly dispatcher: PushDispatcher) {}

  use(_req: Request, res: Response, next: NextFunction) {
    const state: PushRequestState = { pending: false };
    res.on('close', () => {
      if (!state.pending) {
        return;
      }
      // Chiusa senza risposta completa (client andato via): il servizio puo'
      // essere ancora a meta' transazione.
      if (res.writableFinished) {
        void this.dispatcher.flush();
      } else {
        this.dispatcher.flushLater();
      }
    });
    pushRequestStorage.run(state, () => next());
  }
}
