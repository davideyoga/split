import { createHash, randomBytes } from 'node:crypto';

/**
 * Token dei link d'invito ai gruppi (2026-11-07, doc/InvitiGruppo.md).
 * Funzioni pure: le usa InviteService e le provano i test Jest.
 */

// Scadenze fra cui sceglie chi crea il link (decisione dell'utente).
export const INVITE_EXPIRY_DAYS = [1, 7, 30] as const;
export type InviteExpiryDays = (typeof INVITE_EXPIRY_DAYS)[number];

// 32 byte casuali in base64url: 43 caratteri, 256 bit. Con questa entropia la
// forza bruta e' impraticabile anche senza rate limit.
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

// Nel DB solo l'hash, come per i codici di login: chi legge il DB non ottiene
// link validi. Basta uno SHA-256 (niente bcrypt): il token non e' una password
// scelta da una persona, non si indovina.
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function inviteExpiry(now: Date, days: InviteExpiryDays): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export type InviteStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

// La revoca vince sulla scadenza: un link revocato resta "revocato" anche dopo
// la sua data di scadenza.
export function inviteStatus(
  invite: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): InviteStatus {
  if (invite.revokedAt) {
    return 'REVOKED';
  }
  return invite.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : 'ACTIVE';
}
