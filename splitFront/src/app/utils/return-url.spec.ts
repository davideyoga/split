import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('tiene i percorsi interni', () => {
    expect(safeReturnUrl('/join')).toBe('/join');
    expect(safeReturnUrl('/tabs/balances?x=1')).toBe('/tabs/balances?x=1');
  });

  it('niente open redirect', () => {
    for (const url of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)']) {
      expect(safeReturnUrl(url)).toBe('/tabs/activity');
    }
  });

  it('niente pagine che riportano indietro, e un default senza returnUrl', () => {
    expect(safeReturnUrl('/login?returnUrl=%2Fjoin')).toBe('/tabs/activity');
    expect(safeReturnUrl('/welcome')).toBe('/tabs/activity');
    expect(safeReturnUrl(null)).toBe('/tabs/activity');
    expect(safeReturnUrl(undefined)).toBe('/tabs/activity');
  });
});
