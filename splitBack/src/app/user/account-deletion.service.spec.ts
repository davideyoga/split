import { anonymizedIdentity } from './account-deletion.service';
import { DELETED_NICKNAME_PREFIX, nicknameError } from './nickname';

describe('anonymizedIdentity', () => {
  const now = new Date('2026-11-08T12:00:00.000Z');

  it('non conserva niente che identifichi la persona', () => {
    expect(anonymizedIdentity(now)).toMatchObject({
      image: null,
      confirmed: false,
      needsName: false,
      deletedAt: now,
    });
  });

  it('usa valori diversi a ogni cancellazione (email e nickname sono unici)', () => {
    const [a, b] = [anonymizedIdentity(now), anonymizedIdentity(now)];
    expect(a.email).not.toBe(b.email);
    expect(a.nickName).not.toBe(b.nickName);
    expect(a.publicId).not.toBe(b.publicId);
  });

  it('usa un dominio che non puo\' ricevere email', () => {
    expect(anonymizedIdentity(now).email).toMatch(/@deleted\.invalid$/);
  });

  it('usa un nickname che nessuno puo\' scegliere', () => {
    const { nickName } = anonymizedIdentity(now);
    expect(nickName.startsWith(DELETED_NICKNAME_PREFIX)).toBe(true);
    expect(nicknameError(nickName)).toBe('NICKNAME_INVALID_CHAR');
  });
});
