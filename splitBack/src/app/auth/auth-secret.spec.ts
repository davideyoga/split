import { authSecret } from './auth-secret';

describe('authSecret', () => {
  const original = process.env['BETTER_AUTH_SECRET'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['BETTER_AUTH_SECRET'];
    } else {
      process.env['BETTER_AUTH_SECRET'] = original;
    }
  });

  it('restituisce un segreto lungo almeno 32 caratteri', () => {
    const secret = 'a'.repeat(32);
    process.env['BETTER_AUTH_SECRET'] = secret;
    expect(authSecret()).toBe(secret);
  });

  it('senza segreto ferma l\'avvio', () => {
    delete process.env['BETTER_AUTH_SECRET'];
    expect(() => authSecret()).toThrow('BETTER_AUTH_SECRET');
  });

  it('rifiuta un segreto corto', () => {
    process.env['BETTER_AUTH_SECRET'] = 'a'.repeat(31);
    expect(() => authSecret()).toThrow('BETTER_AUTH_SECRET');
  });

  it('rifiuta il valore di esempio di .env.example', () => {
    process.env['BETTER_AUTH_SECRET'] = 'stringa_casuale_lunga_a_tua_scelta';
    expect(() => authSecret()).toThrow('BETTER_AUTH_SECRET');
  });
});
