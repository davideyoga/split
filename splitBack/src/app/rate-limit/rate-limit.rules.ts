import { SetMetadata } from '@nestjs/common';
import type { RateRule } from './fixed-window';

/**
 * Limiti dell'API (2026-11-14, numeri scelti con l'utente). Valgono per le
 * rotte Nest; quelle di login (/api/auth/*) hanno i limiti di Better Auth, la
 * ricerca utenti il suo (SearchRateLimitGuard, 30 all'ora).
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Per utente. Una pagina fa 3-4 richieste.
export const ALL_REQUESTS: RateRule = { name: 'all', max: 75, windowMs: MINUTE };

// Per utente, su POST / PATCH / DELETE: ogni scrittura puo' mandare notifiche
// e push ad altre persone.
export const WRITES_PER_MINUTE: RateRule = { name: 'write-minute', max: 30, windowMs: MINUTE };
export const WRITES_PER_DAY: RateRule = { name: 'write-day', max: 500, windowMs: DAY };

// Per IP, sulle rotte senza sessione (anteprima di un link d'invito, GET /api).
export const PUBLIC_REQUESTS: RateRule = { name: 'public', max: 15, windowMs: MINUTE };

// In piu', sulle singole rotte (decoratore @ExtraRateLimit).
// Ogni chiamata crea fino a 50 spese.
export const EXPENSE_BATCH: RateRule = { name: 'expense-batch', max: 5, windowMs: MINUTE };
// Ogni link nuovo revoca il precedente.
export const INVITE_CREATE: RateRule = { name: 'invite-create', max: 10, windowMs: HOUR };

export const EXTRA_RATE_LIMIT = 'split:extra-rate-limit';

/** Un limite in piu' per questa rotta, oltre a quelli generali. Per utente. */
export const ExtraRateLimit = (rule: RateRule) => SetMetadata(EXTRA_RATE_LIMIT, rule);
