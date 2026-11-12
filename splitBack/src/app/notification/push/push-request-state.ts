import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Lo stato push di una richiesta HTTP: `pending` = in questa richiesta e' nata
 * almeno una notifica. Lo scrive notify() (dentro la transazione) e lo legge
 * PushFlushMiddleware quando la risposta e' chiusa, cioe' a transazione finita.
 * File a parte, senza import, per non legare middleware e dispatcher in un
 * ciclo di import.
 */
export interface PushRequestState {
  pending: boolean;
}

export const pushRequestStorage = new AsyncLocalStorage<PushRequestState>();

/** false se non si e' dentro una richiesta HTTP (es. uno script). */
export function markPushPending(): boolean {
  const state = pushRequestStorage.getStore();
  if (!state) {
    return false;
  }
  state.pending = true;
  return true;
}
