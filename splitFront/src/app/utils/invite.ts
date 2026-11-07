/**
 * Link d'invito ai gruppi (2026-11-07, doc/InvitiGruppo.md). Funzioni pure.
 *
 * Il link e' `<sito>/join#<token>`: il token sta nel fragment, che il browser
 * non manda mai al server (niente log di accesso, niente Referer). Attraverso
 * il login viaggia in sessionStorage, non nel returnUrl.
 */

export const INVITE_TOKEN_STORAGE_KEY = 'split.inviteToken';

// Gemello di INVITE_TOKEN_PATTERN in splitBack/src/app/invite/invite-token.ts.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const INVITE_EXPIRY_DAYS = [1, 7, 30] as const;
export type InviteExpiryDays = (typeof INVITE_EXPIRY_DAYS)[number];
export const DEFAULT_INVITE_EXPIRY: InviteExpiryDays = 7;

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/join#${token}`;
}

// Il token dal fragment (con o senza '#'), o null se non ha la forma giusta.
export function tokenFromFragment(fragment: string | null | undefined): string | null {
  const token = (fragment ?? '').replace(/^#/, '').trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

// Chiave i18n di un errore dell'API sui link (`error.code` = INVITE_*).
export function inviteErrorKey(code: unknown): string {
  switch (code) {
    case 'INVITE_NOT_FOUND':
      return 'join.error-not-found';
    case 'INVITE_EXPIRED':
      return 'join.error-expired';
    case 'INVITE_REVOKED':
      return 'join.error-revoked';
    default:
      return 'join.error-generic';
  }
}
