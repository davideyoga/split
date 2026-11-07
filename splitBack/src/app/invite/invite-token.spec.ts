import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_PATTERN,
  inviteExpiry,
  inviteStatus,
} from './invite-token';

describe('generateInviteToken', () => {
  it('43 caratteri base64url, e nel DB solo il suo hash', () => {
    const { token, tokenHash } = generateInviteToken();
    expect(token).toMatch(INVITE_TOKEN_PATTERN);
    expect(tokenHash).toBe(hashInviteToken(token));
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ogni link e\' diverso', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateInviteToken().token));
    expect(tokens.size).toBe(100);
  });
});

describe('inviteExpiry', () => {
  it('aggiunge i giorni scelti', () => {
    const now = new Date('2026-11-07T10:00:00.000Z');
    expect(inviteExpiry(now, 7).toISOString()).toBe('2026-11-14T10:00:00.000Z');
    expect(inviteExpiry(now, 1).toISOString()).toBe('2026-11-08T10:00:00.000Z');
  });
});

describe('inviteStatus', () => {
  const now = new Date('2026-11-07T10:00:00.000Z');
  const later = new Date('2026-11-08T10:00:00.000Z');

  it('attivo prima della scadenza', () => {
    expect(inviteStatus({ expiresAt: later, revokedAt: null }, now)).toBe('ACTIVE');
  });

  it('scaduto dal momento della scadenza in poi', () => {
    expect(inviteStatus({ expiresAt: now, revokedAt: null }, now)).toBe('EXPIRED');
  });

  it('la revoca vince sulla scadenza', () => {
    expect(inviteStatus({ expiresAt: now, revokedAt: now }, later)).toBe('REVOKED');
    expect(inviteStatus({ expiresAt: later, revokedAt: now }, now)).toBe('REVOKED');
  });
});
