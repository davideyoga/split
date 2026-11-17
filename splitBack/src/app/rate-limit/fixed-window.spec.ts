import { FixedWindowLimiter, type RateRule } from './fixed-window';

const RULE: RateRule = { name: 'test', max: 3, windowMs: 60_000 };
const T0 = 1_000_000;

describe('FixedWindowLimiter', () => {
  it('lascia passare fino a max richieste, poi dice fra quanti secondi riprovare', () => {
    const limiter = new FixedWindowLimiter();
    expect(limiter.hit('pippo', RULE, T0)).toBe(0);
    expect(limiter.hit('pippo', RULE, T0 + 1_000)).toBe(0);
    expect(limiter.hit('pippo', RULE, T0 + 2_000)).toBe(0);
    expect(limiter.hit('pippo', RULE, T0 + 15_000)).toBe(45);
  });

  it('riapre quando la finestra e\' passata', () => {
    const limiter = new FixedWindowLimiter();
    for (let i = 0; i < 4; i++) {
      limiter.hit('pippo', RULE, T0);
    }
    expect(limiter.hit('pippo', RULE, T0 + 59_999)).toBe(1);
    expect(limiter.hit('pippo', RULE, T0 + 60_000)).toBe(0);
  });

  it('conta separatamente persone e regole diverse', () => {
    const limiter = new FixedWindowLimiter();
    const other: RateRule = { name: 'altra', max: 1, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      limiter.hit('pippo', RULE, T0);
    }
    expect(limiter.hit('pippo', RULE, T0)).toBeGreaterThan(0);
    expect(limiter.hit('pluto', RULE, T0)).toBe(0);
    expect(limiter.hit('pippo', other, T0)).toBe(0);
    expect(limiter.hit('pippo', other, T0)).toBeGreaterThan(0);
  });

  it('dimentica le finestre scadute', () => {
    const limiter = new FixedWindowLimiter();
    limiter.hit('pippo', RULE, T0);
    limiter.hit('pluto', RULE, T0);
    expect(limiter.size).toBe(2);
    limiter.hit('paperino', RULE, T0 + 120_000);
    expect(limiter.size).toBe(1);
  });
});
