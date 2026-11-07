import { inviteErrorKey, inviteUrl, tokenFromFragment } from './invite';

const TOKEN = 'a'.repeat(20) + '-_' + 'B'.repeat(21);

describe('inviteUrl', () => {
  it('mette il token nel fragment, mai nel path', () => {
    expect(inviteUrl('https://split.example', TOKEN)).toBe(`https://split.example/join#${TOKEN}`);
    expect(inviteUrl('https://split.example/', TOKEN)).toBe(`https://split.example/join#${TOKEN}`);
  });
});

describe('tokenFromFragment', () => {
  it('accetta il fragment con o senza #', () => {
    expect(tokenFromFragment(`#${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromFragment(TOKEN)).toBe(TOKEN);
  });

  it('rifiuta quello che non e\' un token', () => {
    expect(tokenFromFragment('')).toBeNull();
    expect(tokenFromFragment(null)).toBeNull();
    expect(tokenFromFragment('#corto')).toBeNull();
    expect(tokenFromFragment(`#${TOKEN}x`)).toBeNull();
    expect(tokenFromFragment(`#${TOKEN.slice(1)}/`)).toBeNull();
  });
});

describe('inviteErrorKey', () => {
  it('traduce i codici dell\'API, il resto e\' generico', () => {
    expect(inviteErrorKey('INVITE_NOT_FOUND')).toBe('join.error-not-found');
    expect(inviteErrorKey('INVITE_EXPIRED')).toBe('join.error-expired');
    expect(inviteErrorKey('INVITE_REVOKED')).toBe('join.error-revoked');
    expect(inviteErrorKey(undefined)).toBe('join.error-generic');
  });
});
